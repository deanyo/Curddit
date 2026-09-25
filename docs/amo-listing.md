# AMO submission kit: Feed Curator for Reddit

The text for each field of the addons.mozilla.org submission form. Paste it as-is.

## Basics

- **Name:** Feed Curator for Reddit
- **Add-on URL slug:** feed-curator-for-reddit
- **Summary** (max 250 characters):
  > Hide whole categories of Reddit communities from your feeds: celebrity gossip, politics, snark, streamer drama, webcomics and more. Add your own rules by subreddit, name pattern or title keyword. Runs entirely in your browser.
- **Categories:** Social & Communication; Privacy & Security (optional second)
- **Tags:** reddit, filter, block, mute, feed, subreddit
- **Licence:** GNU General Public License v3.0
- **Homepage:** https://github.com/deanyo/Curddit
- **Support site:** https://github.com/deanyo/Curddit/issues
- **Contributions URL:** https://buymeacoffee.com/deanyo
- **Privacy policy:** none required (the add-on collects no data; the manifest declares `data_collection_permissions: none`). The description states this explicitly.

## Description

Reddit only lets you mute communities one at a time. Feed Curator for Reddit lets you hide whole *kinds* of communities from Popular, All or your Home feed at once, and add your own rules.

**Ready-made categories (all off until you switch them on):**
- Celebrity gossip
- Reality TV
- Snark communities
- Streamers & influencer drama
- US politics
- Political headlines (by title keyword, in any subreddit)
- Rage bait & freakouts
- Webcomics
- India-specific communities (plus an optional name-pattern variant)

**Make your own categories** from any mix of:
- exact subreddits (r/example)
- name patterns (*snark*, India*)
- whole-word title keywords ("comic strip")
- exclusions, plus a global "always show" allowlist

**One-click blocking:** hover any post and click the small ⊘ button to hide that community, add it to a category, add a title keyword, or always show it. It takes effect instantly and can be undone.

**Also included:**
- Choose where it filters: Popular only, Popular and All, the Home feed, or every feed. Visiting a community directly is never filtered.
- Dim mode shows matched posts faded, labelled with the rule that caught them. It's handy for checking your rules.
- Popup with per-category toggles, a pause button and counts of hidden posts.
- A rule tester, searchable rule lists, and JSON import/export.
- Works on the current Reddit site and on old.reddit.com.

**Privacy:** everything runs locally. There's no account, no Reddit API, no analytics and no network requests. Your rules are stored only in your browser. The add-on never changes your Reddit account or its settings.

Free and open source (GPL-3.0): https://github.com/deanyo/Curddit

*Not affiliated with or endorsed by Reddit, Inc.*

## Notes for reviewers

- **Source:** the submitted add-on is bundled with esbuild from TypeScript. It isn't minified, and there's no obfuscation or remote code. Upload `web-ext-artifacts/feed-curator-for-reddit-source.zip` (from `npm run package:source`) as the source-code archive.
- **Build:** Node.js 20 or later, then run `npm ci && npm run build`. The output goes to `dist/`, and `npm run package` produces the `.xpi`.
- **Permissions:** `storage` only, plus content scripts on reddit.com hosts. The add-on opens a welcome tab on first install with `tabs.create`, which needs no permission.
- **Testing:** load it, then open https://www.reddit.com/r/popular/. Switch on a category such as "Webcomics" from the toolbar popup, or set "Dim" mode in settings to see what's matched.

## Screenshots (docs/screenshots/, 1280×800)

1. `1-feed-dim.png`: r/popular in dim mode, with matched posts labelled
2. `2-menu.png`: the in-feed ⊘ menu
3. `3-popup.png`: toolbar popup with category toggles
4. `4-settings.png`: settings page showing a category's rules
5. `5-welcome.png`: the first-run category picker
