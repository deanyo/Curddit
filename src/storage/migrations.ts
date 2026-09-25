/**
 * Schema migrations. Each entry upgrades a raw object from version N to N+1.
 * Migrations operate on untyped data (they run before validation) and must be
 * pure. To add a schema change:
 *   1. bump CURRENT_SCHEMA_VERSION in schema.ts,
 *   2. add `[oldVersion]: (raw) => upgraded` here,
 *   3. add a test in tests/migrations.test.ts.
 */

import { CURRENT_SCHEMA_VERSION } from "./schema";

type Raw = Record<string, unknown>;
type Migration = (raw: Raw) => Raw;

const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);

export const MIGRATIONS: Record<number, Migration> = {
  /**
   * v0 -> v1. "v0" is any unversioned object, e.g. a hand-written file using
   * the flat shape `{ categories: [{ name, subreddits, patterns, keywords }] }`.
   * Flat rule arrays move under `rules`, and the old embedded `statistics`
   * block is dropped (statistics now live under their own storage keys).
   */
  0: (raw) => {
    const categories = Array.isArray(raw.categories)
      ? raw.categories.map((c) => {
          if (!isObj(c) || isObj(c.rules)) return c;
          const { subreddits, patterns, keywords, ...rest } = c;
          return { ...rest, rules: { subreddits, patterns, keywords } };
        })
      : raw.categories;
    const { statistics: _dropped, ...rest } = raw;
    return { ...rest, categories, schemaVersion: 1 };
  },
};

export class MigrationError extends Error {}

export function migrate(input: Raw): Raw {
  let raw = input;
  let version = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 0;
  if (!Number.isInteger(version) || version < 0) {
    throw new MigrationError(`Invalid schemaVersion: ${String(raw.schemaVersion)}`);
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new MigrationError(
      `This configuration uses schema version ${version}, but this version of the extension only understands up to ${CURRENT_SCHEMA_VERSION}. Update the extension first.`,
    );
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new MigrationError(`No migration from schema version ${version}`);
    raw = step(raw);
    version++;
    raw.schemaVersion = version;
  }
  return raw;
}
