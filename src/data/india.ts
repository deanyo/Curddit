import type { SeedCategory } from "./seed-types";

/**
 * India-specific communities, matched by subreddit identity only: no title
 * keywords, so international news about India in general subreddits is not
 * affected.
 *
 * The first block is the user's existing manually-muted list. The rest were
 * checked against subreddit metadata (Arctic Shift snapshot, early 2025).
 * Names that are misleading were deliberately left out: r/NEET (not the exam),
 * r/CAT (cats), r/GATE (anime) and r/Cricket (global).
 */
const USER_MUTED = [
  "TeenIndia", "SnacksIndia", "TwentiesIndia", "AllindiaStudentUnion", "BollywoodShaadis",
  "Indianbooks", "TamilNadu", "IndianGaming", "pune", "BollyBlindsNGossip", "FingMemes",
  "TwoXIndia", "IndiaInvestments", "GadgetsIndia", "kolkata", "IndiaTech", "bangalore",
  "Kerala", "AajMaineJana", "indiafood", "developersIndia", "bollywood", "Indiangamers",
  "ZyadaKuchNai", "InstaCelebsGossip",
];

const GENERAL = [
  "india", "IndiaSpeaks", "indiasocial", "unitedstatesofindia", "indiadiscussion",
  "IndiaNonPolitical", "indianews", "AskIndia", "AskIndianWomen", "IndianTeenagers",
  "IndiaNostalgia", "IndiaTrending", "IndiasGotLatent", "IndianModerate", "librandu",
  "HindutvaRises",
];

const CITIES_AND_STATES = [
  "mumbai", "delhi", "hyderabad", "Chennai", "Chandigarh", "ahmedabad", "lucknow", "jaipur",
  "Indore", "Bhopal", "gurgaon", "noida", "navimumbai", "thane", "Kochi", "Coimbatore",
  "nagpur", "mangalore", "mysore", "surat", "vadodara", "Bhubaneswar", "guwahati", "kanpur",
  "nashik", "Dehradun", "kozhikode", "Bengaluru", "Madurai", "kolhapur", "ludhiana",
  "amritsar", "gujarat", "karnataka", "Maharashtra", "punjab", "uttarpradesh", "Uttarakhand",
  "HimachalPradesh", "Goa", "assam", "Odisha", "bihar", "Rajasthan", "westbengal",
  "Telangana", "Jharkhand", "Chhattisgarh", "kashmir",
];

const ENTERTAINMENT_AND_MEMES = [
  "bollywoodmemes", "IndianCinema", "IndianOTTbestof", "IndianTellyTalk", "MalayalamMovies",
  "tollywood", "kollywood", "biggboss", "indiancelebs", "IndianHipHopHeads", "Ni_Bondha",
  "IndianStandUpComedy", "indiameme", "IndianDankMemes", "SaimanSays", "DesiVideoMemes",
  "indianmemer", "desimemes", "IndianMeyMeys", "CricketShitpost", "TheRawKnee",
  "IndianMemeTemplates", "tamilmemes", "MalayalamMemes",
];

const STUDENTS_AND_CAREERS = [
  "JEENEETards", "Btechtards", "JEE", "CBSE", "UPSC", "Indian_Academia", "indianmedschool",
  "IndiaCareers", "Indians_StudyAbroad", "IndianWorkplace",
];

const FINANCE_TECH_LIFESTYLE = [
  "IndianStockMarket", "IndianStreetBets", "personalfinanceindia", "IndiaTax",
  "CreditCardsIndia", "FIREIndia", "DalalStreetTalks", "StartUpIndia", "indianstartups",
  "MutualfundsIndia", "IndianFashionAddicts", "IndianSkincareAddicts", "IndianMakeupAddicts",
  "IndianPets", "CarsIndia", "indianbikes", "IndiaCoffee", "Fitness_India", "LegalAdviceIndia",
  "india_tourism", "indianrailways", "IndianHistory", "IndianFestivals",
];

/**
 * Seen on the live India-geo Popular feed (Sept 2026): a scan of ~330
 * subreddits, classified by their descriptions plus manual review. Several
 * (Indiedogs, TharCriminals, NoidaWale, Panvel, TMKOC) have no "India" in the
 * name, so only an exact list catches them.
 */
const SEEN_LIVE = [
  "CriticalThinkingIndia", "splitsvillaMTV", "IndiaMemes", "JKreacts", "carIndia", "bollynewsandgossips",
  // v2
  "Indiedogs", "TharCriminals", "funnyIndia", "ps5india", "TMKOC", "Frugal_Ind", "IndiaBusiness",
  "BollywoodHotTakes", "bollywoodgossips", "IndiaThriftCorner", "BangaloreSocial", "Bigbossmalayalam5",
  "valorantindia", "TamilNaduDiscussion", "techIndia", "Hyd_DaTinG", "IndianCats", "sidehustleIndia",
  "IndianFocus", "RealTeensIndia", "Indian_flex", "NoidaWale", "Panvel", "PataHaiAajKyaHua",
  "IndiansinIreland",
];

const SPORT_AND_GAMING = [
  "IndiaCricket", "ipl", "IndianFootball", "indiansports", "indiasports", "IndiaPS5",
];

export const INDIA_SEED: SeedCategory = {
  id: "india",
  version: 2,
  name: "India-specific communities",
  description:
    "Regional, city and state communities plus Indian entertainment, gossip, memes, student, finance and lifestyle subreddits. Matches subreddits only, not post titles.",
  enabledByDefault: false,
  rules: {
    subreddits: [
      ...USER_MUTED,
      ...GENERAL,
      ...CITIES_AND_STATES,
      ...ENTERTAINMENT_AND_MEMES,
      ...STUDENTS_AND_CAREERS,
      ...FINANCE_TECH_LIFESTYLE,
      ...SPORT_AND_GAMING,
      ...SEEN_LIVE,
    ],
    patterns: [],
    keywords: [],
  },
  exclusions: [],
};

/**
 * Broad name patterns, kept as a separate category that is OFF by default.
 * "Indian*" also matches Indiana, Indianapolis, Indiana Jones, Indian
 * Motorcycle and Native American communities, so those are excluded
 * up front. Review before enabling.
 */
export const INDIA_PATTERNS_SEED: SeedCategory = {
  id: "india-patterns",
  version: 1,
  name: "India: broad name patterns",
  description:
    "Catches any subreddit whose name starts or ends with India/Indian, including new ones not on the list. Broader, so review before enabling; known false positives (Indiana, IndianCountry, etc.) are excluded.",
  enabledByDefault: false,
  rules: {
    subreddits: [],
    patterns: ["India*", "*India", "Indian*"],
    keywords: [],
  },
  exclusions: [
    "Indiana*", "IndianCountry", "americanindian", "IndianMotorcycle", "IndianScout",
    "indianringneck", "IndianRunnerDucks", "India_Summer", "IndiaReynolds_",
  ],
};
