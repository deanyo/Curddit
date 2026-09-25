import { createDefaultConfig } from "../src/storage/defaults";
import type { Category, Config } from "../src/storage/schema";

export function cat(partial: Partial<Category> & { id: string }): Category {
  return {
    name: partial.id,
    description: "",
    enabled: true,
    exclusions: [],
    ...partial,
    rules: { subreddits: [], patterns: [], keywords: [], ...partial.rules },
  };
}

export function config(categories: Category[], extra: Partial<Config> = {}): Config {
  return { ...createDefaultConfig(), categories, allowlist: [], ...extra };
}

/** Defaults with the given built-in categories switched on (all are off for new installs). */
export function defaultsWith(...ids: string[]): Config {
  const def = createDefaultConfig();
  return { ...def, categories: def.categories.map((c) => (ids.includes(c.id) ? { ...c, enabled: true } : c)) };
}
