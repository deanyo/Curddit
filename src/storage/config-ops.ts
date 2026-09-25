/**
 * Pure configuration edits shared by the options page, popup and in-feed
 * menu. Each returns a new Config (inputs are never mutated) or throws a
 * RuleError with a user-readable message.
 */

import {
  isValidKeyword,
  isValidPattern,
  isValidSubredditName,
  normalizeKeyword,
  normalizePattern,
  slugify,
  stripSubredditPrefix,
} from "../filtering/normalization";
import { noteSeedRemoval } from "./defaults";
import type { Category, CategoryRules, Config } from "./schema";

export class RuleError extends Error {}

export type RuleKind = keyof CategoryRules;
export type ListKind = RuleKind | "exclusions";

/** Validate and normalise a single rule value for the given list, or throw. */
export function normalizeRule(kind: ListKind, value: string): string {
  switch (kind) {
    case "subreddits": {
      const v = stripSubredditPrefix(value);
      if (!isValidSubredditName(v)) {
        throw new RuleError(`“${value}” is not a valid subreddit name (letters, digits and _ only, 2-21 characters).`);
      }
      return v;
    }
    case "patterns":
    case "exclusions": {
      const v = normalizePattern(value);
      if (!isValidPattern(v)) {
        throw new RuleError(`“${value}” is not a valid pattern. Use letters, digits, _ and the wildcards * and ?.`);
      }
      return v;
    }
    case "keywords": {
      const v = normalizeKeyword(value);
      if (!isValidKeyword(v)) throw new RuleError(`“${value}” is not a usable keyword.`);
      return v;
    }
  }
}

function mapCategory(config: Config, id: string, fn: (c: Category) => Category): Config {
  if (!config.categories.some((c) => c.id === id)) throw new RuleError(`Unknown category “${id}”.`);
  return { ...config, categories: config.categories.map((c) => (c.id === id ? fn(c) : c)) };
}

function getList(c: Category, kind: ListKind): string[] {
  return kind === "exclusions" ? c.exclusions : c.rules[kind];
}

function setList(c: Category, kind: ListKind, list: string[]): Category {
  return kind === "exclusions" ? { ...c, exclusions: list } : { ...c, rules: { ...c.rules, [kind]: list } };
}

/** Add a rule; returns the config unchanged (same object) if it is already present. */
export function addRule(config: Config, categoryId: string, kind: ListKind, value: string): Config {
  const v = normalizeRule(kind, value);
  const cat = config.categories.find((c) => c.id === categoryId);
  if (!cat) throw new RuleError(`Unknown category “${categoryId}”.`);
  if (getList(cat, kind).some((x) => x.toLowerCase() === v.toLowerCase())) return config;
  return mapCategory(config, categoryId, (c) => {
    let next = setList(c, kind, [...getList(c, kind), v]);
    // Re-adding a seed entry the user once removed: forget the removal.
    if (kind !== "exclusions" && next.seed) {
      const removed = next.seed.removed[kind].filter((x) => x.toLowerCase() !== v.toLowerCase());
      next = { ...next, seed: { ...next.seed, removed: { ...next.seed.removed, [kind]: removed } } };
    }
    return next;
  });
}

export function removeRule(config: Config, categoryId: string, kind: ListKind, value: string): Config {
  return mapCategory(config, categoryId, (c) => {
    const lower = value.toLowerCase();
    let next = setList(c, kind, getList(c, kind).filter((x) => x.toLowerCase() !== lower));
    if (kind !== "exclusions") next = noteSeedRemoval(next, kind, value);
    return next;
  });
}

export function setCategoryEnabled(config: Config, id: string, enabled: boolean): Config {
  return mapCategory(config, id, (c) => ({ ...c, enabled }));
}

export function updateCategoryMeta(config: Config, id: string, meta: { name?: string; description?: string }): Config {
  if (meta.name !== undefined && !meta.name.trim()) throw new RuleError("Category name cannot be empty.");
  return mapCategory(config, id, (c) => ({
    ...c,
    name: meta.name !== undefined ? meta.name.trim().slice(0, 100) : c.name,
    description: meta.description !== undefined ? meta.description.trim().slice(0, 500) : c.description,
  }));
}

export function createCategory(config: Config, name: string, description = ""): { config: Config; id: string } {
  const trimmed = name.trim();
  if (!trimmed) throw new RuleError("Category name cannot be empty.");
  if (config.categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new RuleError(`A category called “${trimmed}” already exists.`);
  }
  const base = `custom-${slugify(trimmed)}`;
  let id = base;
  for (let n = 2; config.categories.some((c) => c.id === id); n++) id = `${base}-${n}`;
  const category: Category = {
    id,
    name: trimmed.slice(0, 100),
    description: description.trim().slice(0, 500),
    enabled: true,
    rules: { subreddits: [], patterns: [], keywords: [] },
    exclusions: [],
  };
  return { config: { ...config, categories: [...config.categories, category] }, id };
}

export function deleteCategory(config: Config, id: string): Config {
  const cat = config.categories.find((c) => c.id === id);
  if (!cat) return config;
  return {
    ...config,
    categories: config.categories.filter((c) => c.id !== id),
    deletedSeeds: cat.seed ? [...new Set([...config.deletedSeeds, cat.seed.id])] : config.deletedSeeds,
  };
}

export function moveCategory(config: Config, id: string, delta: -1 | 1): Config {
  const i = config.categories.findIndex((c) => c.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= config.categories.length) return config;
  const categories = [...config.categories];
  [categories[i], categories[j]] = [categories[j]!, categories[i]!];
  return { ...config, categories };
}

export function addToAllowlist(config: Config, subreddit: string): Config {
  const v = normalizeRule("subreddits", subreddit);
  if (config.allowlist.some((x) => x.toLowerCase() === v.toLowerCase())) return config;
  return { ...config, allowlist: [...config.allowlist, v] };
}

export function removeFromAllowlist(config: Config, subreddit: string): Config {
  const k = stripSubredditPrefix(subreddit).toLowerCase();
  return { ...config, allowlist: config.allowlist.filter((x) => x.toLowerCase() !== k) };
}

/** The category used by the in-feed "Hide this subreddit" action. Created on first use. */
export const QUICK_BLOCK_ID = "custom-blocked";

export function ensureQuickBlockCategory(config: Config): Config {
  if (config.categories.some((c) => c.id === QUICK_BLOCK_ID)) return config;
  const category: Category = {
    id: QUICK_BLOCK_ID,
    name: "Blocked subreddits",
    description: "Subreddits hidden with the in-feed “Hide this subreddit” action.",
    enabled: true,
    rules: { subreddits: [], patterns: [], keywords: [] },
    exclusions: [],
  };
  return { ...config, categories: [...config.categories, category] };
}

/**
 * Block a subreddit via the in-feed menu. Also removes it from the allowlist,
 * and if the chosen category is disabled, enables it — the user's intent is
 * that the posts disappear now.
 */
export function quickBlock(config: Config, subreddit: string, categoryId: string = QUICK_BLOCK_ID): Config {
  let next = categoryId === QUICK_BLOCK_ID ? ensureQuickBlockCategory(config) : config;
  next = removeFromAllowlist(next, subreddit);
  next = addRule(next, categoryId, "subreddits", subreddit);
  next = setCategoryEnabled(next, categoryId, true);
  return next;
}

/** Total number of rules across enabled categories (for display). */
export function countActiveRules(config: Config): number {
  return config.categories
    .filter((c) => c.enabled)
    .reduce((n, c) => n + c.rules.subreddits.length + c.rules.patterns.length + c.rules.keywords.length, 0);
}
