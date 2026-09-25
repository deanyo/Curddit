// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FeedFilter, HIDDEN_ATTR } from "../src/content/feed-observer";
import { createDefaultConfig } from "../src/storage/defaults";
import type { Config } from "../src/storage/schema";
import type { HiddenPostReport } from "../src/shared/messages";
import { oldRedditThing, shredditAd, shredditPage, shredditPost } from "./fixtures/markup";

const tick = () => new Promise((r) => setTimeout(r, 0));

let href = "https://www.reddit.com/r/popular/";
let reports: HiddenPostReport[] = [];
let filter: FeedFilter;

function article(id: string): Element {
  return document.querySelector(`article[data-post-id="t3_${id}"]`)!;
}
function isHidden(id: string): boolean {
  return article(id).hasAttribute(HIDDEN_ATTR);
}
function start(config: Config = createDefaultConfig()): FeedFilter {
  filter = new FeedFilter({ getHref: () => href, onHidden: (items) => reports.push(...items), reportDelayMs: 0 });
  filter.setConfig(config);
  filter.start();
  return filter;
}
function withCategory(config: Config, id: string, enabled: boolean): Config {
  return { ...config, categories: config.categories.map((c) => (c.id === id ? { ...c, enabled } : c)) };
}

beforeEach(() => {
  href = "https://www.reddit.com/r/popular/";
  reports = [];
  document.body.innerHTML = shredditPage(
    shredditPost({ id: "a1", sub: "TeenIndia", title: "Hello from TeenIndia" }) +
      shredditAd() +
      shredditPost({ id: "b2", sub: "pics", title: "A nice sunset" }) +
      shredditPost({ id: "c3", sub: "funny", title: "I made a comic about Mondays" }) +
      shredditPost({ id: "d4", sub: "worldnews", title: "India launches a satellite" }),
  );
});
afterEach(() => filter?.stop());

