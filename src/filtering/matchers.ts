/**
 * Rule matchers. All matchers are compiled once per configuration change and
 * are safe against pathological input: wildcards use a linear-time glob
 * matcher (no regular expressions built from user input), and keywords are
 * escaped literals joined into a single alternation.
 */

/**
 * Glob matcher supporting `*` (any run, including empty) and `?` (exactly one
 * character). Iterative with single-star backtracking: O(n*m) worst case,
 * no exponential blow-up regardless of how many stars the pattern contains.
 * Both inputs must already be lower-cased.
 */
export function globMatch(pattern: string, text: string): boolean {
  let p = 0;
  let t = 0;
  let starP = -1;
  let starT = 0;
  while (t < text.length) {
    const pc = pattern[p];
    if (pc === "?" || (pc !== undefined && pc !== "*" && pc === text[t])) {
      p++;
      t++;
    } else if (pc === "*") {
      starP = p++;
      starT = t;
    } else if (starP >= 0) {
      p = starP + 1;
      t = ++starT;
    } else {
      return false;
    }
  }
  while (pattern[p] === "*") p++;
  return p === pattern.length;
}

export interface CompiledPattern {
  /** Original pattern as the user wrote it (for reporting). */
  source: string;
  lower: string;
  /** Fast paths for the common shapes. */
  kind: "exact" | "prefix" | "suffix" | "contains" | "glob";
  literal: string;
}

export function compilePattern(source: string): CompiledPattern {
  const lower = source.toLowerCase();
  const inner = lower.slice(1, -1);
  if (!/[*?]/.test(lower)) return { source, lower, kind: "exact", literal: lower };
  if (!lower.includes("?")) {
    const stars = (lower.match(/\*/g) ?? []).length;
    if (stars === 1 && lower.endsWith("*")) return { source, lower, kind: "prefix", literal: lower.slice(0, -1) };
    if (stars === 1 && lower.startsWith("*")) return { source, lower, kind: "suffix", literal: lower.slice(1) };
    if (stars === 2 && lower.startsWith("*") && lower.endsWith("*") && !inner.includes("*")) {
      return { source, lower, kind: "contains", literal: inner };
    }
  }
  return { source, lower, kind: "glob", literal: "" };
}

/** `name` must be lower-case. */
export function patternMatches(p: CompiledPattern, name: string): boolean {
  switch (p.kind) {
    case "exact":
      return name === p.literal;
    case "prefix":
      return name.startsWith(p.literal);
    case "suffix":
      return name.endsWith(p.literal);
    case "contains":
      return name.includes(p.literal);
    case "glob":
      return globMatch(p.lower, name);
  }
}

/** Escape for use outside a character class in a `u`-flag regex (which rejects needless escapes like `\-`). */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Compile a list of keywords into a single case-insensitive regular expression.
 *
 * - Matching is whole-word / whole-phrase: a keyword must not be preceded or
 *   followed by a letter or digit ("art" does not match "party").
 * - Internal whitespace in a phrase matches any run of whitespace.
 * - A trailing `*` allows the last word to continue ("comic*" matches
 *   "comics", "comical").
 *
 * The regex is built only from escaped literals and fixed character classes,
 * so it cannot backtrack catastrophically.
 */
export class KeywordMatcher {
  private readonly regex: RegExp | null;
  private readonly byLower = new Map<string, string>();
  private readonly prefixes: { lower: string; source: string }[] = [];

  constructor(keywords: readonly string[]) {
    const parts: { source: string; len: number }[] = [];
    for (const kw of keywords) {
      const trimmed = kw.trim();
      if (!trimmed) continue;
      const isPrefix = trimmed.endsWith("*");
      const body = (isPrefix ? trimmed.replace(/\*+$/, "") : trimmed).trim();
      if (!body) continue;
      const lower = body.toLowerCase().replace(/\s+/g, " ");
      const escaped = body.split(/\s+/).map(escapeRegExp).join("\\s+");
      parts.push({ source: isPrefix ? `${escaped}[\\p{L}\\p{N}]*` : escaped, len: lower.length });
      if (isPrefix) this.prefixes.push({ lower, source: kw });
      else if (!this.byLower.has(lower)) this.byLower.set(lower, kw);
    }
    // Longer keywords first so "comic strip" is reported in preference to "comic" / "comic*".
    parts.sort((a, b) => b.len - a.len);
    this.regex = parts.length
      ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.map((p) => p.source).join("|")})(?![\\p{L}\\p{N}])`, "iu")
      : null;
  }

  get size(): number {
    return this.byLower.size + this.prefixes.length;
  }

  /** Returns the keyword (as the user wrote it) that matched, or null. */
  match(title: string): string | null {
    if (!this.regex || !title) return null;
    const m = this.regex.exec(title);
    if (!m) return null;
    const hit = m[0].toLowerCase().replace(/\s+/g, " ");
    const exact = this.byLower.get(hit);
    if (exact !== undefined) return exact;
    let best: { lower: string; source: string } | undefined;
    for (const p of this.prefixes) {
      if (hit.startsWith(p.lower) && (!best || p.lower.length > best.lower.length)) best = p;
    }
    return best?.source ?? m[0];
  }
}
