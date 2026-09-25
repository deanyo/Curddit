/**
 * Thin wrapper around browser.storage.local for the configuration.
 * Loading always returns a valid, migrated, seed-merged Config; if stored
 * data is unusable, defaults are used (and the bad data is left in place
 * under a backup key rather than silently destroyed).
 */

import { createDefaultConfig, mergeSeedUpdates } from "./defaults";
import { CONFIG_KEY, type Config } from "./schema";
import { validateConfig } from "./validation";

const BACKUP_KEY = "config_invalid_backup";

export async function loadConfig(): Promise<Config> {
  const stored = await browser.storage.local.get(CONFIG_KEY);
  const raw = stored[CONFIG_KEY];
  if (raw === undefined) {
    const fresh = createDefaultConfig();
    await browser.storage.local.set({ [CONFIG_KEY]: fresh });
    return fresh;
  }
  const result = validateConfig(raw);
  if (!result.ok) {
    console.warn("[Feed Curator for Reddit] Stored configuration invalid, using defaults:", result.errors);
    const fresh = createDefaultConfig();
    await browser.storage.local.set({ [BACKUP_KEY]: raw, [CONFIG_KEY]: fresh });
    return fresh;
  }
  const merged = mergeSeedUpdates(result.config);
  const migrated = (raw as { schemaVersion?: unknown }).schemaVersion !== result.config.schemaVersion;
  if (merged.changed || migrated) await saveConfig(merged.config);
  return merged.config;
}

export async function saveConfig(config: Config): Promise<void> {
  await browser.storage.local.set({ [CONFIG_KEY]: config });
}

/** Serialised read-modify-write, so rapid edits from one page don't clobber each other. */
let queue: Promise<unknown> = Promise.resolve();
export function updateConfig(fn: (c: Config) => Config): Promise<Config> {
  const run = queue.then(async () => {
    const current = await loadConfig();
    const next = fn(current);
    if (next !== current) await saveConfig(next);
    return next;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Subscribe to configuration changes made from any extension page or tab. */
export function onConfigChanged(cb: (config: Config) => void): () => void {
  const listener = (changes: Record<string, browser.storage.StorageChange>, area: string) => {
    if (area !== "local" || !(CONFIG_KEY in changes)) return;
    const result = validateConfig(changes[CONFIG_KEY]!.newValue);
    if (result.ok) cb(result.config);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
