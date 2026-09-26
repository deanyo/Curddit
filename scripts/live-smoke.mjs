// Live smoke test against the real reddit.com in a throwaway Firefox profile.
// Not part of `npm test` (it needs the network and Reddit's cooperation).
//
//   npm run build && npm run test:live            # headless, /r/popular (India geo)
//   HEADFUL=1 npm run test:live                    # watch it run
//   FIREFOX_PATH=/path/to/firefox npm run test:live
//   BROWSER=chrome CHROME_PATH=/path/to/chrome npm run test:live   (uses dist-chrome/; run build:chrome first)
//
// Fails if Reddit's markup no longer matches what the adapter expects.
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const useChrome = process.env.BROWSER === "chrome";
const candidates = useChrome
  ? [
      process.env.CHROME_PATH,
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/usr/bin/google-chrome",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    ].filter(Boolean)
  : [
      process.env.FIREFOX_PATH,
      "/Applications/Firefox.app/Contents/MacOS/firefox",
      "/usr/bin/firefox",
      "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
    ].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) throw new Error(useChrome ? "Chrome not found; set CHROME_PATH" : "Firefox not found; set FIREFOX_PATH");

const url = process.argv[2] ?? "https://www.reddit.com/r/popular/?geo_filter=IN";
const browser = useChrome
  ? await puppeteer.launch({ executablePath, headless: !process.env.HEADFUL, pipe: true, enableExtensions: true })
  : await puppeteer.launch({ browser: "firefox", executablePath, headless: !process.env.HEADFUL, args: ["-no-remote"] });
let failed = false;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failed = true;
};
try {
  const extId = await browser.installExtension(new URL(useChrome ? "../dist-chrome" : "../dist", import.meta.url).pathname);
  if (useChrome) {
    // Chrome lets us reach the extension's service worker: switch a couple of categories on
    // so the run also proves posts get hidden (fresh installs have everything off).
    const sw = await (await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().includes(extId))).worker();
    await sw.evaluate(async () => {
      let config;
      // The extension creates its config on install; wait for it.
      for (let i = 0; i < 50 && !config; i++) {
        ({ config } = await browser.storage.local.get("config"));
        if (!config) await new Promise((r) => setTimeout(r, 100));
      }
      for (const c of config.categories) if (["india", "webcomics"].includes(c.id)) c.enabled = true;
      await browser.storage.local.set({ config });
    });
  }
  const page = await browser.newPage();
  // Reddit blocks the default "HeadlessChrome" user agent.
  if (useChrome) await page.setUserAgent((await browser.userAgent()).replace("HeadlessChrome", "Chrome"));
  await page.setViewport({ width: 1400, height: 1000 });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(6000);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel({ deltaY: 3000 });
    await sleep(1500);
  }
  const r = await page.evaluate(() => {
    const posts = [...document.querySelectorAll("shreddit-post")];
    return {
      blockedByReddit: /blocked by network security/i.test(document.body.innerText),
      marker: document.documentElement.getAttribute("data-rfc-mode"),
      posts: posts.length,
      withAttrs: posts.filter((p) => p.getAttribute("subreddit-prefixed-name") && p.getAttribute("post-title") && p.id).length,
      inArticle: posts.filter((p) => p.parentElement?.localName === "article").length,
      hidden: [...document.querySelectorAll("[data-rfc-hidden]")].map((e) => e.getAttribute("data-rfc-label")),
      ui: !!document.getElementById("reddit-feed-curator-ui"),
      subs: posts.map((p) => p.getAttribute("subreddit-prefixed-name") + (p.closest("[data-rfc-hidden]") ? " [hidden]" : "")),
    };
  });
  check(!r.blockedByReddit, "Reddit served the page");
  check(r.marker === "hide", "content script ran (data-rfc-mode set)");
  check(r.posts > 0, `found <shreddit-post> elements (${r.posts})`);
  check(r.withAttrs === r.posts, `all posts expose subreddit/title/id attributes (${r.withAttrs}/${r.posts})`);
  check(r.inArticle === r.posts, `all posts are wrapped in <article> (${r.inArticle}/${r.posts})`);
  check(r.ui, "in-feed action UI mounted");
  console.log(`\nHidden ${r.hidden.length} post(s):`);
  for (const h of r.hidden) console.log("  " + h);
  console.log(`\nSubreddits seen:\n  ${r.subs.join("\n  ")}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
