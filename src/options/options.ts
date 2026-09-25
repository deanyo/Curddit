import { SCOPE_LABELS } from "../content/feed-scope";
import { describeMatch, evaluate } from "../filtering/engine";
import { stripSubredditPrefix } from "../filtering/normalization";
import { byId, h, toggle } from "../shared/dom";
import {
  addRule,
  addToAllowlist,
  createCategory,
  deleteCategory,
  moveCategory,
  removeFromAllowlist,
  removeRule,
  RuleError,
  setCategoryEnabled,
  updateCategoryMeta,
  type ListKind,
} from "../storage/config-ops";
import { loadConfig, onConfigChanged, saveConfig } from "../storage/config-store";
import { createDefaultConfig } from "../storage/defaults";
import { FEED_SCOPES, type Category, type Config } from "../storage/schema";
import { parseImport, serializeExport } from "../storage/validation";

let config: Config;
let selectedId: string | null = null;
let globalQuery = "";
const filters = new Map<string, string>();
const drafts = new Map<string, string>();
const fieldErrors = new Map<string, string>();

// ---- state changes ---------------------------------------------------------

function commit(fn: (c: Config) => Config, errorKey?: string): boolean {
  try {
    const next = fn(config);
    if (errorKey) fieldErrors.delete(errorKey);
    if (next !== config) {
      config = next;
      void saveConfig(next).catch((e) => notify(`Could not save: ${String(e)}`, true));
    }
    render();
    return true;
  } catch (e) {
    const msg = e instanceof RuleError ? e.message : String(e);
    if (errorKey) {
      fieldErrors.set(errorKey, msg);
      render();
    } else notify(msg, true);
    return false;
  }
}

let noticeTimer: ReturnType<typeof setTimeout> | undefined;
function notify(message: string, error = false): void {
  const n = byId("notice");
  n.textContent = message;
  n.classList.toggle("error", error);
  n.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => (n.hidden = true), 6000);
}

// ---- rendering -------------------------------------------------------------

/** Re-render dynamic sections, preserving focus and caret position. */
function render(): void {
  const active = document.activeElement as HTMLElement | null;
  const focusKey = active?.dataset.key;
  const caret = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active.selectionStart : null;

  if (!config.categories.some((c) => c.id === selectedId)) selectedId = config.categories[0]?.id ?? null;
  renderGeneral();
  renderCategoryList();
  renderEditor();
  renderAllowlist();
  renderGlobalSearch();
  renderTester();

  if (focusKey) {
    const el = document.querySelector<HTMLElement>(`[data-key="${CSS.escape(focusKey)}"]`);
    el?.focus();
    if (caret !== null && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      try {
        el.setSelectionRange(caret, caret);
      } catch {
        /* not a text input */
      }
    }
  }
}

function renderGeneral(): void {
  const scope = h(
    "fieldset",
    {},
    h("legend", { class: "sr-only", text: "Feed scope" }),
    ...FEED_SCOPES.map((s) =>
      h(
        "label",
        {},
        h("input", {
          type: "radio",
          name: "scope",
          value: s,
          checked: config.scope === s,
          on: { change: () => commit((c) => ({ ...c, scope: s })) },
        }),
        SCOPE_LABELS[s],
      ),
    ),
  );
  const mode = h(
    "fieldset",
    {},
    ...(
      [
        ["hide", "Hide matching posts"],
        ["dim", "Dim matching posts and show why (useful for checking rules)"],
      ] as const
    ).map(([value, label]) =>
      h(
        "label",
        {},
        h("input", {
          type: "radio",
          name: "hideMode",
          value,
          checked: config.hideMode === value,
          on: { change: () => commit((c) => ({ ...c, hideMode: value })) },
        }),
        label,
      ),
    ),
  );
  const paused = config.pausedUntil !== null && config.pausedUntil > Date.now();
  byId("general-body").replaceChildren(
    setting(
      "Filtering enabled",
      paused ? `Paused until ${new Date(config.pausedUntil!).toLocaleString()}.` : "Master switch for all categories.",
      h(
        "div",
        { class: "row" },
        paused ? h("button", { type: "button", text: "Resume now", on: { click: () => commit((c) => ({ ...c, pausedUntil: null })) } }) : null,
        toggle(config.enabled, (on) => commit((c) => ({ ...c, enabled: on })), "Filtering enabled"),
      ),
    ),
    setting(
      "Where to filter",
      "Single-subreddit pages and comment pages are never filtered, so visiting a blocked community still works.",
      scope,
    ),
    setting("Matching posts", "", mode),
    setting(
      "In-feed action button",
      "Shows a small ⊘ button on the post under your mouse, for hiding its subreddit, adding it to a category, adding a keyword or allowlisting it.",
      toggle(config.showPostActions, (on) => commit((c) => ({ ...c, showPostActions: on })), "In-feed action button"),
    ),
  );
}

