/**
 * Normalisation helpers shared by the engine, storage validation and UI.
 */

/** Valid subreddit names: letters, digits, underscore. Reddit allows 3-21; a few legacy subs are 2. */
const SUBREDDIT_NAME = /^[A-Za-z0-9_]{2,21}$/;
/** Patterns: subreddit characters plus `*` and `?` wildcards. */
const SUBREDDIT_PATTERN = /^[A-Za-z0-9_*?]{1,40}$/;

/**
 * Turn any common spelling of a subreddit into its bare name, preserving case:
 *   "r/TeenIndia", "/r/TeenIndia/", "TeenIndia",
 *   "https://www.reddit.com/r/TeenIndia/comments/..." -> "TeenIndia"
 * Returns "" when nothing usable remains.
 */
export function stripSubredditPrefix(input: string): string {
  let s = input.trim();
  s = s.replace(/^https?:\/\/(?:[a-z0-9-]+\.)*reddit\.com/i, "");
  s = s.replace(/^\/+/, "");
  s = s.replace(/^r\//i, "");
  // Anything after the name (e.g. "/comments/...", "/", "?x") is dropped. Internal
  // whitespace is kept so that "not a sub" is rejected rather than read as "not".
  const slash = s.search(/[/?#]/);
  if (slash >= 0) s = s.slice(0, slash);
  return s;
}

/** Canonical comparison key for a subreddit (lower-case bare name). */
export function subredditKey(input: string): string {
  return stripSubredditPrefix(input).toLowerCase();
}

export function isValidSubredditName(name: string): boolean {
  return SUBREDDIT_NAME.test(name);
}

/** Normalise a pattern: strip r/ prefix, collapse repeated `*`. */
export function normalizePattern(input: string): string {
  return stripSubredditPrefix(input).replace(/\*{2,}/g, "*");
}

export function isValidPattern(pattern: string): boolean {
  return SUBREDDIT_PATTERN.test(pattern) && /[A-Za-z0-9_]/.test(pattern);
}

/** Normalise a keyword: trim and collapse internal whitespace. Case is preserved for display. */
export function normalizeKeyword(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

export function isValidKeyword(keyword: string): boolean {
  // Must contain at least one letter or digit, and not be absurdly long.
  return keyword.length > 0 && keyword.length <= 100 && /[\p{L}\p{N}]/u.test(keyword);
}

/** Case-insensitive de-duplication, keeping the first spelling seen. */
export function dedupeCaseInsensitive(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

/** Stable slug for new category ids. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "category";
}
