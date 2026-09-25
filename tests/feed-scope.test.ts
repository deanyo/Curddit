import { describe, expect, it } from "vitest";
import { classifyPage, scopeIncludes } from "../src/content/feed-scope";

describe("classifyPage", () => {
  it.each([
    ["https://www.reddit.com/", "home"],
    ["https://www.reddit.com/?feed=home", "home"],
    ["https://www.reddit.com/best/", "home"],
    ["https://www.reddit.com/new", "home"],
    ["https://www.reddit.com/r/popular/", "popular"],
    ["https://reddit.com/r/popular", "popular"],
    ["https://www.reddit.com/r/Popular/top/?t=day", "popular"],
    ["https://www.reddit.com/r/popular/?geo_filter=GB", "popular"],
    ["https://www.reddit.com/r/all/", "all"],
    ["https://old.reddit.com/r/all/new/", "all"],
    ["https://www.reddit.com/r/pics+funny/", "multi"],
    ["https://www.reddit.com/user/someone/m/myfeed/", "multi"],
    ["https://www.reddit.com/r/TeenIndia/", "subreddit"],
    ["https://www.reddit.com/r/TeenIndia/top/", "subreddit"],
    ["https://www.reddit.com/r/TeenIndia/comments/abc/title/", "post"],
    ["https://www.reddit.com/r/popular/comments/abc/x/", "post"],
    ["https://www.reddit.com/search/?q=india", "other"],
    ["https://www.reddit.com/user/someone/", "other"],
    ["not a url", "other"],
  ])("%s -> %s", (url, kind) => expect(classifyPage(url)).toBe(kind));
});

describe("scopeIncludes", () => {
  it("widens cumulatively and never includes subreddit or post pages", () => {
    expect(scopeIncludes("popular", "popular")).toBe(true);
    expect(scopeIncludes("popular", "all")).toBe(false);
    expect(scopeIncludes("popular_all", "all")).toBe(true);
    expect(scopeIncludes("popular_all", "home")).toBe(false);
    expect(scopeIncludes("home", "home")).toBe(true);
    expect(scopeIncludes("home", "multi")).toBe(false);
    expect(scopeIncludes("all_feeds", "multi")).toBe(true);
    for (const s of ["popular", "popular_all", "home", "all_feeds"] as const) {
      expect(scopeIncludes(s, "subreddit")).toBe(false);
      expect(scopeIncludes(s, "post")).toBe(false);
      expect(scopeIncludes(s, "other")).toBe(false);
    }
  });
});
