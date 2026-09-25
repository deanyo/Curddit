/**
 * Applies filtering decisions to the page and keeps them up to date as Reddit
 * inserts posts (infinite scroll), navigates client-side, or the rules change.
 *
 * - Posts are hidden by marking their container with a data attribute; CSS
 *   (content.css) does the hiding. Nothing is removed from the DOM, so
 *   Reddit's own rendering logic is unaffected.
 * - A WeakMap records, per post element, the signature (id + subreddit +
 *   title) and rule version it was last evaluated with, so repeated mutations
 *   don't cause repeated work and removed elements are garbage-collected.
 * - Rule changes bump `version` and re-evaluate posts currently in the DOM,
 *   which also un-hides posts whose category was switched off.
 * - Each post is reported for statistics at most once per tab (bounded set);
 *   the background script de-duplicates again across tabs.
 */

import { compileRules, evaluatePost, type CompiledRules, type FilterDecision } from "../filtering/engine";
import type { HiddenPostReport } from "../shared/messages";
import type { Config } from "../storage/schema";
import { classifyPage, scopeIncludes, type PageKind } from "./feed-scope";
import { extractPost, hideTarget, isFeedPost, POST_SELECTOR, separatorAfter, type ExtractedPost } from "./reddit-adapter";

export const HIDDEN_ATTR = "data-rfc-hidden";
export const LABEL_ATTR = "data-rfc-label";
const SEPARATOR_ATTR = "data-rfc-hidden-sep";
const MODE_ATTR = "data-rfc-mode";

/** Attributes whose late arrival / change should trigger re-evaluation. */
const WATCHED_ATTRIBUTES = ["subreddit-prefixed-name", "subreddit-name", "post-title", "permalink", "data-subreddit"];

const MAX_TRACKED_KEYS = 5000;

interface ProcessedInfo {
  signature: string;
  version: number;
}

export interface FeedFilterOptions {
  /** Called with batches of newly hidden posts (for statistics). */
  onHidden?: (items: HiddenPostReport[], tabHiddenCount: number) => void;
  /** Called when the tab's hidden count changes for reasons other than new hides (navigation reset). */
  onCountReset?: (tabHiddenCount: number) => void;
  /** Delay before flushing statistics reports. */
  reportDelayMs?: number;
  doc?: Document;
  getHref?: () => string;
}