describe("current Reddit frontend", () => {
  it("hides matching posts and leaves others visible", () => {
    start();
    expect(isHidden("a1")).toBe(true);
    expect(isHidden("c3")).toBe(true); // webcomic title keyword
    expect(isHidden("b2")).toBe(false);
    expect(isHidden("d4")).toBe(false); // India in title of a general sub is not blocked
  });

  it("hides the separator after a hidden post, but nothing else", () => {
    start();
    expect(article("a1").nextElementSibling!.hasAttribute("data-rfc-hidden-sep")).toBe(true);
    expect(article("b2").nextElementSibling!.hasAttribute("data-rfc-hidden-sep")).toBe(false);
    expect(document.querySelector("shreddit-ad-post")!.hasAttribute(HIDDEN_ATTR)).toBe(false);
    expect(document.querySelector("nav")!.hasAttribute(HIDDEN_ATTR)).toBe(false);
    // Post in the sidebar is from a blocked sub but is not a feed post.
    expect(document.querySelector("aside article")!.hasAttribute(HIDDEN_ATTR)).toBe(false);
  });

  it("marks the containing article rather than removing nodes", () => {
    start();
    expect(document.querySelectorAll("shreddit-post").length).toBe(5);
    expect(document.querySelector("shreddit-post[subreddit-name='TeenIndia']")!.hasAttribute(HIDDEN_ATTR)).toBe(false);
  });

  it("processes dynamically inserted posts (infinite scroll)", async () => {
    start();
    const feed = document.querySelector("shreddit-feed")!;
    const batch = document.createElement("faceplate-batch");
    batch.innerHTML = shredditPost({ id: "e5", sub: "bollywood", title: "Gossip" }) + shredditPost({ id: "f6", sub: "aww", title: "Cat" });
    feed.append(batch);
    await tick();
    expect(isHidden("e5")).toBe(true);
    expect(isHidden("f6")).toBe(false);
  });

  it("handles posts whose attributes arrive after insertion", async () => {
    start();
    document.querySelector("shreddit-feed")!.insertAdjacentHTML("beforeend", shredditPost({ id: "g7", sub: "Kerala", title: "Late", attrs: false }));
    await tick();
    // Falls back to the permalink when attributes are missing.
    expect(isHidden("g7")).toBe(true);
    const post = article("g7").querySelector("shreddit-post")!;
    post.setAttribute("subreddit-prefixed-name", "r/aww");
    post.setAttribute("permalink", "/r/aww/comments/g7/x/");
    await tick();
    expect(isHidden("g7")).toBe(false);
  });

  it("disabling a category restores its hidden posts immediately", () => {
    const f = start();
    expect(isHidden("a1")).toBe(true);
    f.setConfig(withCategory(createDefaultConfig(), "india", false));
    expect(isHidden("a1")).toBe(false);
    expect(article("a1").nextElementSibling!.hasAttribute("data-rfc-hidden-sep")).toBe(false);
    expect(isHidden("c3")).toBe(true);
  });

  it("master switch and allowlist restore posts", () => {
    const f = start();
    f.setConfig({ ...createDefaultConfig(), enabled: false });
    expect(isHidden("a1") || isHidden("c3")).toBe(false);
    f.setConfig({ ...createDefaultConfig(), allowlist: ["TeenIndia"] });
    expect(isHidden("a1")).toBe(false);
    expect(isHidden("c3")).toBe(true);
  });

  it("respects feed scope", () => {
    href = "https://www.reddit.com/r/all/";
    const f = start();
    expect(isHidden("a1")).toBe(false); // default scope is Popular only
    f.setConfig({ ...createDefaultConfig(), scope: "popular_all" });
    expect(isHidden("a1")).toBe(true);
    f.setConfig({ ...createDefaultConfig(), scope: "popular" });
    expect(isHidden("a1")).toBe(false);
  });

  it("does not filter when visiting a blocked subreddit directly", () => {
    href = "https://www.reddit.com/r/TeenIndia/";
    start({ ...createDefaultConfig(), scope: "all_feeds" });
    expect(isHidden("a1")).toBe(false);
  });

  it("re-evaluates on client-side navigation without leaving stale state", async () => {
    const f = start();
    expect(isHidden("a1")).toBe(true);
    href = "https://www.reddit.com/r/TeenIndia/";
    f.checkNavigation();
    expect(isHidden("a1")).toBe(false);
    href = "https://www.reddit.com/r/popular/top/?t=day";
    // Navigation detected from a mutation batch, as happens when Reddit swaps the feed.
    document.querySelector("shreddit-feed")!.insertAdjacentHTML("beforeend", shredditPost({ id: "h8", sub: "pune", title: "x" }));
    await tick();
    expect(filter.pageKind).toBe("popular");
    expect(isHidden("a1")).toBe(true);
    expect(isHidden("h8")).toBe(true);
  });

  it("counts each hidden post once despite reprocessing", async () => {
    const f = start();
    await tick();
    const initial = reports.length;
    expect(initial).toBe(2); // a1 (india) + c3 (webcomics)
    f.reevaluateAll();
    f.setConfig(createDefaultConfig());
    f.setConfig(withCategory(createDefaultConfig(), "india", false));
    f.setConfig(createDefaultConfig());
    // Same post re-rendered as a new element (e.g. Reddit re-mounting the feed).
    const clone = article("a1").cloneNode(true) as Element;
    article("a1").replaceWith(clone);
    await tick();
    f.flushReports();
    expect(reports.length).toBe(initial);
    expect(reports.map((r) => r.category).sort()).toEqual(["india", "webcomics"]);
    expect(f.hiddenCount).toBe(2);
  });

  it("does not treat crosspost previews as separate feed posts", () => {
    document.querySelector("shreddit-feed")!.insertAdjacentHTML(
      "beforeend",
      `<article data-post-id="t3_x9"><shreddit-post id="t3_x9" subreddit-prefixed-name="r/aww" post-title="xpost" permalink="/r/aww/comments/x9/a/">
        <shreddit-post id="t3_inner" subreddit-prefixed-name="r/TeenIndia" post-title="orig" permalink="/r/TeenIndia/comments/inner/a/"></shreddit-post>
      </shreddit-post></article>`,
    );
    start();
    expect(isHidden("x9")).toBe(false);
  });
});

describe("old.reddit.com", () => {
  beforeEach(() => {
    href = "https://old.reddit.com/r/popular/";
    document.body.innerHTML = `
      <div class="side">${oldRedditThing({ id: "s0", sub: "TeenIndia", title: "side" })}</div>
      <div id="siteTable">
        ${oldRedditThing({ id: "o1", sub: "TeenIndia", title: "Old reddit post" })}
        ${oldRedditThing({ id: "o2", sub: "pics", title: "Photo" })}
        ${oldRedditThing({ id: "o3", sub: "kolkata", title: "Ad", promoted: true })}
      </div>`;
  });
  const thing = (id: string) => document.querySelector(`[data-fullname="t3_${id}"]`)!;
  it("hides matching things only", () => {
    start();
    expect(thing("o1").hasAttribute(HIDDEN_ATTR)).toBe(true);
    expect(thing("o2").hasAttribute(HIDDEN_ATTR)).toBe(false);
    expect(thing("o3").hasAttribute(HIDDEN_ATTR)).toBe(false); // promoted: untouched
    expect(thing("s0").hasAttribute(HIDDEN_ATTR)).toBe(false); // sidebar
  });
});
