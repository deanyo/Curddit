import type { CategoryRules } from "../storage/schema";

/**
 * A built-in category dataset. Bump `version` whenever entries are added; on
 * the next load, new entries are merged into the user's copy of the category
 * unless the user has explicitly removed them (see storage/defaults.ts).
 */
export interface SeedCategory {
  id: string;
  version: number;
  name: string;
  description: string;
  enabledByDefault: boolean;
  rules: CategoryRules;
  exclusions: string[];
}
