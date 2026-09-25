/**
 * In-feed action button and menu.
 *
 * Instead of injecting a button into every post (which would mean touching
 * Reddit's own elements and shadow roots), a single floating button lives in
 * one extension-owned host element with a closed Shadow DOM. When the pointer
 * enters a feed post, the button is positioned over that post's bottom-right
 * corner — clear of the vote/comment/share row on the left and Reddit's own
 * overflow menu at the top right. Reddit's markup is never modified.
 *
 * All user-controlled text is rendered with textContent.
 */

import type { Config } from "../storage/schema";
import {
  addRule,
  addToAllowlist,
  createCategory,
  quickBlock,
  QUICK_BLOCK_ID,
  RuleError,
} from "../storage/config-ops";
import { saveConfig, updateConfig } from "../storage/config-store";
import { extractPost, hideTarget, postFromEventTarget, type ExtractedPost } from "./reddit-adapter";

const STYLE = `
* { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.btn {
  position: absolute; z-index: 2147483000; display: none;
  width: 28px; height: 28px; border-radius: 14px; border: 1px solid var(--bd); cursor: pointer;
  background: var(--bg); color: var(--fg); font-size: 15px; line-height: 1; padding: 0;
  box-shadow: 0 1px 3px rgba(0,0,0,.2); opacity: .75;
}
.btn:hover, .btn:focus-visible { opacity: 1; outline: 2px solid var(--accent); }
.btn.show { display: block; }
.menu {
  position: absolute; z-index: 2147483001; display: none; min-width: 250px; max-width: 320px;
  background: var(--bg); color: var(--fg); border: 1px solid var(--bd); border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0,0,0,.25); padding: 6px; font-size: 13px;
}
.menu.show { display: block; }
.hdr { padding: 6px 8px 8px; font-weight: 600; border-bottom: 1px solid var(--bd); margin-bottom: 4px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hdr small { display: block; font-weight: 400; color: var(--muted); margin-top: 2px; white-space: normal; }
.item { display: block; width: 100%; text-align: left; background: none; border: 0; color: inherit;
  padding: 7px 8px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.item:hover, .item:focus-visible { background: var(--hover); outline: none; }
.item.sub { padding-left: 20px; }
.sep { height: 1px; background: var(--bd); margin: 4px 0; }
.form { padding: 6px 8px; display: flex; flex-direction: column; gap: 6px; }
.form input, .form select { width: 100%; padding: 6px 8px; border: 1px solid var(--bd); border-radius: 6px;
  background: var(--input); color: var(--fg); font-size: 13px; }
.row { display: flex; gap: 6px; justify-content: flex-end; }
.primary { background: var(--accent); color: #fff; border: 0; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 13px; }
.ghost { background: none; color: var(--fg); border: 1px solid var(--bd); border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 13px; }
.err { color: #d93a00; font-size: 12px; }
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 2147483002;
  background: #1a1a1b; color: #fff; padding: 10px 14px; border-radius: 8px; font-size: 13px; display: none;
  box-shadow: 0 6px 24px rgba(0,0,0,.3); align-items: center; gap: 12px; }
.toast.show { display: flex; }
.toast button { background: none; border: 0; color: #7cb8ff; font-weight: 600; cursor: pointer; font-size: 13px; }
.wrap { --bg: #fff; --fg: #1a1a1b; --muted: #576f76; --bd: #d7dadc; --hover: #eef1f3; --input: #fff; --accent: #0a66c2; }
@media (prefers-color-scheme: dark) {
  .wrap { --bg: #1a1a1b; --fg: #d7dadc; --muted: #8ba2ad; --bd: #3a3c3e; --hover: #272729; --input: #0e1113; --accent: #3d8bfd; }
}
`;

type Getter = () => Config | null;

const BUTTON_SIZE = 28;
/** Reddit's own header-row controls on a post (new frontend / old reddit). */
const HEADER_CONTROLS = "[slot='overflow-menu'], shreddit-post-overflow-menu, shreddit-join-button, [slot='joinButton'], [slot='join-button']";

export class PostActions {
  private readonly host: HTMLElement;
  private readonly root: ShadowRoot;
  private readonly wrap: HTMLDivElement;
  private readonly button: HTMLButtonElement;
  private readonly menu: HTMLDivElement;
  private readonly toast: HTMLDivElement;
  private currentPost: Element | null = null;
  private menuPost: ExtractedPost | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private enabled = true;

