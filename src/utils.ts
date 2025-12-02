import type { Event, CategoriesData } from "./types.js";

export const GAMMA_API_BASE = "https://gamma-api.polymarket.com";
export const CLOB_API_BASE = "https://clob.polymarket.com";

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  politics: [
    "election",
    "president",
    "congress",
    "senate",
    "vote",
    "democrat",
    "republican",
    "trump",
    "biden",
    "harris",
    "governor",
    "political",
  ],
  crypto: [
    "bitcoin",
    "btc",
    "ethereum",
    "eth",
    "crypto",
    "token",
    "blockchain",
    "defi",
    "nft",
    "solana",
    "usdt",
    "tether",
  ],
  sports: [
    "nba",
    "nfl",
    "mlb",
    "nhl",
    "soccer",
    "football",
    "basketball",
    "baseball",
    "hockey",
    "championship",
    "super bowl",
    "playoffs",
    "game",
  ],
  world: [
    "ukraine",
    "russia",
    "china",
    "israel",
    "iran",
    "war",
    "nato",
    "ceasefire",
    "military",
    "nuclear",
  ],
  entertainment: [
    "movie",
    "film",
    "music",
    "album",
    "concert",
    "celebrity",
    "tv",
    "show",
    "oscar",
    "grammy",
  ],
  economy: [
    "gdp",
    "recession",
    "inflation",
    "fed",
    "interest rate",
    "stock",
    "market",
    "company",
    "earnings",
  ],
  science: [
    "ai",
    "artificial intelligence",
    "space",
    "spacex",
    "nasa",
    "climate",
    "research",
  ],
  legal: ["court", "lawsuit", "trial", "verdict", "judge", "legal"],
  racing: ["f1", "formula 1", "nascar", "race", "grand prix"],
};

export const AVAILABLE_SERIES = [
  "nba",
  "nfl",
  "mlb",
  "nhl",
  "soccer",
  "f1",
  "ufc",
  "boxing",
  "tennis",
  "golf",
];

export function getCategoryKeywords(
  categories: CategoriesData,
  categoryKey: string
): { tags: string[]; apiCategory: string } | null {
  const category = categories.categories[categoryKey.toLowerCase()];
  if (category) {
    return { tags: category.tags, apiCategory: category.apiCategory };
  }
  return null;
}

export function matchesCategory(
  categories: CategoriesData,
  event: Event,
  categoryKey: string
): boolean {
  const categoryConfig = getCategoryKeywords(categories, categoryKey);
  if (!categoryConfig) return false;

  if (
    event.category?.toLowerCase() === categoryConfig.apiCategory.toLowerCase()
  ) {
    return true;
  }

  if (event.tags && Array.isArray(event.tags)) {
    for (const tag of event.tags) {
      const tagSlug = typeof tag === "string" ? tag : tag.slug;
      if (categoryConfig.tags.includes(tagSlug)) {
        return true;
      }
    }
  }

  const titleLower = event.title?.toLowerCase() || "";
  const descLower = event.description?.toLowerCase() || "";
  const keywords = CATEGORY_KEYWORDS[categoryKey.toLowerCase()] || [];

  for (const keyword of keywords) {
    if (titleLower.includes(keyword) || descLower.includes(keyword)) {
      return true;
    }
  }

  return false;
}

export function scoreEventForSearch(
  event: Event,
  queryLower: string,
  querySlug: string,
  queryWords: string[]
): number {
  let score = 0;
  const titleLower = event.title?.toLowerCase() || "";
  const descLower = event.description?.toLowerCase() || "";
  const slugLower = event.slug?.toLowerCase() || "";

  if (titleLower.includes(queryLower)) {
    score += 100;
  }

  if (descLower.includes(queryLower)) {
    score += 50;
  }

  if (slugLower.includes(querySlug)) {
    score += 75;
  }

  for (const word of queryWords) {
    if (titleLower.includes(word)) score += 20;
    if (descLower.includes(word)) score += 10;
    if (slugLower.includes(word)) score += 15;
  }

  if (event.tags && Array.isArray(event.tags)) {
    for (const tag of event.tags) {
      const tagStr =
        typeof tag === "string" ? tag : tag.label || tag.slug || "";
      if (tagStr.toLowerCase().includes(queryLower)) {
        score += 30;
      }
      for (const word of queryWords) {
        if (tagStr.toLowerCase().includes(word)) score += 10;
      }
    }
  }

  if (event.markets && Array.isArray(event.markets)) {
    for (const market of event.markets) {
      const questionLower = market.question?.toLowerCase() || "";
      if (questionLower.includes(queryLower)) {
        score += 40;
      }
      for (const word of queryWords) {
        if (questionLower.includes(word)) score += 5;
      }
    }
  }

  return score;
}

