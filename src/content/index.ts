/**
 * Content script entry point (runs at document_start on Reddit pages).
 * Loads the configuration once, keeps it cached in memory, and re-applies it
 * whenever it changes in storage (from the popup, options page or another tab).
 */

import type { ContentMessage } from "../shared/messages";
import { loadConfig, onConfigChanged } from "../storage/config-store";
import type { Config } from "../storage/schema";
import { FeedFilter } from "./feed-observer";
import { PostActions } from "./post-actions";

let config: Config | null = null;

function send(message: ContentMessage): void {
  browser.runtime.sendMessage(message).catch(() => undefined); // background may be restarting
}

const filter = new FeedFilter({
  onHidden: (items, tabHiddenCount) =>
    send(items.length ? { type: "posts-hidden", items, tabHiddenCount } : { type: "tab-count", tabHiddenCount }),
  onCountReset: (tabHiddenCount) => send({ type: "tab-count", tabHiddenCount }),
});

const actions = new PostActions(() => config);

function apply(next: Config): void {
  config = next;
  filter.setConfig(next);
  actions.setEnabled(next.enabled && next.showPostActions);
}

async function init(): Promise<void> {
  apply(await loadConfig());
  filter.start();
  actions.mount();
  onConfigChanged(apply);

  // Client-side navigation: mutation batches catch most route changes; these are fallbacks.
  addEventListener("popstate", () => filter.checkNavigation());
  setInterval(() => filter.checkNavigation(), 1000);
  addEventListener("pagehide", () => filter.flushReports());
}

init().catch((e) => console.error("[Feed Curator for Reddit] failed to start", e));
