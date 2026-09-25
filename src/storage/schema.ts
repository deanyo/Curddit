/**
 * Versioned configuration schema.
 *
 * The whole user configuration lives under a single `config` key in
 * browser.storage.local. Statistics live under separate keys so that counting
 * hidden posts never triggers a rule reload in every open tab.
 */

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Which Reddit listings are filtered. Each level includes the previous ones:
 *  - popular:     /r/popular only
 *  - popular_all: /r/popular and /r/all
 *  - home:        the above plus the home feed (/, /best, /hot, ...)
 *  - all_feeds:   the above plus multireddits / custom feeds / r/a+b combos
 *
 * Single-subreddit pages and comment pages are never filtered, so visiting a
 * blocked community directly always works.
 */
export type FeedScope = "popular" | "popular_all" | "home" | "all_feeds";
export const FEED_SCOPES: readonly FeedScope[] = ["popular", "popular_all", "home", "all_feeds"];

/** "hide" removes posts from view; "dim" leaves them visible but faded (useful for checking rules). */
export type HideMode = "hide" | "dim";
export const HIDE_MODES: readonly HideMode[] = ["hide", "dim"];

export interface CategoryRules {
  /** Exact subreddit names (stored without the r/ prefix, case preserved for display). */
  subreddits: string[];
  /** Wildcard patterns on subreddit names. `*` = any run of characters, `?` = one character. */
  patterns: string[];
  /** Whole-word / phrase matches on post titles. A trailing `*` allows word-prefix matches. */
  keywords: string[];
}

export interface Category {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rules: CategoryRules;
  /**
   * Subreddits exempt from this category only (the global allowlist exempts from every category).
   * Wildcards are allowed here too, e.g. `Indiana*` to carve out false positives of a broad pattern.
   */
  exclusions: string[];
  /**
   * For built-in categories: the id of the seed dataset this category came from,
   * the seed version last merged, and seed entries the user deliberately removed
   * (so a seed update never re-adds them).
   */
  seed?: {
    id: string;
    version: number;
    removed: { subreddits: string[]; patterns: string[]; keywords: string[] };
  };
}

export interface Config {
  schemaVersion: number;
  /** Master switch. */
  enabled: boolean;
  /** Epoch ms; filtering is suspended until then. null = not paused. */
  pausedUntil: number | null;
  scope: FeedScope;
  hideMode: HideMode;
  /** Show the extension's small action button on feed posts. */
  showPostActions: boolean;
  categories: Category[];
  /** Subreddits never filtered by any category. Takes precedence over every rule. */
  allowlist: string[];
  /** Ids of built-in seed categories the user deleted; they are not recreated on update. */
  deletedSeeds: string[];
}

/** Session statistics, kept in storage.session by the background script. */
export interface SessionStats {
  totalHidden: number;
  byCategory: Record<string, number>;
}

/** Persistent statistics, kept in storage.local under STATS_KEY. */
export interface LifetimeStats {
  totalHidden: number;
}

export const CONFIG_KEY = "config";
export const LIFETIME_STATS_KEY = "lifetimeStats";
export const SESSION_STATS_KEY = "sessionStats";
