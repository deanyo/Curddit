import { INDIA_PATTERNS_SEED, INDIA_SEED } from "../data/india";
import type { SeedCategory } from "../data/seed-types";
import { WEBCOMICS_SEED } from "../data/webcomics";
import { dedupeCaseInsensitive } from "../filtering/normalization";
import { CURRENT_SCHEMA_VERSION, type Category, type CategoryRules, type Config } from "./schema";

export const SEEDS: readonly SeedCategory[] = [INDIA_SEED, INDIA_PATTERNS_SEED, WEBCOMICS_SEED];

const RULE_KINDS = ["subreddits", "patterns", "keywords"] as const;

export function categoryFromSeed(seed: SeedCategory): Category {
  return {
    id: seed.id,
    name: seed.name,
    description: seed.description,
    enabled: seed.enabledByDefault,
    rules: {
      subreddits: dedupeCaseInsensitive(seed.rules.subreddits),
      patterns: dedupeCaseInsensitive(seed.rules.patterns),
      keywords: dedupeCaseInsensitive(seed.rules.keywords),
    },
    exclusions: dedupeCaseInsensitive(seed.exclusions),
    seed: { id: seed.id, version: seed.version, removed: { subreddits: [], patterns: [], keywords: [] } },
  };
}

export function createDefaultConfig(): Config {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    enabled: true,
    pausedUntil: null,
    scope: "popular",
    hideMode: "hide",
    showPostActions: true,
    categories: SEEDS.map(categoryFromSeed),
    allowlist: [],
    deletedSeeds: [],
  };
}

/**
 * Merge newer seed data into an existing configuration without overwriting
 * user choices:
 *  - Seed entries the user removed (tracked in `seed.removed`) are never re-added.
 *  - Name, description and enabled state are left as the user has them.
 *  - A built-in category the user deleted outright is not recreated.
 *  - Brand-new seed categories are added (with their default enabled state).
 */
export function mergeSeedUpdates(config: Config, seeds: readonly SeedCategory[] = SEEDS): { config: Config; changed: boolean } {
  let changed = false;
  const categories = config.categories.map((cat) => {
    const seed = cat.seed && seeds.find((s) => s.id === cat.seed!.id);
    if (!seed || !cat.seed || cat.seed.version >= seed.version) return cat;
    changed = true;
    const rules: CategoryRules = { ...cat.rules };
    for (const kind of RULE_KINDS) {
      const removed = new Set(cat.seed.removed[kind].map((r) => r.toLowerCase()));
      rules[kind] = dedupeCaseInsensitive([
        ...cat.rules[kind],
        ...seed.rules[kind].filter((r) => !removed.has(r.toLowerCase())),
      ]);
    }
    return {
      ...cat,
      rules,
      exclusions: dedupeCaseInsensitive([...cat.exclusions, ...seed.exclusions]),
      seed: { ...cat.seed, version: seed.version },
    };
  });

  const deleted = new Set(config.deletedSeeds);
  for (const seed of seeds) {
    const present = categories.some((c) => c.seed?.id === seed.id || c.id === seed.id);
    if (!present && !deleted.has(seed.id)) {
      categories.push(categoryFromSeed(seed));
      changed = true;
    }
  }
  return { config: changed ? { ...config, categories } : config, changed };
}

/**
 * Record that the user removed a rule from a built-in category, so later seed
 * updates never bring it back (whether or not the current seed contains it).
 */
export function noteSeedRemoval(cat: Category, kind: keyof CategoryRules, value: string): Category {
  if (!cat.seed) return cat;
  const removed = { ...cat.seed.removed, [kind]: dedupeCaseInsensitive([...cat.seed.removed[kind], value]) };
  return { ...cat, seed: { ...cat.seed, removed } };
}
