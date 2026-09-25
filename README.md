# Reddit Feed Curator (Curddit)

A Firefox extension that removes unwanted posts from Reddit feeds by **category**, using exact subreddit names, wildcard name patterns and title keywords. Everything runs locally: there's no Reddit login, API access, backend, analytics or network requests.

It ships with these built-in categories. Only the first and third are on by default; switch the rest on from the popup:

| Category | Default | What it matches |
|---|---|---|
| **India-specific communities** | on | 159 India-focused subreddits: regional, city and state communities, Bollywood and other film industries, celebrity gossip, memes, students, finance, lifestyle and gaming. It matches **subreddit identity only**, so an international news post about India in r/worldnews stays visible. |
| **India: broad name patterns** | off | `India*`, `*India`, `Indian*`, with known false positives excluded (Indiana, Indianapolis, IndianCountry, Indian Motorcycle and others). Review it before switching it on. |
| **Webcomics** | on | 54 webcomic and comic-strip subreddits (r/comics, r/webcomics, r/xkcd and others), plus phrase-level title keywords such as "comic strip", "webcomic" and "[OC] comic". |
| **Celebrity gossip** | off | Fauxmoi, popculturechat, royal gossip and similar. It doesn't include fan communities or general entertainment news. |
| **Reality TV** | off | Real Housewives, Bachelor, 90 Day Fiancé, Love Island and others. |
| **Snark communities** | off | The pattern `*snark*` plus a list of snark subs without "snark" in the name. Known false positives (e.g. r/SnarkyPuppy, a jazz band) are excluded. |
| **Streamers & influencer drama** | off | LivestreamFail, youtubedrama and major streamer communities. |
| **US politics** | off | About 70 US political subreddits from left, right and centre, plus a few general subs that are political in practice (e.g. WhitePeopleTwitter). |
| **Political headlines** | off | About 50 title keywords (politicians and institutions) that hide political posts in *any* subreddit. It's blunt by design. Ambiguous words like "Harris", "election" and "ICE" are left out. |
| **Rage bait & freakouts** | off | PublicFreakout, TikTokCringe, fight and "Karen" subs, and similar. |

Every subreddit name in these lists was checked against subreddit metadata. Dead or banned communities were dropped.

You can add your own categories, such as celebrity gossip, politics or crypto.

## Features

- **Filtering engine** with exact, wildcard and keyword rules, per-category exclusions, a global allowlist, category toggles, a master switch and a one-hour pause.
- **Feed scope**: Popular only (default), Popular and All, plus Home, or all feeds including custom feeds and multireddits. Single-subreddit pages and comment pages are never filtered, so you can always visit a blocked community.
- **One-click blocking**: hover a post and a small ⊘ button appears next to Reddit's Join / ⋯ buttons. From it you can hide the subreddit, add it to any category (or a new one), add a title keyword, or allowlist it. The change applies at once in every open tab, and you can undo it.
- **Toolbar popup** with the master toggle, per-category toggles, posts hidden this session (in total and per category), lifetime total, active rule count, pause, stats reset and a link to settings. The toolbar badge shows how many posts are hidden in the current tab.
- **Settings page** for creating, renaming, reordering, toggling and deleting categories. Each category has searchable rule lists (fine for 150+ entries). There's also a global rule search, allowlist management, a rule tester, JSON import/export with validation, and reset to defaults.
- **Dim mode**: instead of hiding matches, fade them and label them with the matching rule. This is handy for checking your rules.
- Works on the current Reddit desktop site and on **old.reddit.com**.

## Install (temporary, for development)

Requirements: Firefox 142 or newer, and Node.js 20 or newer.

```sh
npm install
npm run build          # outputs the unpacked extension to dist/
```

1. Open **`about:debugging#/runtime/this-firefox`** in Firefox.
2. Click **Load Temporary Add-on…**
3. Select **`dist/manifest.json`**.
4. Visit <https://www.reddit.com/r/popular/>.

Temporary add-ons are removed when Firefox quits, but your settings are kept, since Firefox keys stored data by the add-on ID and this manifest has a fixed ID.

**After rebuilding**, click **Reload** next to the extension on the same `about:debugging` page, then reload any open Reddit tabs.

Alternatively, `npm run start:firefox` launches a separate Firefox profile with the extension loaded, and it auto-reloads when `dist/` changes (use `npm run watch` in another terminal).

## Build, test, package

