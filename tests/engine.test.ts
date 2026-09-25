import { describe, expect, it } from "vitest";
import { compileRules, describeMatch, evaluate, evaluatePost } from "../src/filtering/engine";
import { createDefaultConfig } from "../src/storage/defaults";
import { cat, config } from "./helpers";

const india = cat({ id: "india", name: "India", rules: { subreddits: ["TeenIndia", "SnacksIndia"], patterns: [], keywords: [] } });

describe("exact subreddit matching", () => {
  it("matches the example from the spec", () => {
    const d = evaluate(
      { subreddit: "TeenIndia", title: "Example post title", url: "https://www.reddit.com/r/TeenIndia/comments/example/", postId: "example" },
      config([india]),
    );
    expect(d).toEqual({ blocked: true, category: "india", categoryName: "India", matchedRule: "TeenIndia", matchType: "exact_subreddit" });
  });

  it("is case-insensitive", () => {
    for (const s of ["teenindia", "TEENINDIA", "tEeNiNdIa"]) {
      expect(evaluate({ subreddit: s, title: "" }, config([india])).blocked).toBe(true);
    }
  });

  it("normalises r/, /r/ and URL forms on both sides", () => {
    const c = config([cat({ id: "x", rules: { subreddits: ["/r/Kerala/", "r/pune"], patterns: [], keywords: [] } })]);
    for (const s of ["Kerala", "r/kerala", "/r/KERALA", "https://www.reddit.com/r/kerala/comments/abc/x/", "pune", "r/Pune/"]) {
      expect(evaluate({ subreddit: s, title: "" }, c).blocked, s).toBe(true);
    }
  });

  it("does not match substrings", () => {
    expect(evaluate({ subreddit: "TeenIndiaMemes", title: "" }, config([india])).blocked).toBe(false);
    expect(evaluate({ subreddit: "India", title: "" }, config([india])).blocked).toBe(false);
  });

  it("does not block an India news post in a general subreddit (subreddit identity only)", () => {
    const d = evaluate({ subreddit: "worldnews", title: "India launches new satellite" }, createDefaultConfig());
    expect(d.blocked).toBe(false);
  });
});

describe("wildcard patterns", () => {
  const c = config([cat({ id: "p", rules: { subreddits: [], patterns: ["*India", "Indian*", "*bolly*", "delh?"], keywords: [] } })]);
  it.each([
    ["TeenIndia", "*India"],
    ["indiangaming", "Indian*"],
    ["BollyBlindsNGossip", "*bolly*"],
    ["delhi", "delh?"],
  ])("%s matches %s", (sub, rule) => {
    const d = evaluate({ subreddit: sub, title: "" }, c);
    expect(d.blocked && d.matchedRule).toBe(rule);
    expect(d.blocked && d.matchType).toBe("subreddit_pattern");
  });

  it("does not match when the anchor differs", () => {
    expect(evaluate({ subreddit: "IndiaSpeaks", title: "" }, config([cat({ id: "p", rules: { subreddits: [], patterns: ["*India"], keywords: [] } })])).blocked).toBe(false);
    expect(evaluate({ subreddit: "delhii", title: "" }, c).blocked).toBe(false);
  });

  it("category exclusions (incl. wildcard exclusions) carve out false positives", () => {
    const c2 = config([cat({ id: "p", rules: { subreddits: [], patterns: ["Indian*"], keywords: [] }, exclusions: ["Indiana*", "IndianCountry"] })]);
    expect(evaluate({ subreddit: "Indianapolis", title: "" }, c2).blocked).toBe(false);
    expect(evaluate({ subreddit: "IndianCountry", title: "" }, c2).blocked).toBe(false);
    expect(evaluate({ subreddit: "IndianGaming", title: "" }, c2).blocked).toBe(true);
  });

  it("treats regex metacharacters literally", () => {
    const c3 = config([cat({ id: "p", rules: { subreddits: [], patterns: ["a.b*"], keywords: [] } })]);
    expect(evaluate({ subreddit: "axbc", title: "" }, c3).blocked).toBe(false);
  });
});

describe("keyword matching", () => {
  const c = config([cat({ id: "comics", rules: { subreddits: [], patterns: [], keywords: ["comic strip", "webcomic", "art", "comic*", "[OC] comic"] } })]);
  const kw = (title: string) => {
    const d = evaluate({ subreddit: "pics", title }, c);
    return d.blocked ? d.matchedRule : null;
  };
  it("matches whole words and phrases, case-insensitively", () => {
    expect(kw("My new WEBCOMIC is out")).toBe("webcomic");
    expect(kw("A comic   strip about cats")).toBe("comic strip");
    expect(kw("Some art I made")).toBe("art");
  });
  it("does not match inside other words", () => {
    expect(kw("Party time")).toBeNull();
    expect(kw("Webcomics are cool")).toBeNull(); // "webcomics" is neither whole "webcomic" nor starts with "comic"
  });
  it("supports trailing * as word prefix", () => {
    expect(kw("Comics I like")).toBe("comic*");
    expect(kw("A comical situation")).toBe("comic*");
  });
  it("handles punctuation-bounded keywords", () => {
    expect(kw("[OC] comic about Mondays")).toBe("[OC] comic");
  });
  it("matches non-ASCII titles safely", () => {
    const c2 = config([cat({ id: "x", rules: { subreddits: [], patterns: [], keywords: ["café"] } })]);
    expect(evaluate({ subreddit: "a", title: "Best café in town" }, c2).blocked).toBe(true);
    expect(evaluate({ subreddit: "a", title: "cafés" }, c2).blocked).toBe(false);
  });
});

