# Chrome Web Store submission kit: Feed Curator for Reddit

Build the upload with `npm run package:chrome`, which produces `web-ext-artifacts/feed-curator-for-reddit-chrome-<version>.zip`. The same zip works for **Microsoft Edge Add-ons** (free, at partner.microsoft.com/dashboard/microsoftedge).

## Account

- Register at https://chrome.google.com/webstore/devconsole. There's a one-off US$5 fee, and Google may ask you to verify your identity.
- **New item → Upload** the zip.

## Store listing tab

- **Description:** use the "Description" section of [amo-listing.md](amo-listing.md) as-is.
- **Category:** Social & Communication (if not offered, pick the closest, e.g. "Tools").
- **Language:** English.
- **Store icon:** `static/icons/icon-128.png`.
- **Screenshots** (1280×800): `docs/screenshots/1-feed-dim.png`, `2-menu.png`, `3-popup.png`, `4-settings.png`, `5-welcome.png`.
- **Small promo tile** (440×280): `docs/screenshots/chrome-promo-440x280.png`.
- **Official URL:** none. **Homepage URL:** https://github.com/deanyo/Curddit. **Support URL:** https://github.com/deanyo/Curddit/issues

## Privacy practices tab

**Single purpose description:**
> Hides posts from Reddit feeds that match categories and rules the user chooses (subreddit names, name patterns, title keywords), entirely within the browser.

**Permission justification:**
- `storage`:
  > Saves the user's categories, filtering rules and settings, and counts of hidden posts, locally in the browser.
- **Host permissions** (content script on reddit.com, www.reddit.com, old.reddit.com, new.reddit.com):
  > Needed to read each feed post's subreddit and title on Reddit pages, and to hide the posts that match the user's rules. The extension runs on no other sites.

**Are you using remote code?** No, I am not using remote code.

**Data usage:** tick **none** of the data types. The extension collects no personally identifiable information, health, financial, authentication, personal communication, location, web history, user activity or website content data.

Then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://github.com/deanyo/Curddit/blob/main/PRIVACY.md

## Distribution tab

- Visibility: **Public**. Regions: all. Pricing: free.

## Notes

- Review can take from a few hours to a couple of weeks. Host permissions sometimes trigger an "in-depth review" notice, which is normal.
- For each update, bump `version` in `package.json`, run `npm run package:chrome`, then use **Upload new package** on the item.
