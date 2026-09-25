/**
 * Validation and sanitisation of configuration objects, used both for stored
 * data (defensive) and for user imports (with readable error messages).
 *
 * Fatal problems (not an object, wrong types for core fields, unknown future
 * schema) produce errors and no config. Individual bad entries (an invalid
 * subreddit name, a duplicate rule) are dropped with a warning so a mostly
 * valid file can still be imported.
 */

import {
  dedupeCaseInsensitive,
  isValidKeyword,
  isValidPattern,
  isValidSubredditName,
  normalizeKeyword,
  normalizePattern,
  slugify,
  stripSubredditPrefix,
} from "../filtering/normalization";
import { migrate, MigrationError } from "./migrations";
import {
  CURRENT_SCHEMA_VERSION,
  FEED_SCOPES,
  HIDE_MODES,
  type Category,
  type Config,
  type FeedScope,
  type HideMode,
} from "./schema";

export const EXPORT_FORMAT = "reddit-feed-curator";

export type ValidationResult =
  | { ok: true; config: Config; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);

/** Parse text from an import file. Accepts the export envelope or a bare config. */
export function parseImport(text: string): ValidationResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, errors: [`The file is not valid JSON: ${msg}`], warnings: [] };
  }
  if (isObj(data) && data.format === EXPORT_FORMAT) {
    if (!isObj(data.config)) return { ok: false, errors: ["Export file has no \"config\" object."], warnings: [] };
    data = data.config;
  }
  return validateConfig(data);
}

export function serializeExport(config: Config): string {
  return JSON.stringify({ format: EXPORT_FORMAT, exportedAt: new Date().toISOString(), config }, null, 2);
}

export function validateConfig(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObj(input)) {
    return { ok: false, errors: ["Configuration must be a JSON object."], warnings };
  }
  let raw: Raw;
  try {
    raw = migrate(structuredClone(input));
  } catch (e) {
    const msg = e instanceof MigrationError ? e.message : `Migration failed: ${String(e)}`;
    return { ok: false, errors: [msg], warnings };
  }

  const bool = (key: string, fallback: boolean): boolean => {
    const v = raw[key];
    if (v === undefined) return fallback;
    if (typeof v !== "boolean") {
      errors.push(`"${key}" must be true or false.`);
      return fallback;
    }
    return v;
  };

  const enabled = bool("enabled", true);
  const showPostActions = bool("showPostActions", true);

  let scope: FeedScope = "popular";
  if (raw.scope !== undefined) {
    if (FEED_SCOPES.includes(raw.scope as FeedScope)) scope = raw.scope as FeedScope;
    else errors.push(`"scope" must be one of: ${FEED_SCOPES.join(", ")}.`);
  }
  let hideMode: HideMode = "hide";
  if (raw.hideMode !== undefined) {
    if (HIDE_MODES.includes(raw.hideMode as HideMode)) hideMode = raw.hideMode as HideMode;
    else errors.push(`"hideMode" must be one of: ${HIDE_MODES.join(", ")}.`);
  }
  let pausedUntil: number | null = null;
  if (typeof raw.pausedUntil === "number" && Number.isFinite(raw.pausedUntil)) pausedUntil = raw.pausedUntil;

  const allowlist = cleanSubreddits(raw.allowlist, "allowlist", warnings, errors);
  const deletedSeeds = Array.isArray(raw.deletedSeeds)
    ? raw.deletedSeeds.filter((s): s is string => typeof s === "string")
    : [];

  const categories: Category[] = [];
  if (!Array.isArray(raw.categories)) {
    errors.push(`"categories" must be an array.`);
  } else {
    const ids = new Set<string>();
    raw.categories.forEach((c, i) => {
      const cat = cleanCategory(c, i, ids, warnings, errors);
      if (cat) categories.push(cat);
    });
  }

  if (errors.length) return { ok: false, errors, warnings };
  return {
    ok: true,
    warnings,
    config: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      enabled,
      pausedUntil,
      scope,
      hideMode,
      showPostActions,
      categories,
      allowlist,
      deletedSeeds,
    },
  };
}

function cleanCategory(c: unknown, index: number, ids: Set<string>, warnings: string[], errors: string[]): Category | null {
  const where = `categories[${index}]`;
  if (!isObj(c)) {
    errors.push(`${where} must be an object.`);
    return null;
  }
  const name = typeof c.name === "string" ? c.name.trim() : "";
  if (!name) {
    errors.push(`${where} needs a non-empty "name".`);
    return null;
  }
  const label = `category “${name}”`;
  let id = typeof c.id === "string" && /^[\w-]{1,64}$/.test(c.id) ? c.id : slugify(name);
  if (ids.has(id)) {
    let n = 2;
    while (ids.has(`${id}-${n}`)) n++;
    warnings.push(`Duplicate category id “${id}” renamed to “${id}-${n}”.`);
    id = `${id}-${n}`;
  }
  ids.add(id);

  const rules = isObj(c.rules) ? c.rules : {};
  if (c.rules !== undefined && !isObj(c.rules)) errors.push(`${label}: "rules" must be an object.`);

  const category: Category = {
    id,
    name: name.slice(0, 100),
    description: typeof c.description === "string" ? c.description.slice(0, 500) : "",
    enabled: typeof c.enabled === "boolean" ? c.enabled : true,
    rules: {
      subreddits: cleanSubreddits(rules.subreddits, `${label} subreddits`, warnings, errors),
      patterns: cleanList(rules.patterns, `${label} patterns`, normalizePattern, isValidPattern, warnings, errors),
      keywords: cleanList(rules.keywords, `${label} keywords`, normalizeKeyword, isValidKeyword, warnings, errors),
    },
    exclusions: cleanList(c.exclusions, `${label} exclusions`, normalizePattern, isValidPattern, warnings, errors),
  };
  if (isObj(c.seed) && typeof c.seed.id === "string" && typeof c.seed.version === "number") {
    const removed = isObj(c.seed.removed) ? c.seed.removed : {};
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
    category.seed = {
      id: c.seed.id,
      version: c.seed.version,
      removed: { subreddits: strings(removed.subreddits), patterns: strings(removed.patterns), keywords: strings(removed.keywords) },
    };
  }
  return category;
}

function cleanSubreddits(v: unknown, label: string, warnings: string[], errors: string[]): string[] {
  return cleanList(v, label, stripSubredditPrefix, isValidSubredditName, warnings, errors);
}

function cleanList(
  v: unknown,
  label: string,
  normalize: (s: string) => string,
  valid: (s: string) => boolean,
  warnings: string[],
  errors: string[],
): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    errors.push(`${label} must be an array of strings.`);
    return [];
  }
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") {
      warnings.push(`${label}: ignored non-text entry ${JSON.stringify(item)}.`);
      continue;
    }
    const n = normalize(item);
    if (!valid(n)) {
      warnings.push(`${label}: ignored invalid entry “${item}”.`);
      continue;
    }
    out.push(n);
  }
  const deduped = dedupeCaseInsensitive(out);
  if (deduped.length < out.length) warnings.push(`${label}: removed ${out.length - deduped.length} duplicate(s).`);
  return deduped;
}
