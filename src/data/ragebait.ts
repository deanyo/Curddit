import type { SeedCategory } from "./seed-types";

/**
 * Freakout, cringe and outrage-bait communities that frequently reach
 * r/popular. Several (fightporn, CrazyFuckingVideos, NoahGetTheBoat,
 * PublicFreakout) regularly carry graphic violence.
 */
export const RAGEBAIT_SEED: SeedCategory = {
  id: "rage-bait",
  version: 1,
  name: "Rage bait & freakouts",
  description: "Public freakouts, cringe compilations, fights and outrage-bait communities.",
  enabledByDefault: false,
  rules: {
    subreddits: [
      "PublicFreakout", "ActualPublicFreakouts", "TikTokCringe", "iamatotalpieceofshit",
      "CrazyFuckingVideos", "fightporn", "FuckYouKaren", "instantkarma", "trashy",
      "ImTheMainCharacter", "NoahGetTheBoat", "CringeTikToks", "EntitledPeople", "entitledparents",
      "ChoosingBeggars", "karen", "IdiotsInCars", "Nicegirls", "iamverysmart", "JustBootThings",
    ],
    patterns: [],
    keywords: [],
  },
  exclusions: [],
};