export class FeedFilter {
  private readonly doc: Document;
  private readonly getHref: () => string;
  private config: Config | null = null;
  private rules: CompiledRules | null = null;
  private version = 0;
  private page: PageKind;
  private lastHref: string;
  private readonly processed = new WeakMap<Element, ProcessedInfo>();
  private readonly tabHiddenKeys = new Set<string>();
  private readonly reportedKeys = new Set<string>();
  private pendingReports: HiddenPostReport[] = [];
  private lastReportedTabCount = 0;
  private reportTimer: ReturnType<typeof setTimeout> | null = null;
  private observer: MutationObserver | null = null;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: FeedFilterOptions = {}) {
    this.doc = options.doc ?? document;
    this.getHref = options.getHref ?? (() => location.href);
    this.lastHref = this.getHref();
    this.page = classifyPage(this.lastHref);
  }

  /** Whether filtering is currently applied on this page. */
  get isActive(): boolean {
    return !!this.rules?.active && !!this.config && scopeIncludes(this.config.scope, this.page);
  }

  get pageKind(): PageKind {
    return this.page;
  }

  get hiddenCount(): number {
    return this.tabHiddenKeys.size;
  }

  setConfig(config: Config): void {
    this.config = config;
    this.rules = compileRules(config);
    this.doc.documentElement.setAttribute(MODE_ATTR, config.hideMode);
    this.schedulePauseExpiry();
    this.reevaluateAll();
  }

  start(): void {
    if (this.observer) return;
    this.observer = new MutationObserver((records) => this.onMutations(records));
    this.observer.observe(this.doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: WATCHED_ATTRIBUTES,
    });
    this.reevaluateAll();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.reportTimer) clearTimeout(this.reportTimer);
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.flushReports();
  }

  /**
   * Check whether the URL changed (client-side navigation). Called on every
   * mutation batch and from popstate / a slow interval as a fallback.
   */
  checkNavigation(): void {
    const href = this.getHref();
    if (href === this.lastHref) return;
    this.lastHref = href;
    const page = classifyPage(href);
    const wasActive = this.isActive;
    this.page = page;
    // The badge reflects posts hidden on the current feed.
    if (this.tabHiddenKeys.size) {
      this.tabHiddenKeys.clear();
      this.lastReportedTabCount = 0;
      this.options.onCountReset?.(0);
    }
    if (wasActive !== this.isActive || wasActive) this.reevaluateAll();
  }

  /** Re-evaluate every post currently in the document against the current rules. */
  reevaluateAll(): void {
    this.version++;
    for (const el of this.doc.querySelectorAll(POST_SELECTOR)) this.processPost(el);
    // Clean up anything we hid whose post has gone (e.g. element recycled into something else).
    for (const el of this.doc.querySelectorAll(`[${HIDDEN_ATTR}]`)) {
      const post = el.matches(POST_SELECTOR) ? el : el.querySelector(POST_SELECTOR);
      if (!post) this.unhideTarget(el);
    }
  }

  /** Decision for a post element under the current rules and page (used by the in-feed menu). */
  decisionFor(post: ExtractedPost): FilterDecision | null {
    return this.rules ? evaluatePost(post, this.rules) : null;
  }

  private onMutations(records: MutationRecord[]): void {
    this.checkNavigation();
    for (const rec of records) {
      if (rec.type === "attributes") {
        const t = rec.target as Element;
        if (t.matches(POST_SELECTOR)) this.processPost(t);
        continue;
      }
      for (const node of rec.addedNodes) {
        if (node.nodeType !== 1) continue;
        const el = node as Element;
        if (el.matches(POST_SELECTOR)) this.processPost(el);
        else if (el.firstElementChild) for (const p of el.querySelectorAll(POST_SELECTOR)) this.processPost(p);
      }
    }
  }

  private processPost(el: Element): void {
    if (!this.rules || !this.config) return;
    if (!isFeedPost(el)) return;
    const post = extractPost(el);
    if (!post) return; // attributes not rendered yet; the attribute observer will retry
    const signature = `${post.key}\u0000${post.subreddit}\u0000${post.title}`;
    const prev = this.processed.get(el);
    if (prev && prev.signature === signature && prev.version === this.version) return;
    this.processed.set(el, { signature, version: this.version });

    const decision: FilterDecision = this.isActive ? evaluatePost(post, this.rules) : { blocked: false };
    const target = hideTarget(el);
    if (decision.blocked) {
      target.setAttribute(HIDDEN_ATTR, decision.category);
      target.setAttribute(LABEL_ATTR, `Hidden: r/${post.subreddit} (${decision.categoryName})`);
      separatorAfter(target)?.setAttribute(SEPARATOR_ATTR, "");
      this.noteHidden(post.key, decision.category);
    } else if (target.hasAttribute(HIDDEN_ATTR)) {
      this.unhideTarget(target);
    }
  }

  private unhideTarget(target: Element): void {
    target.removeAttribute(HIDDEN_ATTR);
    target.removeAttribute(LABEL_ATTR);
    separatorAfter(target)?.removeAttribute(SEPARATOR_ATTR);
  }

  private noteHidden(key: string, category: string): void {
    const tabCountBefore = this.tabHiddenKeys.size;
    if (tabCountBefore < MAX_TRACKED_KEYS) this.tabHiddenKeys.add(key);
    if (!this.reportedKeys.has(key)) {
      this.reportedKeys.add(key);
      if (this.reportedKeys.size > MAX_TRACKED_KEYS) {
        // Drop the oldest entry (Sets iterate in insertion order).
        const oldest = this.reportedKeys.values().next().value;
        if (oldest !== undefined) this.reportedKeys.delete(oldest);
      }
      this.pendingReports.push({ key, category });
    } else if (this.tabHiddenKeys.size === tabCountBefore) {
      return; // nothing new to report or display
    }
    if (!this.reportTimer) {
      this.reportTimer = setTimeout(() => this.flushReports(), this.options.reportDelayMs ?? 400);
    }
  }

  /** Sends pending reports; an empty `items` batch just updates the tab count. */
  flushReports(): void {
    if (this.reportTimer) clearTimeout(this.reportTimer);
    this.reportTimer = null;
    const items = this.pendingReports;
    this.pendingReports = [];
    if (!items.length && this.tabHiddenKeys.size === this.lastReportedTabCount) return;
    this.lastReportedTabCount = this.tabHiddenKeys.size;
    this.options.onHidden?.(items, this.tabHiddenKeys.size);
  }

  /** When a pause expires, filtering must resume without any user action. */
  private schedulePauseExpiry(): void {
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
    const until = this.config?.pausedUntil;
    if (!until || !this.config) return;
    const delay = until - Date.now();
    if (delay <= 0) return;
    const config = this.config;
    // setTimeout caps at ~24.8 days; longer pauses re-arm on the next config load.
    this.pauseTimer = setTimeout(() => this.setConfig(config), Math.min(delay + 50, 2 ** 31 - 1));
  }
}