| Command | What it does |
|---|---|
| `npm run build` | Bundle the TypeScript with esbuild into `dist/` |
| `npm run watch` | Rebuild scripts on change (restart it to pick up HTML, CSS or manifest changes) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit and DOM integration tests (Vitest + jsdom) |
| `npm run lint:ext` | Mozilla's `web-ext lint` on `dist/` |
| `npm run check` | All of the above |
| `npm run package` | Build and produce `web-ext-artifacts/reddit-feed-curator-<version>.xpi` |
| `npm run test:live` | Smoke test against **live reddit.com** in a throwaway headless Firefox (needs network; `HEADFUL=1` to watch) |

### Distributable package

`npm run package` produces an **unsigned** `.xpi`. Release Firefox only installs signed add-ons permanently, so there are two routes:

- **Self-distribution (recommended for personal use):** get API credentials from <https://addons.mozilla.org/developers/addon/api/key/>, then run
  `npx web-ext sign --source-dir dist --channel unlisted --api-key $AMO_JWT_ISSUER --api-secret $AMO_JWT_SECRET`.
  Mozilla signs the add-on without listing it publicly, and you install the resulting `.xpi` by opening it in Firefox.
- **Unsigned:** Firefox Developer Edition, Nightly or ESR can install the unsigned `.xpi` after you set `xpinstall.signatures.required` to `false` in `about:config`.

## Using it

- **Popup** (toolbar icon): quick toggles and statistics. The counts are real filtering decisions, and each post is counted once per browser session, however often Reddit re-renders it.
- **In-feed ⊘ button**: hover any post in a feed. "Hide r/X" adds the subreddit to a *Blocked subreddits* category, which is created on first use.
- **Settings**: from the popup, the ⊘ menu, or `about:addons` → Reddit Feed Curator → Preferences.

### Rule types

| Type | Matches | Example |
|---|---|---|
| Exact subreddit | Whole subreddit name, case-insensitive. `r/X`, `/r/X/`, `X` and full URLs are all accepted. | `TeenIndia` |
| Wildcard pattern | Subreddit **name**. `*` means any characters and `?` means one character. There are no regular expressions. | `*India`, `India*`, `delh?` |
| Title keyword | Whole word or phrase in the post **title**, case-insensitive. A trailing `*` matches the start of a word. | `comic strip`, `comic*` |
| Exclusion | Exempts subreddits (or patterns) from one category. | `Indiana*` |
| Allowlist | Exempts a subreddit from **every** category. | `IndiaSpeaks` |

Rules are checked in this order: master switch or pause, then the allowlist, then exact rules in all categories, then patterns, then keywords. The first match wins, and within each tier categories are checked in the order they're listed. Use the **Rule tester** in settings to see which rule would fire.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Saves your categories and rules (`storage.local`) and session statistics (`storage.session`). |
| Content script on `https://www.reddit.com/*`, `https://reddit.com/*`, `https://old.reddit.com/*`, `https://new.reddit.com/*` | Reads post metadata from the page and hides matching posts. These are the only sites the extension touches. |

It needs no `tabs`, `history`, `webRequest` or `<all_urls>` permission. The manifest declares `data_collection_permissions: none`. The extension never modifies your Reddit account, never syncs with Reddit's muted communities, loads no remote code and injects no HTML strings. All user-supplied text is rendered with `textContent`.

## Architecture

```
src/
  filtering/      engine.ts (pure: config → compiled rules → decision), matchers.ts (glob + keyword), normalization.ts
  storage/        schema.ts (versioned types), defaults.ts (seed merge), migrations.ts, validation.ts (import), config-ops.ts (pure edits), config-store.ts (browser.storage)
  data/           india.ts, webcomics.ts (seed datasets, versioned)
  content/        reddit-adapter.ts (all DOM knowledge), feed-observer.ts (MutationObserver + hide/unhide), feed-scope.ts (URL → page kind), post-actions.ts (⊘ menu), index.ts
  background/     index.ts (badge, messages), stats-tracker.ts (deduplicated counts)
  popup/, options/, shared/
static/           manifest.json, content.css, icons
tests/            engine, storage/migrations/import, feed scope, stats, DOM integration (fixtures model real Reddit markup)
scripts/          build.mjs (esbuild), live-smoke.mjs
```

Key decisions:

