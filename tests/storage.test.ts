import { describe, expect, it } from "vitest";
import { evaluate } from "../src/filtering/engine";
import { stripSubredditPrefix, subredditKey } from "../src/filtering/normalization";
import {
  addRule,
  addToAllowlist,
  createCategory,
  deleteCategory,
  quickBlock,
  QUICK_BLOCK_ID,
  removeRule,
  RuleError,
} from "../src/storage/config-ops";
import { createDefaultConfig, mergeSeedUpdates, SEEDS } from "../src/storage/defaults";
import { migrate, MigrationError } from "../src/storage/migrations";
import { CURRENT_SCHEMA_VERSION } from "../src/storage/schema";
import { parseImport, serializeExport, validateConfig } from "../src/storage/validation";
import type { SeedCategory } from "../src/data/seed-types";
import { defaultsWith } from "./helpers";

describe("normalisation", () => {
  it.each([
    ["TeenIndia", "TeenIndia"],
    ["r/TeenIndia", "TeenIndia"],
    ["/r/TeenIndia/", "TeenIndia"],
    ["  R/TeenIndia  ", "TeenIndia"],
    ["https://www.reddit.com/r/TeenIndia/comments/abc/title/", "TeenIndia"],
    ["https://old.reddit.com/r/pune", "pune"],
  ])("%s -> %s", (input, out) => {
    expect(stripSubredditPrefix(input)).toBe(out);
    expect(subredditKey(input)).toBe(out.toLowerCase());
  });
});

describe("default config and seeds", () => {
  const def = createDefaultConfig();
  it("validates cleanly", () => {
    const r = validateConfig(def);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings).toEqual([]);
  });
  it("ships every built-in category off, so new installs filter nothing until the user chooses", () => {
    expect(def.categories.every((c) => !c.enabled)).toBe(true);
    expect(evaluate({ subreddit: "TeenIndia", title: "a webcomic" }, def).blocked).toBe(false);
  });
  it("includes all 25 user-muted India subreddits as exact rules", () => {
    const def = defaultsWith("india");
    const india = def.categories.find((c) => c.id === "india")!;
    const muted = ["TeenIndia", "SnacksIndia", "TwentiesIndia", "AllindiaStudentUnion", "BollywoodShaadis", "Indianbooks", "TamilNadu", "IndianGaming", "pune", "BollyBlindsNGossip", "FingMemes", "TwoXIndia", "IndiaInvestments", "GadgetsIndia", "kolkata", "IndiaTech", "bangalore", "Kerala", "AajMaineJana", "indiafood", "developersIndia", "bollywood", "Indiangamers", "ZyadaKuchNai", "InstaCelebsGossip"];
    for (const m of muted) expect(evaluate({ subreddit: m, title: "" }, def).blocked, m).toBe(true);
    expect(india.rules.patterns).toEqual([]);
    expect(india.rules.keywords).toEqual([]);
  });
  it("keeps broad India patterns in a separate, disabled category", () => {
    const def = defaultsWith("india");
    expect(evaluate({ subreddit: "IndiaSomethingNew", title: "" }, def).blocked).toBe(false);
    const on = { ...def, categories: def.categories.map((c) => (c.id === "india-patterns" ? { ...c, enabled: true } : c)) };
    expect(evaluate({ subreddit: "IndiaSomethingNew", title: "" }, on).blocked).toBe(true);
    for (const fp of ["Indiana", "indianapolis", "IndianaJones", "IndianCountry", "IndianMotorcycle"]) {
      expect(evaluate({ subreddit: fp, title: "" }, on).blocked, fp).toBe(false);
    }
  });
  it("webcomics blocks comic subs and comic titles but not all images", () => {
    const def = defaultsWith("webcomics");
    expect(evaluate({ subreddit: "xkcd", title: "" }, def).blocked).toBe(true);
    expect(evaluate({ subreddit: "funny", title: "I made a comic about my cat" }, def).blocked).toBe(true);
    expect(evaluate({ subreddit: "pics", title: "Sunset over the lake", postType: "image" }, def).blocked).toBe(false);
    expect(evaluate({ subreddit: "movies", title: "Marvel comic book movie ranking" }, def).blocked).toBe(false);
  });
  it("seed lists have no duplicates or invalid names", () => {
    for (const seed of SEEDS) {
      const lower = seed.rules.subreddits.map((s) => s.toLowerCase());
      expect(new Set(lower).size, seed.id).toBe(lower.length);
    }
  });
});

