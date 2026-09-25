import type { SeedCategory } from "./seed-types";

/**
 * Streamer clips and influencer drama. Includes the big clip/drama hubs
 * (r/LivestreamFail) and communities for the streamers that dominate them.
 * General "drama" subs (r/HobbyDrama, r/SubredditDrama) are left out.
 */
export const STREAMERS_SEED: SeedCategory = {
  id: "streamers",
  version: 1,
  name: "Streamers & influencer drama",
  description: "LivestreamFail, YouTube/Twitch drama and major streamer communities.",
  enabledByDefault: false,
  rules: {
    subreddits: [
      "LivestreamFail", "youtubedrama", "internetdrama", "h3snark", "YoutubeCompendium",
      "KickStreaming", "h3h3productions", "Asmongold", "xqcow", "offlineTV", "Pokimane",
      "LudwigAhgren", "Ishowspeed", "DarkViperAU", "KaiCenat", "caseoh_", "Mizkif",
      "moistcr1tikal", "penguinz0", "Destiny", "Hasan_Piker", "VaushV",
    ],
    patterns: [],
    keywords: [],
  },
  exclusions: [],
};