- **Manifest V3** with a Firefox event-page background (`background.scripts`), since Firefox MV3 doesn't need service workers. The minimum version is Firefox 142, the first version that supports the `data_collection_permissions` key on both desktop and Android.
- **TypeScript and esbuild with no runtime dependencies or framework.** The UI is small enough for plain DOM code, via a small `h()` helper that only sets text.
- **Reddit adapter.** Current Reddit renders each feed post as `<article><shreddit-post subreddit-prefixed-name=… post-title=… permalink=… id="t3_…">…</shreddit-post></article><hr>`, and these attributes are server-rendered. The adapter reads them, falls back to parsing the permalink, and never relies on CSS utility classes. Ads (`<shreddit-ad-post>`, old-reddit `.promoted`), sidebar items, comments and crosspost previews are left alone. This was verified against live reddit.com on 25 Sep 2026 (see *Testing*).
- **Hiding.** A data attribute goes on the `<article>` (plus its `<hr>` separator), and CSS that is injected at `document_start` hides it. Nodes are never removed, so Reddit's rendering is undisturbed, and un-hiding is just removing the attribute.
- **Efficiency.** Rules are compiled once per configuration change: sets for exact names, a linear-time glob matcher for patterns, and one escaped-literal regex for keywords, so user input can't cause catastrophic backtracking. The config is cached in memory in each tab. A `WeakMap` records which elements were evaluated with which rule version, so repeated mutations cost almost nothing and removed nodes are garbage-collected. The key sets used for counting are bounded at 5,000 entries.
- **Seed updates never clobber user edits.** Each built-in category records its seed version and any seed entries you removed. Newer seed data only adds entries you haven't removed, and a built-in category you delete stays deleted.
- **In-feed UI.** One floating button and menu live in a closed Shadow DOM hosted outside Reddit's tree. It's a plain `<div>`, because Reddit hides undefined custom elements. Reddit's own elements are never modified.
- **Future extensions.** `PostMetadata` already carries `postType`, `domain` and `flair` slots. An optional image classifier, flair rules or crosspost-origin rules would be new tiers in `engine.ts` fed by new adapter fields, with no change to existing rules. Remote rule lists, profile support and importing Reddit's muted list are deliberately not implemented.

## Testing

**Automated (`npm test`, 96 tests):**
- Engine: case-insensitivity, normalisation, exact, wildcard and keyword matching, allowlist precedence, rule-type precedence, conflicting rules across categories, disabled categories, pause expiry, duplicate rules, pathological patterns, and a 20,000-rule performance check.
- Storage: validation, import error messages, import/export round trips, v0→v1 migration, refusal of configs from newer versions, seed merging that respects user removals and deletions, and config operations.
- DOM integration (jsdom, markup modelled on live Reddit): matching posts hidden and others visible, separators, ads, sidebar and crosspost handling, infinite-scroll insertion, late-arriving attributes, category disable restoring posts, allowlist, feed scope, client-side navigation, no double counting, and old.reddit.
- Stats: deduplication across concurrent tab reports, reset behaviour, and bounded tracking.

**Live (`npm run test:live`, and exploratory runs during development, 25 Sep 2026, Firefox 156, logged out):**
- On `/r/popular` (India geo filter), the extension hid 9 to 16 of about 30 posts, all from India-specific subreddits, and general subreddits stayed visible.
- Posts loaded by infinite scroll were filtered as they arrived.
- The ⊘ button appeared beside Join. "Hide r/X" hid the post immediately.
- Visiting a blocked subreddit (`/r/TwentiesIndia/`) showed its posts normally.
- The options page and popup rendered with no script errors, and the rule tester, search and import error reporting worked.

Not yet verified live: logged-in Home feed, old.reddit.com (covered only by fixture tests), and Firefox for Android.

### Manual checklist

1. Load the extension, open `/r/popular`, and confirm the badge count increases and no India or webcomic subreddits are visible.
2. Switch to **Dim** mode in settings and confirm matched posts show a red "Hidden: r/X (category)" label.
3. Popup: turn India off. Its posts reappear in the open tab without a reload. Turn it back on and they disappear again.
4. Hover a post, click ⊘, then **Hide r/X**. It disappears. Click **Undo** and it comes back.
5. ⊘ → **Add title keyword…** → add a word from a visible title. That post disappears.
6. Open a blocked subreddit directly (`/r/bollywood`). Its posts are visible.
7. Settings → scope **Popular and All**, then open `/r/all`. Filtering applies.
8. Export, reset to defaults, then import the exported file. Your rules come back.
9. Pause for one hour from the popup. Posts reappear, and **Resume** hides them again.

## Known limitations

- Reddit changes its frontend without notice. If `npm run test:live` starts failing, the fix belongs in `src/content/reddit-adapter.ts`.
- The India seed list can't be exhaustive, and new communities appear all the time. Use the ⊘ button, or enable the pattern category after reviewing it. During testing, r/TharCriminals (India-focused) was one that wasn't in the list.
- Keyword rules only see titles. Image-only comics in general subreddits aren't caught unless their title says so; an image classifier is a possible future module.
- Statistics count posts hidden in feeds you actually loaded. Session stats reset when Firefox restarts.
- The ⊘ button appears on hover, so there's no touch or keyboard-only way to reach it yet. Everything it does is also available in settings.
- An unsigned `.xpi` can't be installed permanently on release Firefox (see *Distributable package*).
