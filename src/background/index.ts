/**
 * Background event page. Responsibilities are deliberately small:
 *  - initialise / migrate the stored configuration on install and update,
 *  - aggregate hidden-post statistics reported by content scripts,
 *  - show a per-tab badge with the number of posts hidden in that tab,
 *  - open the options page on request from the in-feed menu.
 * It never makes network requests.
 */

import { isContentMessage } from "../shared/messages";
import { loadConfig } from "../storage/config-store";
import { recordHidden, resetSessionStats } from "./stats-tracker";

browser.runtime.onInstalled.addListener((details) => {
  void loadConfig().then(() => {
    // First install only (not updates or temporary reloads): let the user pick categories.
    if (details.reason === "install" && !details.temporary) {
      void browser.tabs.create({ url: browser.runtime.getURL("welcome/welcome.html") });
    }
  });
});

browser.action.setBadgeBackgroundColor({ color: "#5f6368" }).catch(() => undefined);

browser.runtime.onMessage.addListener((message: unknown, sender) => {
  if (sender.id !== browser.runtime.id) return;
  if (isContentMessage(message)) {
    const tabId = sender.tab?.id;
    switch (message.type) {
      case "posts-hidden":
        setBadge(tabId, message.tabHiddenCount);
        return recordHidden(message.items).then(() => undefined);
      case "tab-count":
        setBadge(tabId, message.tabHiddenCount);
        return;
      case "open-options":
        return browser.runtime.openOptionsPage();
    }
  }
  if ((message as { type?: string })?.type === "reset-session-stats") return resetSessionStats();
  return;
});

function setBadge(tabId: number | undefined, count: number): void {
  if (tabId === undefined) return;
  const text = count > 0 ? (count > 999 ? "999+" : String(count)) : "";
  browser.action.setBadgeText({ tabId, text }).catch(() => undefined);
}