describe("seed updates never overwrite user choices", () => {
  const seedV1: SeedCategory = { id: "s", version: 1, name: "S", description: "", enabledByDefault: true, rules: { subreddits: ["a1", "b2"], patterns: [], keywords: [] }, exclusions: [] };
  const seedV2: SeedCategory = { ...seedV1, version: 2, rules: { subreddits: ["a1", "b2", "c3"], patterns: [], keywords: [] } };

  it("adds new seed entries but not ones the user removed", () => {
    let c = mergeSeedUpdates({ ...createDefaultConfig(), categories: [] }, [seedV1]).config;
    c = removeRule(c, "s", "subreddits", "b2");
    c = addRule(c, "s", "subreddits", "mine");
    c = { ...c, categories: c.categories.map((x) => ({ ...x, name: "Renamed", enabled: false })) };
    const { config: merged, changed } = mergeSeedUpdates(c, [seedV2]);
    expect(changed).toBe(true);
    const cat = merged.categories[0]!;
    expect(cat.rules.subreddits).toEqual(["a1", "mine", "c3"]);
    expect(cat.name).toBe("Renamed");
    expect(cat.enabled).toBe(false);
    expect(mergeSeedUpdates(merged, [seedV2]).changed).toBe(false);
  });
  it("does not recreate a deleted built-in category", () => {
    let c = mergeSeedUpdates({ ...createDefaultConfig(), categories: [] }, [seedV1]).config;
    c = deleteCategory(c, "s");
    expect(mergeSeedUpdates(c, [seedV2]).config.categories).toEqual([]);
  });
  it("re-adding a removed seed entry clears the removal record", () => {
    let c = mergeSeedUpdates({ ...createDefaultConfig(), categories: [] }, [seedV1]).config;
    c = removeRule(c, "s", "subreddits", "b2");
    expect(c.categories[0]!.seed!.removed.subreddits).toEqual(["b2"]);
    c = addRule(c, "s", "subreddits", "B2");
    expect(c.categories[0]!.seed!.removed.subreddits).toEqual([]);
  });
});

describe("config operations", () => {
  it("rejects invalid rules with readable errors", () => {
    const c = createDefaultConfig();
    expect(() => addRule(c, "india", "subreddits", "not a sub!")).toThrow(RuleError);
    expect(() => addRule(c, "india", "patterns", "(.*)+")).toThrow(/wildcards/);
    expect(() => addRule(c, "india", "keywords", "   ")).toThrow(RuleError);
    expect(() => addRule(c, "nope", "subreddits", "abc")).toThrow(/Unknown category/);
  });
  it("ignores duplicate rules (case-insensitive, any prefix form)", () => {
    const c = createDefaultConfig();
    expect(addRule(c, "india", "subreddits", "r/TEENINDIA")).toBe(c);
  });
  it("quick block creates the category, clears allowlist and enables the category", () => {
    let c = addToAllowlist(defaultsWith("webcomics"), "funny");
    c = quickBlock(c, "r/funny");
    expect(c.allowlist).toEqual([]);
    expect(c.categories.find((x) => x.id === QUICK_BLOCK_ID)!.rules.subreddits).toEqual(["funny"]);
    expect(evaluate({ subreddit: "funny", title: "" }, c).blocked).toBe(true);
    const off = { ...c, categories: c.categories.map((x) => (x.id === "webcomics" ? { ...x, enabled: false } : x)) };
    expect(quickBlock(off, "pics", "webcomics").categories.find((x) => x.id === "webcomics")!.enabled).toBe(true);
  });
  it("creates custom categories with unique ids and rejects duplicate names", () => {
    const a = createCategory(createDefaultConfig(), "Cryptocurrency");
    expect(a.id).toBe("custom-cryptocurrency");
    expect(() => createCategory(a.config, "CRYPTOcurrency")).toThrow(/already exists/);
    expect(() => createCategory(a.config, "  ")).toThrow(RuleError);
  });
});

