import type { SeedCategory } from "./seed-types";

/**
 * Communities dedicated to mocking specific influencers or public figures.
 * Most have "snark" in their name, so a pattern does most of the work; the
 * explicit list covers the ones that don't. Known false positives of the
 * pattern are excluded (a jazz band, nurse humour, sarcastic-reply subs).
 */
export const SNARK_SEED: SeedCategory = {
  id: "snark",
  version: 1,
  name: "Snark communities",
  description: "Subreddits dedicated to mocking specific influencers, bloggers or public figures.",
  enabledByDefault: false,
  rules: {
    subreddits: [
      "FundieSnarkUncensored", "blogsnark", "DuggarsSnark", "NYCinfluencersnark", "LAinfluencersnark",
      "KUWTKsnark", "SaintMeghanMarkle", "ColleenBallingerSnark", "brittanydawnsnark", "h3snark",
      "AlixearleSnark", "InfluencerSnark", "CallHerDaddySnark", "snarkingwithremi", "ballerinafarmsnark",
      "blakelivelysnark", "Snark4sunnyChristina", "travisandtaylor", "mrbeastsnark", "livvydunnesnark",
      "sabrinacarpentersnark", "snarkingonselena", "GabbieHannaSnark", "mominfluencersnark",
      "christinahaacksnark", "ausinfluencersnark", "dcinfluencersnark",
    ],
    patterns: ["*snark*"],
    keywords: [],
  },
  exclusions: ["SnarkyPuppy", "snarkynurses", "snarkyreplies", "SnarkTank", "snarkingonthesnarkers", "Snarky"],
};
