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
