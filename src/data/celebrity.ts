import type { SeedCategory } from "./seed-types";

/**
 * Celebrity and royal gossip. Fan communities for individual artists
 * (e.g. r/TaylorSwift) and general entertainment news (r/movies,
 * r/entertainment) are intentionally not included. Verified against
 * subreddit metadata, Sept 2026; r/Deuxmoi was dropped as inactive.
 */
export const CELEBRITY_SEED: SeedCategory = {
  id: "celebrity-gossip",
  version: 1,
  name: "Celebrity gossip",
  description: "Celebrity, royal and pop-culture gossip communities.",
  enabledByDefault: false,
  rules: {
    subreddits: [
      "Fauxmoi", "popculturechat", "BeautyGuruChatter", "tiktokgossip", "KUWTK", "Kardashians",
      "celebrities", "popculture", "RoyalsGossip", "royalfamily", "BRF", "SaintMeghanMarkle",
      "travisandtaylor", "SwiftlyNeutral", "MeghanMarkle", "KateMiddleton", "blakelively",
      "Instagramreality", "ItEndsWithLawsuits", "JustinBaldoni",
    ],
    patterns: [],
    keywords: [],
  },
  exclusions: [],
};

export const REALITY_TV_SEED: SeedCategory = {
  id: "reality-tv",
  version: 1,
  name: "Reality TV",
  description: "Reality-TV franchises and their gossip communities (Real Housewives, Bachelor, 90 Day Fiancé, Love Island...).",
  enabledByDefault: false,
  rules: {
    subreddits: [
      "BravoRealHousewives", "realhousewives", "vanderpumprules", "Southerncharm", "thebachelor",
      "BachelorNation", "90DayFiance", "90dayfianceuncensored", "TeenMomOGandTeenMom2",
      "LoveIsBlindOnNetflix", "LoveIslandTV", "LoveIslandUSA",
    ],
    patterns: [],
    keywords: [],
  },
  exclusions: [],
};
