/**
 * Classifies the current Reddit URL and decides whether filtering applies.
 * Works for both the current frontend and old.reddit.com (same URL scheme).
 */

import type { FeedScope } from "../storage/schema";

export type PageKind =
  | "popular"
  | "all"
  | "home"
  | "multi" // r/a+b, custom feeds / multireddits, r/<x>/ listings aggregating several subs
  | "subreddit" // a single community's own listing: never filtered
  | "post" // comments page: never filtered
  | "other"; // search, user profiles, settings, etc.: never filtered

const HOME_SORTS = new Set(["best", "hot", "new", "top", "rising", "controversial"]);

export function classifyPage(href: string): PageKind {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return "other";
  }
  const parts = url.pathname.split("/").filter(Boolean).map((p) => p.toLowerCase());
  const [first, second, third] = parts;

  if (!first) return "home";
  if (parts.length === 1 && HOME_SORTS.has(first)) return "home";

  if (first === "r" && second) {
    if (third === "comments") return "post";
    if (second === "popular") return "popular";
    if (second === "all") return "all";
    if (second.includes("+") || second.startsWith("all-")) return "multi";
    return "subreddit";
  }
  // Multireddits / custom feeds: /user/<name>/m/<feed>/ or /u/<name>/m/<feed>/
  if ((first === "user" || first === "u") && third === "m" && parts.length >= 4) return "multi";
  if (first === "me" && second === "m") return "multi";
  if (first === "news") return "multi";
  return "other";
}

const SCOPE_PAGES: Record<FeedScope, ReadonlySet<PageKind>> = {
  popular: new Set(["popular"]),
  popular_all: new Set(["popular", "all"]),
  home: new Set(["popular", "all", "home"]),
  all_feeds: new Set(["popular", "all", "home", "multi"]),
};

export function scopeIncludes(scope: FeedScope, page: PageKind): boolean {
  return SCOPE_PAGES[scope].has(page);
}

export const SCOPE_LABELS: Record<FeedScope, string> = {
  popular: "Popular only",
  popular_all: "Popular and All",
  home: "Popular, All and Home feed",
  all_feeds: "All Reddit feeds (incl. custom feeds and multireddits)",
};