  constructor(private readonly getConfig: Getter) {
    // A plain <div>, not a custom tag: Reddit hides undefined custom elements
    // (`:not(:defined) { visibility: hidden }`). Inline !important styles keep
    // page CSS from affecting the host; everything else is inside the shadow root.
    this.host = document.createElement("div");
    this.host.id = "reddit-feed-curator-ui";
    this.host.setAttribute(
      "style",
      "all: initial !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 0 !important; height: 0 !important; overflow: visible !important; display: block !important; visibility: visible !important; z-index: 2147483000 !important;",
    );
    this.root = this.host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    this.wrap = document.createElement("div");
    this.wrap.className = "wrap";
    this.button = el("button", "btn", "⊘");
    this.button.title = "Reddit Feed Curator: filter options for this post";
    this.button.setAttribute("aria-label", "Reddit Feed Curator options for this post");
    this.menu = el("div", "menu");
    this.menu.setAttribute("role", "menu");
    this.toast = el("div", "toast");
    this.toast.setAttribute("role", "status");
    this.wrap.append(this.button, this.menu, this.toast);
    this.root.append(style, this.wrap);

    this.button.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openMenu();
    });
    // Keep typing in our inputs from reaching Reddit's keyboard shortcuts.
    for (const type of ["keydown", "keyup", "keypress"]) this.host.addEventListener(type, (e) => e.stopPropagation());
    this.host.addEventListener("mouseenter", () => this.cancelHide());
    this.host.addEventListener("mouseleave", () => this.scheduleHide());
    document.addEventListener("mouseover", (e) => this.onPointer(e), { passive: true, capture: true });
    let frame = 0;
    addEventListener("scroll", () => {
      if (frame || !this.currentPost || this.menu.classList.contains("show")) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (this.currentPost?.isConnected) this.positionButton(this.currentPost);
      });
    }, { passive: true });
    document.addEventListener("mousedown", (e) => {
      if (!e.composedPath().includes(this.host)) this.closeMenu();
    }, true);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.menu.classList.contains("show")) this.closeMenu();
    }, true);
  }

  mount(): void {
    // Attached to <html> (not <body>) so absolute coordinates are document coordinates
    // regardless of how Reddit positions <body>.
    if (!this.host.isConnected) document.documentElement.append(this.host);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.closeMenu();
      this.button.classList.remove("show");
    }
  }

  // ---- floating button ----------------------------------------------------

  private onPointer(e: MouseEvent): void {
    if (!this.enabled || this.menu.classList.contains("show")) return;
    if (e.composedPath().includes(this.host)) return;
    const post = postFromEventTarget(e.target);
    if (!post) {
      if (this.currentPost) this.scheduleHide();
      return;
    }
    this.cancelHide();
    this.currentPost = post;
    this.positionButton(post);
  }

  /**
   * Place the button in the post's header row, just left of Reddit's own
   * Join / overflow controls (found by their slot or tag, not CSS classes).
   * If the header has scrolled out of view on a tall post, keep the button at
   * the top of the visible part of the post instead.
   */
  private positionButton(post: Element): void {
    const box = hideTarget(post).getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    let right = box.right - 12;
    let top = box.top + 10;
    for (const ctl of post.querySelectorAll(HEADER_CONTROLS)) {
      const r = ctl.getBoundingClientRect();
      if (r.width === 0 || r.top > box.top + 90) continue; // only controls in the header row
      right = Math.min(right, r.left - 6);
      top = r.top + (r.height - BUTTON_SIZE) / 2;
    }
    const minTop = 64; // below Reddit's sticky top bar
    if (top < minTop) top = Math.min(Math.max(minTop, box.top + 10), box.bottom - BUTTON_SIZE - 10);
    this.button.style.left = `${right - BUTTON_SIZE + scrollX}px`;
    this.button.style.top = `${top + scrollY}px`;
    this.button.classList.add("show");
  }

  private scheduleHide(): void {
    if (this.hideTimer || this.menu.classList.contains("show")) return;
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.button.classList.remove("show");
      this.currentPost = null;
    }, 350);
  }

  private cancelHide(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  // ---- menu ---------------------------------------------------------------

  private openMenu(): void {
    if (!this.currentPost) return;
    const post = extractPost(this.currentPost);
    if (!post) return;
    this.menuPost = post;
    this.renderMainMenu();
    const b = this.button.getBoundingClientRect();
    this.menu.classList.add("show");
    const m = this.menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(b.right - m.width, innerWidth - m.width - 8));
    const openUp = b.bottom + m.height + 8 > innerHeight && b.top - m.height - 8 > 0;
    const top = openUp ? b.top - m.height - 6 : b.bottom + 6;
    this.menu.style.left = `${left + scrollX}px`;
    this.menu.style.top = `${top + scrollY}px`;
    this.menu.querySelector<HTMLElement>(".item")?.focus();
  }

  private closeMenu(): void {
    this.menu.classList.remove("show");
    this.menuPost = null;
    this.scheduleHide();
  }

  private header(post: ExtractedPost, note?: string): HTMLElement {
    const hdr = el("div", "hdr", `r/${post.subreddit}`);
    if (note) hdr.append(el("small", "", note));
    return hdr;
  }

  private renderMainMenu(): void {
    const post = this.menuPost!;
    const config = this.getConfig();
    this.menu.replaceChildren(this.header(post, post.title ? `“${truncate(post.title, 80)}”` : undefined));
    this.menu.append(
      this.item(`Hide r/${post.subreddit}`, () =>
        this.apply((c) => quickBlock(c, post.subreddit, QUICK_BLOCK_ID), `r/${post.subreddit} hidden`),
      ),
      this.item("Add subreddit to category…", () => this.renderCategoryPicker()),
      this.item("Add title keyword rule…", () => this.renderKeywordForm()),
      el("div", "sep"),
      this.item(`Always show r/${post.subreddit} (allowlist)`, () =>
        this.apply((c) => addToAllowlist(c, post.subreddit), `r/${post.subreddit} added to allowlist`),
      ),
      this.item("Open settings", () => {
        this.closeMenu();
        void browser.runtime.sendMessage({ type: "open-options" });
      }),
    );
    if (!config) this.menu.append(el("div", "err", "Settings not loaded yet."));
  }

  private renderCategoryPicker(): void {
    const post = this.menuPost!;
    const config = this.getConfig();
    this.menu.replaceChildren(this.header(post, "Add this subreddit to:"));
    for (const cat of config?.categories ?? []) {
      const label = cat.enabled ? cat.name : `${cat.name} (off, will be enabled)`;
      this.menu.append(
        this.item(label, () => this.apply((c) => quickBlock(c, post.subreddit, cat.id), `r/${post.subreddit} added to “${cat.name}”`), true),
      );
    }
    this.menu.append(el("div", "sep"));
    const form = el("div", "form");
    const input = document.createElement("input");
    input.placeholder = "New category name";
    input.maxLength = 100;
    const err = el("div", "err");
    const create = el("button", "primary", "Create & add");
    const back = el("button", "ghost", "Back");
    const submit = () => {
      const name = input.value.trim();
      if (!name) return void (err.textContent = "Enter a name.");
      this.apply((c) => {
        const created = createCategory(c, name);
        return quickBlock(created.config, post.subreddit, created.id);
      }, `r/${post.subreddit} added to new category “${name}”`, err);
    };
    create.addEventListener("click", submit);
    back.addEventListener("click", () => this.renderMainMenu());
    input.addEventListener("keydown", (e) => e.key === "Enter" && submit());
    const row = el("div", "row");
    row.append(back, create);
    form.append(input, err, row);
    this.menu.append(form);
  }

  private renderKeywordForm(): void {
    const post = this.menuPost!;
    const config = this.getConfig();
    this.menu.replaceChildren(this.header(post, "Hide posts whose title contains a word or phrase:"));
    const form = el("div", "form");
    const input = document.createElement("input");
    input.placeholder = "e.g. comic strip";
    input.maxLength = 100;
    const select = document.createElement("select");
    for (const cat of config?.categories ?? []) {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.enabled ? cat.name : `${cat.name} (off)`;
      select.append(opt);
    }
    const err = el("div", "err");
    const add = el("button", "primary", "Add keyword");
    const back = el("button", "ghost", "Back");
    const submit = () => {
      const kw = input.value;
      const catId = select.value;
      if (!catId) return void (err.textContent = "Create a category first.");
      this.apply((c) => addRule(c, catId, "keywords", kw), `Keyword “${kw.trim()}” added`, err);
    };
    add.addEventListener("click", submit);
    back.addEventListener("click", () => this.renderMainMenu());
    input.addEventListener("keydown", (e) => e.key === "Enter" && submit());
    const row = el("div", "row");
    row.append(back, add);
    form.append(input, select, err, row);
    this.menu.append(form);
    input.focus();
  }

  private item(label: string, onClick: () => void, sub = false): HTMLButtonElement {
    const b = el("button", sub ? "item sub" : "item", label);
    b.setAttribute("role", "menuitem");
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  /** Apply a config edit, persist it, and offer an undo. Errors are shown inline. */
  private apply(fn: (c: Config) => Config, message: string, errorEl?: HTMLElement): void {
    let before: Config | null = null;
    updateConfig((c) => {
      before = c;
      return fn(c);
    })
      .then(() => {
        this.closeMenu();
        this.showToast(message, before);
      })
      .catch((e: unknown) => {
        const msg = e instanceof RuleError ? e.message : "Could not save the change.";
        if (errorEl) errorEl.textContent = msg;
        else this.showToast(msg, null);
      });
  }

  private showToast(message: string, undoTo: Config | null): void {
    this.toast.replaceChildren(el("span", "", message));
    if (undoTo) {
      const undo = el("button", "", "Undo");
      undo.addEventListener("click", () => {
        void saveConfig(undoTo);
        this.toast.classList.remove("show");
      });
      this.toast.append(undo);
    }
    this.toast.classList.add("show");
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.classList.remove("show"), 6000);
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
