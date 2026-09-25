import type { SeedCategory } from "./seed-types";

/**
 * Communities dedicated to webcomics, comic strips and recurring online comic
 * series (checked against subreddit metadata, early 2025). General comic-book
 * communities (Marvel, DC, etc.) are intentionally not included.
 *
 * Keywords are phrase-level to catch comic posts in general subreddits without
 * matching every mention of "comic" (comic books, Comic-Con).
 */
export const WEBCOMICS_SEED: SeedCategory = {
  id: "webcomics",
  version: 1,
  name: "Webcomics",
  description: "Webcomic and comic-strip communities, plus comic-style post titles in general subreddits.",
  enabledByDefault: true,
  rules: {
    subreddits: [
      "comics", "webcomics", "WebComic", "xkcd", "webtoons", "webtoon", "ComicStrips",
      "comicstriphistory", "WholesomeComics", "calvinandhobbes", "imsorryjon", "garfield",
      "garfieldminusgarfield", "peanuts", "TheFarSide", "CyanideandHappiness",
      "ExtraFabulousComics", "StrangePlanet", "mrlovenstein", "SafelyEndangered", "WarAndPeas",
      "theodd1sout", "homestuck", "Lore_Olympus", "Lackadaisy", "killsixbilliondemons",
      "questionablecontent", "loadingartist", "adamtots", "oots", "Twokinds", "dilbert",
      "Foxtrot", "BloomCounty", "pearlsbeforeswine", "poorlydrawnlines", "sarahandersen",
      "TheOatmeal", "gunnerkrigg", "paranatural", "elgoonishshive", "girlgenius", "achewood",
      "PennyArcade", "dumbingofage", "SarahScribbles", "TheAwkwardYeti", "dresdencodak",
      "Unsounded", "sleeplessdomain", "LINEwebtoon", "PerryBibleFellowship", "oglaf", "sinfest",
    ],
    patterns: [],
    keywords: [
      "webcomic", "web comic", "comic strip", "comic strips", "[OC] comic", "(OC) comic",
      "OC comic", "I made a comic", "a comic I made", "comic I drew", "short comic", "4-panel",
      "four panel", "3-panel comic", "one-panel comic", "comic dub", "[comic]", "(comic)",
      "daily comic", "xkcd",
    ],
  },
  exclusions: [],
};