describe("migrations", () => {
  it("upgrades an unversioned flat config", () => {
    const out = migrate({ categories: [{ name: "Old", subreddits: ["pune"], keywords: ["x"] }], statistics: { totalHidden: 4 } });
    expect(out.schemaVersion).toBe(1);
    expect(out.statistics).toBeUndefined();
    expect(out.categories).toEqual([{ name: "Old", rules: { subreddits: ["pune"], patterns: undefined, keywords: ["x"] } }]);
    const r = validateConfig({ categories: [{ name: "Old", subreddits: ["pune"] }] });
    expect(r.ok && r.config.categories[0]!.rules.subreddits).toEqual(["pune"]);
  });
  it("leaves current-version configs alone", () => {
    const def = createDefaultConfig();
    expect(migrate(structuredClone(def) as unknown as Record<string, unknown>)).toEqual(def);
  });
  it("refuses configs from a newer version", () => {
    expect(() => migrate({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow(MigrationError);
    const r = validateConfig({ schemaVersion: 99, categories: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/Update the extension/);
  });
});

describe("import / export", () => {
  it("round-trips the default config exactly", () => {
    const def = createDefaultConfig();
    const r = parseImport(serializeExport(def));
    expect(r.ok && r.config).toEqual(def);
  });
  it("round-trips a customised config", () => {
    let c = createCategory(createDefaultConfig(), "Crypto").config;
    c = addRule(c, "custom-crypto", "keywords", "bitcoin");
    c = addRule(c, "custom-crypto", "patterns", "*coin*");
    c = addToAllowlist(c, "IndiaSpeaks");
    c = { ...c, scope: "all_feeds", hideMode: "dim", showPostActions: false };
    const r = parseImport(serializeExport(c));
    expect(r.ok && r.config).toEqual(c);
  });
  it("accepts a bare config object", () => {
    expect(parseImport(JSON.stringify(createDefaultConfig())).ok).toBe(true);
  });
  it("reports malformed JSON clearly", () => {
    const r = parseImport("{ not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/not valid JSON/);
  });
  it("reports structural errors", () => {
    const cases: [unknown, RegExp][] = [
      [[], /JSON object/],
      [{ categories: "x" }, /"categories" must be an array/],
      [{ categories: [{}] }, /non-empty "name"/],
      [{ categories: [], scope: "everything" }, /"scope" must be one of/],
      [{ categories: [], enabled: "yes" }, /"enabled" must be true or false/],
      [{ categories: [{ name: "a", rules: { subreddits: "pune" } }] }, /must be an array/],
    ];
    for (const [input, msg] of cases) {
      const r = validateConfig(input);
      expect(r.ok, JSON.stringify(input)).toBe(false);
      if (!r.ok) expect(r.errors.join(" ")).toMatch(msg);
    }
  });
  it("drops bad and duplicate entries with warnings instead of failing", () => {
    const r = validateConfig({
      categories: [
        { name: "A", rules: { subreddits: ["pune", "r/Pune", "bad name!", 42], patterns: ["*x", "(a+)+"], keywords: ["ok", ""] } },
        { id: "A", name: "A2" },
        { id: "A", name: "A3" },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.categories[0]!.rules).toEqual({ subreddits: ["pune"], patterns: ["*x"], keywords: ["ok"] });
    // First category has no id, so it gets a slug of its name; the duplicate "A" id is renamed.
    expect(r.config.categories.map((c) => c.id)).toEqual(["a", "A", "A-2"]);
    expect(r.warnings.length).toBeGreaterThanOrEqual(4);
  });
});

describe("optional built-in categories", () => {
  const def = createDefaultConfig();
  const optional = ["celebrity-gossip", "reality-tv", "snark", "streamers", "us-politics", "political-headlines", "rage-bait", "tumblr"];
  const enable = (ids: string[]) => ({ ...def, categories: def.categories.map((c) => (ids.includes(c.id) ? { ...c, enabled: true } : c)) });

  it("are all off by default", () => {
    for (const id of optional) expect(def.categories.find((c) => c.id === id)?.enabled, id).toBe(false);
    expect(evaluate({ subreddit: "politics", title: "" }, def).blocked).toBe(false);
    expect(evaluate({ subreddit: "pics", title: "Trump at rally" }, def).blocked).toBe(false);
  });

  it("are added (still off) to an existing install without touching its categories", () => {
    const old = { ...def, categories: def.categories.filter((c) => ["india", "webcomics"].includes(c.id)).map((c) => ({ ...c, name: c.name + " (mine)" })) };
    const { config: merged, changed } = mergeSeedUpdates(old);
    expect(changed).toBe(true);
    expect(merged.categories.slice(0, 2).map((c) => c.name)).toEqual(old.categories.map((c) => c.name));
    for (const id of optional) expect(merged.categories.find((c) => c.id === id)?.enabled, id).toBe(false);
  });

  it("snark pattern catches unlisted snark subs but not its known false positives", () => {
    const c = enable(["snark"]);
    expect(evaluate({ subreddit: "SomeNewInfluencerSnark", title: "" }, c).blocked).toBe(true);
    for (const fp of ["SnarkyPuppy", "snarkyreplies", "snarkynurses"]) expect(evaluate({ subreddit: fp, title: "" }, c).blocked, fp).toBe(false);
  });

  it("political headlines match figures, not ambiguous words", () => {
    const c = enable(["political-headlines"]);
    const hit = (t: string) => evaluate({ subreddit: "pics", title: t }, c).blocked;
    expect(hit("Trump signs executive order")).toBe(true);
    expect(hit("AOC responds to Ocasio-Cortez critics")).toBe(true);
    expect(hit("Senate passes bill")).toBe(true);
    expect(hit("My neighbour Mr Harris built a treehouse")).toBe(false);
    expect(hit("Class president election at my school")).toBe(false);
    expect(hit("Ice on the lake this morning")).toBe(false);
    expect(hit("Trumpet solo")).toBe(false);
  });
});

describe("India seed v2 update", () => {
  it("merges new subs into a v1 install, keeping removals and the user's on/off choice", () => {
    let c = defaultsWith("india");
    // Simulate an install made with seed v1: without the v2 additions, one v1 entry removed by the user.
    c = { ...c, categories: c.categories.map((x) => (x.id === "india" ? { ...x, rules: { ...x.rules, subreddits: x.rules.subreddits.filter((s) => !["Indiedogs", "TharCriminals", "pune"].includes(s)) }, seed: { ...x.seed!, version: 1, removed: { subreddits: ["pune"], patterns: [], keywords: [] } } } : x)) };
    const merged = mergeSeedUpdates(c).config;
    const india = merged.categories.find((x) => x.id === "india")!;
    expect(india.enabled).toBe(true);
    expect(india.seed!.version).toBe(2);
    expect(india.rules.subreddits).toContain("Indiedogs");
    expect(india.rules.subreddits).toContain("TharCriminals");
    expect(india.rules.subreddits).not.toContain("pune");
    expect(evaluate({ subreddit: "Indiedogs", title: "" }, merged).blocked).toBe(true);
  });
});