function setting(title: string, hint: string, control: Node): HTMLElement {
  return h("div", { class: "setting" }, h("div", { class: "label" }, h("strong", { text: title }), hint ? h("small", { text: hint }) : null), control);
}

function ruleTotal(c: Category): number {
  return c.rules.subreddits.length + c.rules.patterns.length + c.rules.keywords.length;
}

function renderCategoryList(): void {
  byId("cat-list").replaceChildren(
    ...config.categories.map((cat) => {
      const li = h(
        "li",
        {
          class: cat.id === selectedId ? "selected" : "",
          tabIndex: 0,
          attrs: { role: "button", "aria-pressed": String(cat.id === selectedId) },
          on: {
            click: (e) => {
              if ((e.target as HTMLElement).closest(".switch")) return;
              selectedId = cat.id;
              render();
            },
            keydown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectedId = cat.id;
                render();
              }
            },
          },
        },
        h("span", { class: "n" }, cat.name, h("small", { text: `${ruleTotal(cat)} rules${cat.enabled ? "" : " · off"}` })),
        toggle(cat.enabled, (on) => commit((c) => setCategoryEnabled(c, cat.id, on)), `Enable ${cat.name}`),
      );
      return li;
    }),
  );
}

const PANELS: { kind: ListKind; title: string; hint: string; placeholder: string; split: RegExp }[] = [
  {
    kind: "subreddits",
    title: "Exact subreddits",
    hint: "Hide every feed post from these communities. You can paste several at once, separated by commas, spaces or new lines.",
    placeholder: "e.g. r/Fauxmoi, popculturechat",
    split: /[\s,]+/,
  },
  {
    kind: "patterns",
    title: "Wildcard patterns",
    hint: "Match subreddit names. * = any characters, ? = one character. Example: *snark* matches any name containing “snark”.",
    placeholder: "e.g. *snark*",
    split: /[\s,]+/,
  },
  {
    kind: "keywords",
    title: "Title keywords",
    hint: "Whole words or phrases in post titles, from any subreddit. A trailing * matches word beginnings. Separate several with commas.",
    placeholder: "e.g. comic strip, webcomic",
    split: /[,\n]+/,
  },
  {
    kind: "exclusions",
    title: "Exclusions",
    hint: "Subreddits (or patterns) this category should never hide, even when a rule above matches.",
    placeholder: "e.g. SnarkyPuppy",
    split: /[\s,]+/,
  },
];

function renderEditor(): void {
  const editor = byId("cat-editor");
  const cat = config.categories.find((c) => c.id === selectedId);
  if (!cat) {
    editor.replaceChildren(h("p", { class: "empty", text: "No categories yet. Create one on the left." }));
    return;
  }
  const idx = config.categories.indexOf(cat);
  const nameErrKey = `${cat.id}:name`;
  const name = h("input", {
    type: "text",
    value: cat.name,
    maxLength: 100,
    attrs: { "aria-label": "Category name", "data-key": `${cat.id}:name` },
    on: { change: () => commit((c) => updateCategoryMeta(c, cat.id, { name: name.value }), nameErrKey) },
  });
  const desc = h("textarea", {
    value: cat.description,
    rows: 2,
    maxLength: 500,
    placeholder: "Description (optional)",
    attrs: { "aria-label": "Category description", "data-key": `${cat.id}:desc` },
    on: { change: () => commit((c) => updateCategoryMeta(c, cat.id, { description: desc.value })) },
  });
  editor.replaceChildren(
    h("div", { class: "meta" }, name, h("div", { class: "field-error", text: fieldErrors.get(nameErrKey) ?? "" }), desc),
    h(
      "div",
      { class: "actions" },
      toggle(cat.enabled, (on) => commit((c) => setCategoryEnabled(c, cat.id, on)), `Enable ${cat.name}`),
      h("span", { text: cat.enabled ? "Enabled" : "Disabled" }),
      h("span", { class: "spacer" }),
      h("button", { type: "button", text: "↑", title: "Move up", disabled: idx === 0, on: { click: () => commit((c) => moveCategory(c, cat.id, -1)) } }),
      h("button", {
        type: "button",
        text: "↓",
        title: "Move down",
        disabled: idx === config.categories.length - 1,
        on: { click: () => commit((c) => moveCategory(c, cat.id, 1)) },
      }),
      h("button", {
        type: "button",
        class: "danger",
        text: "Delete category",
        on: {
          click: () => {
            if (confirm(`Delete “${cat.name}” and its ${ruleTotal(cat)} rules? This can't be undone (export first if unsure).`)) {
              commit((c) => deleteCategory(c, cat.id));
            }
          },
        },
      }),
    ),
    ...PANELS.map((p) => rulePanel(cat, p)),
  );
}

