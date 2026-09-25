import type { SeedCategory } from "./seed-types";

/**
 * US politics communities from across the spectrum, plus a small set of
 * nominally general subreddits whose front pages are overwhelmingly
 * political in practice. Broader "often political" subs (r/facepalm,
 * r/clevercomebacks, r/AdviceAnimals...) are not included; add them yourself
 * if you want. Dead/banned subs (the_donald, GOP) were dropped.
 */
export const POLITICS_SEED: SeedCategory = {
  id: "us-politics",
  version: 1,
  name: "US politics",
  description: "US political communities (left, right and centre), matched by subreddit only.",
  enabledByDefault: false,
  rules: {
    subreddits: [
      // Left / liberal
      "politics", "democrats", "PoliticalHumor", "LeopardsAteMyFace", "TheRightCantMeme",
      "TrumpCriticizesTrump", "SandersForPresident", "MurderedByAOC", "Fuckthealtright",
      "ENLIGHTENEDCENTRISM", "Keep_Track", "Political_Revolution", "MarchAgainstNazis", "ParlerWatch",
      "DemocraticSocialism", "CapitolConsequences", "AOC", "Trumpgret", "Liberal", "esist", "50501",
      "Defeat_Project_2025", "Trumpvirus", "JoeBiden", "progressive", "MarchAgainstTrump",
      "KamalaHarris", "VoteDEM", "VoteBlue", "somethingiswrong2024", "RepublicanValues",
      // Right / conservative
      "Conservative", "Republican", "trump", "AskThe_Donald", "walkaway", "conservatives",
      "ShitPoliticsSays", "ConservativeMemes", "ConservativesOnly", "benshapiro", "TheLeftCantMeme",
      "libsofreddit", "AskConservatives", "dailywire", "tuesday",
      // Centre / mixed / discussion
      "PoliticalDiscussion", "NeutralPolitics", "PoliticalCompassMemes", "Libertarian",
      "moderatepolitics", "Anarcho_Capitalism", "IntellectualDarkWeb", "scotus", "AskTrumpSupporters",
      "WayOfTheBern", "Ask_Politics", "Askpolitics", "centrist", "AskALiberal", "PoliticalMemes",
      "fivethirtyeight", "uspolitics", "AmericanPolitics", "Presidentialpoll",
      // General in name, political in practice
      "WhitePeopleTwitter", "QAnonCasualties", "Qult_Headquarters", "HermanCainAward",
    ],
    patterns: [],
    keywords: [],
  },
  exclusions: [],
};

/**
 * Title keywords for political posts in *any* subreddit. Kept separate from
 * the subreddit list because it is much blunter. Ambiguous words were left
 * out on purpose: bare surnames shared with others (Harris, Johnson, Miller,
 * Kennedy, Cruz), "election"/"president"/"vote" (non-US uses), "ICE"
 * (matches "ice"), "DOGE" (Dogecoin), "Musk", "tariff", "border".
 */
export const POLITICAL_HEADLINES_SEED: SeedCategory = {
  id: "political-headlines",
  version: 1,
  name: "Political headlines",
  description: "Hides posts in any subreddit whose title mentions major US political figures or institutions. Broad: expect some non-political posts to be caught.",
  enabledByDefault: false,
  rules: {
    subreddits: [],
    patterns: [],
    keywords: [
      "Trump", "MAGA", "GOP", "Republicans", "Democrats", "Democratic Party", "Project 2025",
      "Vance", "Hegseth", "Rubio", "Pam Bondi", "Kash Patel", "RFK Jr", "Kristi Noem",
      "Karoline Leavitt", "Tulsi Gabbard", "Speaker Johnson", "Mike Johnson", "Schumer",
      "Hakeem Jeffries", "John Thune", "Mitch McConnell", "Nancy Pelosi", "Marjorie Taylor Greene",
      "AOC", "Ocasio-Cortez", "Bernie Sanders", "Gavin Newsom", "DeSantis", "Mamdani", "Tim Walz",
      "Kamala Harris", "Biden", "Obama", "Senate", "Senator", "Congress", "congressman",
      "congresswoman", "House Republicans", "House Democrats", "Supreme Court", "SCOTUS",
      "executive order", "White House", "filibuster", "impeach", "impeachment", "midterms",
      "Oval Office",
    ],
  },
  exclusions: [],
};
