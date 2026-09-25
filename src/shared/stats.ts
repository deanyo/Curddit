import { LIFETIME_STATS_KEY, SESSION_STATS_KEY, type LifetimeStats, type SessionStats } from "../storage/schema";

export function emptySessionStats(): SessionStats {
  return { totalHidden: 0, byCategory: {} };
}

export async function readSessionStats(): Promise<SessionStats> {
  const got = await browser.storage.session.get(SESSION_STATS_KEY);
  return (got[SESSION_STATS_KEY] as SessionStats | undefined) ?? emptySessionStats();
}

export async function readLifetimeStats(): Promise<LifetimeStats> {
  const got = await browser.storage.local.get(LIFETIME_STATS_KEY);
  return (got[LIFETIME_STATS_KEY] as LifetimeStats | undefined) ?? { totalHidden: 0 };
}
