import type { SeedCategory } from "./seed-types";

/**
 * Tumblr screenshot and repost communities. Every relevant subreddit has
 * "tumblr" in its name, so a pattern does the work; the big ones are also
 * listed explicitly. The keyword catches Tumblr screenshots posted to
 * general subreddits (titles like "Tumblr at it again").
 */
export const TUMBLR_SEED: SeedCategory = {
  id: "tumblr",
  version: 1,
  name: "Tumblr",
  description: "Tumblr screenshot communities (r/tumblr, r/CuratedTumblr...) and posts titled as Tumblr content.",
  enabledByDefault: false,
  rules: {
    subreddits: ["tumblr", "CuratedTumblr", "TumblrDraws", "TumblrWrites", "tumblrhappened"],
    patterns: ["*tumblr*"],
    keywords: ["tumblr"],
  },
  exclusions: [],
};