function listFor(cat: Category, kind: ListKind): string[] {
  return kind === "exclusions" ? cat.exclusions : cat.rules[kind];
}

function rulePanel(cat: Category, panel: (typeof PANELS)[number]): HTMLElement {
  const key = `${cat.id}:${panel.kind}`;
  const items = listFor(cat, panel.kind);
  const filter = filters.get(key) ?? "";
  const shown = [...items]
    .filter((v) => !filter || v.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const input = h("input", {
    type: "text",
    value: drafts.get(key) ?? "",
    placeholder: panel.placeholder,
    attrs: { "aria-label": `Add ${panel.title.toLowerCase()}`, "data-key": `${key}:add` },
    on: { input: () => drafts.set(key, input.value) },
  });
  const add = (e: Event) => {
    e.preventDefault();
    const values = input.value.split(panel.split).map((v) => v.trim()).filter(Boolean);
    if (!values.length) return;
    const errors: string[] = [];
    const failed: string[] = [];
    let next = config;
    for (const v of values) {
      try {
        next = addRule(next, cat.id, panel.kind, v);
      } catch (err) {
        errors.push(err instanceof RuleError ? err.message : String(err));
        failed.push(v);
      }
    }
    // Keep only the rejected values in the box so they can be corrected.
    drafts.set(key, failed.join(", "));
    if (errors.length) fieldErrors.set(key, errors.join(" "));
    else fieldErrors.delete(key);
    commit(() => next);
  };

  const filterInput =
    items.length > 12
      ? h("input", {
          type: "search",
          class: "rule-filter",
          value: filter,
          placeholder: `Filter ${items.length} entries…`,
          attrs: { "aria-label": `Filter ${panel.title.toLowerCase()}`, "data-key": `${key}:filter` },
          on: {
            input: (e) => {
              filters.set(key, (e.target as HTMLInputElement).value);
              render();
            },
          },
        })
      : null;

  return h(
    "div",
    { class: "rule-panel" },
    h("h3", {}, panel.title, h("span", { class: "count", text: filter ? `${shown.length} of ${items.length}` : String(items.length) })),
    h("p", { class: "hint", text: panel.hint }),
    h("form", { class: "rule-add", on: { submit: add } }, input, h("button", { type: "submit", text: "Add" })),
    h("div", { class: "field-error", text: fieldErrors.get(key) ?? "" }),
    filterInput,
    shown.length
      ? h(
          "div",
          { class: "chips" },
          ...shown.map((v) =>
            h(
              "span",
              { class: "chip" },
              panel.kind === "subreddits" ? `r/${v}` : v,
              h("button", {
                type: "button",
                text: "×",
                title: `Remove ${v}`,
                attrs: { "aria-label": `Remove ${v}` },
                on: { click: () => commit((c) => removeRule(c, cat.id, panel.kind, v)) },
              }),
            ),
          ),
        )
      : h("p", { class: "empty", text: filter ? "No matches." : "None yet." }),
  );
}

function renderAllowlist(): void {
  const key = "allowlist";
  const input = h("input", {
    type: "text",
    value: drafts.get(key) ?? "",
    placeholder: "e.g. r/AskReddit",
    attrs: { "aria-label": "Add subreddit to allowlist", "data-key": "allowlist:add" },
    on: { input: () => drafts.set(key, input.value) },
  });
  const add = (e: Event) => {
    e.preventDefault();
    const values = input.value.split(/[\s,]+/).filter(Boolean);
    drafts.set(key, "");
    commit((c) => values.reduce((acc, v) => addToAllowlist(acc, v), c), key);
  };
  const sorted = [...config.allowlist].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  byId("allowlist-body").replaceChildren(
    h("form", { class: "rule-add", on: { submit: add } }, input, h("button", { type: "submit", text: "Add" })),
    h("div", { class: "field-error", text: fieldErrors.get(key) ?? "" }),
    sorted.length
      ? h(
          "div",
          { class: "chips" },
          ...sorted.map((v) =>
            h(
              "span",
              { class: "chip" },
              `r/${v}`,
              h("button", {
                type: "button",
                text: "×",
                attrs: { "aria-label": `Remove ${v} from allowlist` },
                on: { click: () => commit((c) => removeFromAllowlist(c, v)) },
              }),
            ),
          ),
        )
      : h("p", { class: "empty", text: "No allowlisted subreddits." }),
  );
}

function renderGlobalSearch(): void {
  const out = byId("global-results");
  const q = stripSubredditPrefix(globalQuery).toLowerCase() || globalQuery.trim().toLowerCase();
  if (!q) {
    out.replaceChildren();
    return;
  }
  const rows: HTMLElement[] = [];
  for (const cat of config.categories) {
    for (const p of PANELS) {
      for (const v of listFor(cat, p.kind)) {
        if (!v.toLowerCase().includes(q)) continue;
        rows.push(
          h(
            "div",
            { class: "result-row" },
            h("strong", { text: p.kind === "subreddits" ? `r/${v}` : v }),
            h("span", { class: "muted", text: `${p.title.toLowerCase()} in “${cat.name}”${cat.enabled ? "" : " (off)"}` }),
            h("button", {
              type: "button",
              text: "Show",
              on: {
                click: () => {
                  selectedId = cat.id;
                  filters.set(`${cat.id}:${p.kind}`, v);
                  render();
                  byId("cat-editor").scrollIntoView({ behavior: "smooth", block: "start" });
                },
              },
            }),
            h("button", { type: "button", class: "danger", text: "Remove", on: { click: () => commit((c) => removeRule(c, cat.id, p.kind, v)) } }),
          ),
        );
      }
    }
  }
  for (const v of config.allowlist) {
    if (v.toLowerCase().includes(q)) {
      rows.push(h("div", { class: "result-row" }, h("strong", { text: `r/${v}` }), h("span", { class: "muted", text: "allowlist" })));
    }
  }
  out.replaceChildren(
    ...(rows.length ? rows.slice(0, 100) : [h("p", { class: "empty", text: "No rules contain that text." })]),
    rows.length > 100 ? h("p", { class: "empty", text: `…and ${rows.length - 100} more. Refine the search.` }) : "",
  );
}

function renderTester(): void {
  const sub = byId<HTMLInputElement>("test-sub").value.trim();
  const title = byId<HTMLInputElement>("test-title").value;
  const result = byId("test-result");
  result.classList.remove("blocked", "allowed");
  if (!sub && !title) {
    result.textContent = "Enter a subreddit and/or a title.";
    return;
  }
  const decision = evaluate({ subreddit: sub, title }, config);
  result.textContent = describeMatch(decision);
  result.classList.add(decision.blocked ? "blocked" : "allowed");
}

// ---- import / export -------------------------------------------------------

function exportConfig(): void {
  const blob = new Blob([serializeExport(config)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: `reddit-feed-curator-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function handleImport(text: string): void {
  const report = byId("import-report");
  const result = parseImport(text);
  if (!result.ok) {
    report.replaceChildren(
      h("p", { class: "err", text: "Import failed. Your current settings were not changed." }),
      h("ul", { class: "err" }, ...result.errors.map((e) => h("li", { text: e }))),
    );
    return;
  }
  const imported = result.config;
  const rules = imported.categories.reduce((n, c) => n + ruleTotal(c), 0);
  const confirmBtn = h("button", {
    type: "button",
    class: "primary",
    text: "Replace my settings",
    on: {
      click: () => {
        commit(() => imported);
        report.replaceChildren(h("p", { text: "Imported." }));
        notify("Settings imported.");
      },
    },
  });
  report.replaceChildren(
    h("p", { text: `Valid file: ${imported.categories.length} categories, ${rules} rules, ${imported.allowlist.length} allowlisted.` }),
    result.warnings.length
      ? h("details", {}, h("summary", { text: `${result.warnings.length} entries were skipped or cleaned up` }), h("ul", {}, ...result.warnings.map((w) => h("li", { text: w }))))
      : "",
    h("div", { class: "row" }, confirmBtn, h("button", { type: "button", text: "Cancel", on: { click: () => report.replaceChildren() } })),
  );
}

// ---- wiring ----------------------------------------------------------------

async function main(): Promise<void> {
  config = await loadConfig();

  byId("new-cat").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = byId<HTMLInputElement>("new-cat-name");
    try {
      const { config: next, id } = createCategory(config, input.value);
      selectedId = id;
      input.value = "";
      commit(() => next);
    } catch (err) {
      notify(err instanceof RuleError ? err.message : String(err), true);
    }
  });
  byId<HTMLInputElement>("global-search").addEventListener("input", (e) => {
    globalQuery = (e.target as HTMLInputElement).value;
    renderGlobalSearch();
  });
  byId("test-sub").addEventListener("input", renderTester);
  byId("test-title").addEventListener("input", renderTester);
  byId("export").addEventListener("click", exportConfig);
  byId<HTMLInputElement>("import-file").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) handleImport(await file.text());
    input.value = "";
  });
  byId("import-paste").addEventListener("click", () => handleImport(byId<HTMLTextAreaElement>("import-text").value));
  byId("reset").addEventListener("click", () => {
    if (confirm("Reset all categories, rules and settings to the defaults? Your custom rules will be lost (export first if unsure).")) {
      commit(() => createDefaultConfig());
      notify("Settings reset to defaults.");
    }
  });

  // Keep in sync with changes made from the popup or the in-feed menu.
  onConfigChanged((c) => {
    if (JSON.stringify(c) === JSON.stringify(config)) return;
    config = c;
    render();
  });

  render();
}

void main();
