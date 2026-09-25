/**
 * Counts hidden posts. Session counts live in storage.session (cleared when
 * the browser closes); the lifetime total lives in storage.local.
 *
 * A post is counted once per browser session no matter how many times it is
 * re-rendered, re-evaluated or seen in different tabs: its key goes into a
 * bounded "seen" list, also kept in storage.session so it survives the
 * background event page being unloaded.
 */

import type { HiddenPostReport } from "../shared/messages";
import { emptySessionStats, readLifetimeStats, readSessionStats } from "../shared/stats";
import { LIFETIME_STATS_KEY, SESSION_STATS_KEY } from "../storage/schema";

const SEEN_KEY = "seenPostKeys";
export const MAX_SEEN = 5000;

let chain: Promise<unknown> = Promise.resolve();

/** Serialise all updates so concurrent reports from several tabs can't lose counts. */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn);
  chain = run.catch((e) => console.error("[Reddit Feed Curator] stats update failed", e));
  return run;
}

export function recordHidden(items: HiddenPostReport[]): Promise<number> {
  return serial(async () => {
    const got = await browser.storage.session.get(SEEN_KEY);
    const seenList = (got[SEEN_KEY] as string[] | undefined) ?? [];
    const seen = new Set(seenList);
    const fresh = items.filter((i) => {
      if (!i.key || seen.has(i.key)) return false;
      seen.add(i.key);
      seenList.push(i.key);
      return true;
    });
    if (!fresh.length) return 0;
    const session = await readSessionStats();
    const lifetime = await readLifetimeStats();
    for (const item of fresh) {
      session.totalHidden++;
      session.byCategory[item.category] = (session.byCategory[item.category] ?? 0) + 1;
    }
    lifetime.totalHidden += fresh.length;
    await browser.storage.session.set({
      [SEEN_KEY]: seenList.slice(-MAX_SEEN),
      [SESSION_STATS_KEY]: session,
    });
    await browser.storage.local.set({ [LIFETIME_STATS_KEY]: lifetime });
    return fresh.length;
  });
}

/** Reset session statistics. Previously seen posts stay seen, so they are not recounted. */
export function resetSessionStats(): Promise<void> {
  return serial(async () => {
    await browser.storage.session.set({ [SESSION_STATS_KEY]: emptySessionStats() });
  });
}