describe("allowlist and precedence", () => {
  it("allowlist beats every rule type", () => {
    const c = config(
      [cat({ id: "a", rules: { subreddits: ["TeenIndia"], patterns: ["*India"], keywords: ["hello"] } })],
      { allowlist: ["r/teenindia"] },
    );
    expect(evaluate({ subreddit: "TeenIndia", title: "hello" }, c)).toEqual({ blocked: false, reason: "allowlisted" });
  });

  it("exact rules win over patterns, patterns over keywords, across categories", () => {
    const c = config([
      cat({ id: "kw", rules: { subreddits: [], patterns: [], keywords: ["hello"] } }),
      cat({ id: "pat", rules: { subreddits: [], patterns: ["*India"], keywords: [] } }),
      cat({ id: "exact", rules: { subreddits: ["TeenIndia"], patterns: [], keywords: [] } }),
    ]);
    const d = evaluate({ subreddit: "TeenIndia", title: "hello" }, c);
    expect(d.blocked && d.category).toBe("exact");
    const d2 = evaluate({ subreddit: "SnacksIndia", title: "hello" }, c);
    expect(d2.blocked && d2.category).toBe("pat");
  });

  it("the same subreddit in two categories reports the first", () => {
    const c = config([
      cat({ id: "one", rules: { subreddits: ["pune"], patterns: [], keywords: [] } }),
      cat({ id: "two", rules: { subreddits: ["pune"], patterns: [], keywords: [] } }),
    ]);
    const d = evaluate({ subreddit: "pune", title: "" }, c);
    expect(d.blocked && d.category).toBe("one");
  });

  it("an exclusion in one category does not stop another category", () => {
    const c = config([
      cat({ id: "one", rules: { subreddits: ["pune"], patterns: [], keywords: [] }, exclusions: ["pune"] }),
      cat({ id: "two", rules: { subreddits: [], patterns: ["pu*"], keywords: [] } }),
    ]);
    const d = evaluate({ subreddit: "pune", title: "" }, c);
    expect(d.blocked && d.category).toBe("two");
  });
});

describe("toggles", () => {
  it("disabled categories do not apply", () => {
    const c = config([{ ...india, enabled: false }]);
    expect(evaluate({ subreddit: "TeenIndia", title: "" }, c).blocked).toBe(false);
  });
  it("master switch off blocks nothing", () => {
    expect(evaluate({ subreddit: "TeenIndia", title: "" }, config([india], { enabled: false }))).toEqual({ blocked: false, reason: "disabled" });
  });
  it("pause is time-bound", () => {
    const c = config([india], { pausedUntil: 2000 });
    expect(evaluate({ subreddit: "TeenIndia", title: "" }, c, 1000)).toEqual({ blocked: false, reason: "paused" });
    expect(evaluate({ subreddit: "TeenIndia", title: "" }, c, 3000).blocked).toBe(true);
  });
});

describe("robustness", () => {
  it("duplicate rules are compiled once", () => {
    const c = config([cat({ id: "d", rules: { subreddits: ["pune", "Pune", "r/PUNE"], patterns: ["*x", "*X"], keywords: ["a b", "A B"] } })]);
    expect(compileRules(c).ruleCount).toBe(3);
  });
  it("empty metadata never blocks", () => {
    expect(evaluate({ subreddit: "", title: "" }, createDefaultConfig()).blocked).toBe(false);
  });
  it("pathological wildcard patterns evaluate quickly", () => {
    const c = config([cat({ id: "p", rules: { subreddits: [], patterns: ["*a*a*a*a*a*a*a*a*a*a*a*a*b"], keywords: [] } })]);
    const rules = compileRules(c);
    const start = performance.now();
    for (let i = 0; i < 1000; i++) evaluatePost({ subreddit: "a".repeat(21), title: "" }, rules);
    expect(performance.now() - start).toBeLessThan(500);
  });
  it("large rule sets stay fast", () => {
    const subs = Array.from({ length: 20000 }, (_, i) => `sub${i}`);
    const kws = Array.from({ length: 2000 }, (_, i) => `keyword${i} phrase`);
    const rules = compileRules(config([cat({ id: "big", rules: { subreddits: subs, patterns: ["*zzz"], keywords: kws } })]));
    const start = performance.now();
    for (let i = 0; i < 5000; i++) evaluatePost({ subreddit: `other${i}`, title: "An ordinary title about nothing much at all" }, rules);
    expect(performance.now() - start).toBeLessThan(1000);
  });
  it("describes decisions", () => {
    expect(describeMatch(evaluate({ subreddit: "TeenIndia", title: "" }, config([india])))).toContain("exact subreddit rule");
    expect(describeMatch({ blocked: false, reason: "allowlisted" })).toContain("allowlist");
  });
});
