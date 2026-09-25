/**
 * Standalone filtering engine. Knows nothing about the DOM or browser APIs:
 * it takes a configuration, compiles it once, and evaluates structured post
 * metadata into a decision.
 *
 * Evaluation order (first hit wins):
 *   1. Master switch / pause -> nothing is blocked.
 *   2. Global allowlist      -> never blocked.
 *   3. Exact subreddit rules across all enabled categories.
 *   4. Wildcard pattern rules across all enabled categories.
 *   5. Title keyword rules across all enabled categories.
 * Within a tier, categories are checked in the order they appear in the
 * configuration. A category's own exclusions only exempt a post from that
 * category, so another category can still match it.
 *
 * Checking the most specific rule type first means the reported reason is the
 * most precise one available (an exact rule beats a broad pattern that also
 * happens to match).
 *
 * Extension point: future classifiers (e.g. local image classification) can be
 * added as an extra tier consuming the optional PostMetadata fields; they must
 * not change the synchronous contract of the existing tiers.
 */

import type { Config } from "../storage/schema";
import { compilePattern, KeywordMatcher, patternMatches, type CompiledPattern } from "./matchers";
import { stripSubredditPrefix, subredditKey } from "./normalization";

export interface PostMetadata {
  subreddit: string;
  title: string;
  url?: string;
  postId?: string;
  /** Optional extras extracted when available; unused by current rule types. */
  postType?: string;
  domain?: string;
  flair?: string;
}

export type MatchType = "exact_subreddit" | "subreddit_pattern" | "title_keyword";

export type FilterDecision =
  | { blocked: false; reason?: "disabled" | "paused" | "allowlisted" | "no_match" }
  | { blocked: true; category: string; categoryName: string; matchedRule: string; matchType: MatchType };

interface CompiledCategory {
  id: string;
  name: string;
  subreddits: Map<string, string>; // lower -> original
  patterns: CompiledPattern[];
  keywords: KeywordMatcher;
  exclusions: CompiledPattern[];
}

export interface CompiledRules {
  active: boolean;
  inactiveReason?: "disabled" | "paused";
  pausedUntil: number | null;
  allowlist: Set<string>;
  categories: CompiledCategory[];
  ruleCount: number;
}

export function compileRules(config: Config, now: number = Date.now()): CompiledRules {
  const paused = config.pausedUntil !== null && config.pausedUntil > now;
  const categories: CompiledCategory[] = [];
  let ruleCount = 0;
  for (const cat of config.categories) {
    if (!cat.enabled) continue;
    const subreddits = new Map<string, string>();
    for (const s of cat.rules.subreddits) {
      const k = subredditKey(s);
      if (k && !subreddits.has(k)) subreddits.set(k, stripSubredditPrefix(s));
    }
    const patterns = dedupeBy(cat.rules.patterns.filter(Boolean), (p) => p.toLowerCase()).map(compilePattern);
    const keywords = new KeywordMatcher(cat.rules.keywords);
    ruleCount += subreddits.size + patterns.length + keywords.size;
    categories.push({
      id: cat.id,
      name: cat.name,
      subreddits,
      patterns,
      keywords,
      exclusions: cat.exclusions.map((e) => stripSubredditPrefix(e)).filter(Boolean).map(compilePattern),
    });
  }
  return {
    active: config.enabled && !paused,
    inactiveReason: !config.enabled ? "disabled" : paused ? "paused" : undefined,
    pausedUntil: paused ? config.pausedUntil : null,
    allowlist: new Set(config.allowlist.map(subredditKey).filter(Boolean)),
    categories,
    ruleCount,
  };
}

export function evaluatePost(post: PostMetadata, rules: CompiledRules): FilterDecision {
  if (!rules.active) return { blocked: false, reason: rules.inactiveReason };
  const sub = subredditKey(post.subreddit ?? "");
  if (sub && rules.allowlist.has(sub)) return { blocked: false, reason: "allowlisted" };

  const applicable = rules.categories.filter((c) => !sub || !c.exclusions.some((e) => patternMatches(e, sub)));

  if (sub) {
    for (const c of applicable) {
      const original = c.subreddits.get(sub);
      if (original !== undefined) return block(c, original, "exact_subreddit");
    }
    for (const c of applicable) {
      for (const p of c.patterns) {
        if (patternMatches(p, sub)) return block(c, p.source, "subreddit_pattern");
      }
    }
  }
  const title = post.title ?? "";
  if (title) {
    for (const c of applicable) {
      const kw = c.keywords.match(title);
      if (kw !== null) return block(c, kw, "title_keyword");
    }
  }
  return { blocked: false, reason: "no_match" };
}

/** Convenience wrapper for one-off evaluations (tests, rule tester UI). */
export function evaluate(post: PostMetadata, config: Config, now?: number): FilterDecision {
  return evaluatePost(post, compileRules(config, now));
}

function block(c: CompiledCategory, matchedRule: string, matchType: MatchType): FilterDecision {
  return { blocked: true, category: c.id, categoryName: c.name, matchedRule, matchType };
}

function dedupeBy<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = key(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function describeMatch(d: FilterDecision): string {
  if (!d.blocked) {
    switch (d.reason) {
      case "disabled":
        return "Not blocked: filtering is switched off.";
      case "paused":
        return "Not blocked: filtering is paused.";
      case "allowlisted":
        return "Not blocked: subreddit is on the allowlist.";
      default:
        return "Not blocked: no rule matches.";
    }
  }
  const kind =
    d.matchType === "exact_subreddit"
      ? "exact subreddit rule"
      : d.matchType === "subreddit_pattern"
        ? "wildcard pattern"
        : "title keyword";
  return `Blocked by ${kind} “${d.matchedRule}” in “${d.categoryName}”.`;
}
