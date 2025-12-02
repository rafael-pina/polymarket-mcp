import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// API endpoints
const GAMMA_API_BASE = "https://gamma-api.polymarket.com";
const CLOB_API_BASE = "https://clob.polymarket.com";

// Load categories data
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const categoriesPath = join(__dirname, "categories.json");
const categoriesData = JSON.parse(readFileSync(categoriesPath, "utf-8"));

// =============================================================================
// Types
// =============================================================================

interface CategoryConfig {
  label: string;
  description: string;
  tags: string[];
  apiCategory: string;
}

interface CategoriesData {
  categories: Record<string, CategoryConfig>;
  allTags: Array<{ id: string; label: string; slug: string }>;
}

const CATEGORIES: CategoriesData = categoriesData;

interface Market {
  id: string;
  question: string;
  description: string;
  outcomes: string;
  outcomePrices: string;
  volume: string;
  volume24hr: string;
  volume1wk: string;
  volume1mo: string;
  liquidity: string;
  active: boolean;
  closed: boolean;
  endDate: string;
  createdAt: string;
  slug: string;
  clobTokenIds: string;
  oneDayPriceChange: string;
  oneWeekPriceChange: string;
  oneMonthPriceChange: string;
  bestBid: string;
  bestAsk: string;
  spread: string;
  category?: string;
}

interface EventTag {
  id: string;
  label: string;
  slug: string;
}

interface Event {
  id: string;
  title: string;
  description: string;
  slug: string;
  category: string;
  volume: string;
  volume24hr: string;
  liquidity: string;
  openInterest: string;
  startDate: string;
  endDate: string;
  closed: boolean;
  markets: Market[];
  tags: EventTag[];
}

interface PricePoint {
  t: number; // Unix timestamp
  p: number; // Price (0-1)
}

interface PriceHistory {
  history: PricePoint[];
}

interface OrderBookLevel {
  price: string;
  size: string;
}

interface OrderBook {
  market: string;
  asset_id: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  hash: string;
  timestamp: string;
  min_order_size: string;
  tick_size: string;
}

// =============================================================================
// API Functions
// =============================================================================

async function fetchMarkets(params: {
  limit?: number;
  active?: boolean;
  closed?: boolean;
  offset?: number;
}): Promise<Market[]> {
  const searchParams = new URLSearchParams();

  if (params.limit) {
    searchParams.set("limit", params.limit.toString());
  }
  if (params.active !== undefined) {
    searchParams.set("active", params.active.toString());
  }
  if (params.closed !== undefined) {
    searchParams.set("closed", params.closed.toString());
  }
  if (params.offset !== undefined) {
    searchParams.set("offset", params.offset.toString());
  }

  const url = `${GAMMA_API_BASE}/markets?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch markets: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    return data as Market[];
  }

  throw new Error("Unexpected API response format");
}

async function searchMarkets(params: {
  query: string;
  limit?: number;
  active?: boolean;
  closed?: boolean;
}): Promise<Market[]> {
  // Fetch a larger set and filter client-side since Gamma API doesn't have great search
  const searchParams = new URLSearchParams();
  searchParams.set("limit", "100");

  if (params.active !== undefined) {
    searchParams.set("active", params.active.toString());
  }
  if (params.closed !== undefined) {
    searchParams.set("closed", params.closed.toString());
  }

  const url = `${GAMMA_API_BASE}/markets?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to search markets: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected API response format");
  }

  const markets = data as Market[];
  const queryLower = params.query.toLowerCase();

  // Filter by query matching question or description
  const filtered = markets.filter(m =>
    m.question?.toLowerCase().includes(queryLower) ||
    m.description?.toLowerCase().includes(queryLower)
  );

  return filtered.slice(0, params.limit || 10);
}

async function fetchEvents(params: {
  limit?: number;
  active?: boolean;
  closed?: boolean;
  offset?: number;
}): Promise<Event[]> {
  const searchParams = new URLSearchParams();

  if (params.limit) {
    searchParams.set("limit", params.limit.toString());
  }
  if (params.active !== undefined) {
    searchParams.set("active", params.active.toString());
  }
  if (params.closed !== undefined) {
    searchParams.set("closed", params.closed.toString());
  }
  if (params.offset !== undefined) {
    searchParams.set("offset", params.offset.toString());
  }

  const url = `${GAMMA_API_BASE}/events?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    return data as Event[];
  }

  throw new Error("Unexpected API response format");
}

async function fetchEventBySlug(slug: string): Promise<Event | null> {
  const url = `${GAMMA_API_BASE}/events?slug=${encodeURIComponent(slug)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch event: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (Array.isArray(data) && data.length > 0) {
    return data[0] as Event;
  }

  return null;
}

function getCategoryKeywords(categoryKey: string): { tags: string[]; apiCategory: string } | null {
  const category = CATEGORIES.categories[categoryKey.toLowerCase()];
  if (category) {
    return { tags: category.tags, apiCategory: category.apiCategory };
  }
  return null;
}

function matchesCategory(event: Event, categoryKey: string): boolean {
  const categoryConfig = getCategoryKeywords(categoryKey);
  if (!categoryConfig) return false;

  // Check if event category matches
  if (event.category?.toLowerCase() === categoryConfig.apiCategory.toLowerCase()) {
    return true;
  }

  // Check if any event tags match our category tags
  if (event.tags && Array.isArray(event.tags)) {
    for (const tag of event.tags) {
      const tagSlug = typeof tag === "string" ? tag : tag.slug;
      if (categoryConfig.tags.includes(tagSlug)) {
        return true;
      }
    }
  }

  // Check title/description for category-related keywords
  const titleLower = event.title?.toLowerCase() || "";
  const descLower = event.description?.toLowerCase() || "";

  // Add some common keyword matching for better results
  const categoryKeywords: Record<string, string[]> = {
    politics: ["election", "president", "congress", "senate", "vote", "democrat", "republican", "trump", "biden", "harris", "governor", "political"],
    crypto: ["bitcoin", "btc", "ethereum", "eth", "crypto", "token", "blockchain", "defi", "nft", "solana", "usdt", "tether"],
    sports: ["nba", "nfl", "mlb", "nhl", "soccer", "football", "basketball", "baseball", "hockey", "championship", "super bowl", "playoffs", "game"],
    world: ["ukraine", "russia", "china", "israel", "iran", "war", "nato", "ceasefire", "military", "nuclear"],
    entertainment: ["movie", "film", "music", "album", "concert", "celebrity", "tv", "show", "oscar", "grammy"],
    economy: ["gdp", "recession", "inflation", "fed", "interest rate", "stock", "market", "company", "earnings"],
    science: ["ai", "artificial intelligence", "space", "spacex", "nasa", "climate", "research"],
    legal: ["court", "lawsuit", "trial", "verdict", "judge", "legal"],
    racing: ["f1", "formula 1", "nascar", "race", "grand prix"],
  };

  const keywords = categoryKeywords[categoryKey.toLowerCase()] || [];
  for (const keyword of keywords) {
    if (titleLower.includes(keyword) || descLower.includes(keyword)) {
      return true;
    }
  }

  return false;
}

async function fetchEventsByCategory(params: {
  category: string;
  limit?: number;
  active?: boolean;
  closed?: boolean;
}): Promise<Event[]> {
  // Fetch a larger batch to filter
  const searchParams = new URLSearchParams();
  searchParams.set("limit", "200");

  if (params.active !== undefined) {
    searchParams.set("active", params.active.toString());
  }
  if (params.closed !== undefined) {
    searchParams.set("closed", params.closed.toString());
  }

  const url = `${GAMMA_API_BASE}/events?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected API response format");
  }

  const events = data as Event[];

  // Filter by category
  const filtered = events.filter(event => matchesCategory(event, params.category));

  return filtered.slice(0, params.limit || 10);
}

async function fetchTrendingMarkets(params: {
  limit?: number;
  sortBy: "volume24hr" | "volume1wk" | "oneDayPriceChange" | "oneWeekPriceChange";
}): Promise<Market[]> {
  // Fetch active, non-closed markets
  const searchParams = new URLSearchParams();
  searchParams.set("limit", "100");
  searchParams.set("active", "true");
  searchParams.set("closed", "false");

  const url = `${GAMMA_API_BASE}/markets?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch markets: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected API response format");
  }

  const markets = data as Market[];

  // Sort by the specified field
  const sorted = markets.sort((a, b) => {
    const aVal = Math.abs(parseFloat(a[params.sortBy] || "0"));
    const bVal = Math.abs(parseFloat(b[params.sortBy] || "0"));
    return bVal - aVal;
  });

  return sorted.slice(0, params.limit || 10);
}

async function fetchPriceHistory(params: {
  tokenId: string;
  interval?: "1d" | "1w" | "1m" | "3m" | "1y" | "max";
  fidelity?: number;
}): Promise<PriceHistory> {
  const searchParams = new URLSearchParams();
  searchParams.set("market", params.tokenId);
  searchParams.set("interval", params.interval || "max");
  searchParams.set("fidelity", (params.fidelity || 60).toString());

  const url = `${CLOB_API_BASE}/prices-history?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch price history: ${response.status} ${response.statusText}`);
  }

  return await response.json() as PriceHistory;
}

async function fetchOrderBook(tokenId: string): Promise<OrderBook> {
  const url = `${CLOB_API_BASE}/book?token_id=${tokenId}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch order book: ${response.status} ${response.statusText}`);
  }

  return await response.json() as OrderBook;
}

async function fetchMarketById(marketId: string): Promise<Market | null> {
  const url = `${GAMMA_API_BASE}/markets/${marketId}`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch market: ${response.status} ${response.statusText}`);
  }

  return await response.json() as Market;
}

// =============================================================================
// Formatters
// =============================================================================

function formatMarket(market: Market, includeDetails = true): string {
  let outcomes: string[] = [];
  let prices: string[] = [];

  try {
    outcomes = JSON.parse(market.outcomes || "[]");
    prices = JSON.parse(market.outcomePrices || "[]");
  } catch {
    // Keep empty arrays if parsing fails
  }

  const outcomesWithPrices = outcomes
    .map((outcome, i) => {
      const price = prices[i] ? (parseFloat(prices[i]) * 100).toFixed(1) + "%" : "N/A";
      return `  - ${outcome}: ${price}`;
    })
    .join("\n");

  let result = `
## ${market.question}

**ID:** ${market.id}
**Status:** ${market.closed ? "Closed" : market.active ? "Active" : "Inactive"}
**Volume:** $${parseFloat(market.volume || "0").toLocaleString()}
**Liquidity:** $${parseFloat(market.liquidity || "0").toLocaleString()}
**End Date:** ${market.endDate ? new Date(market.endDate).toLocaleDateString() : "N/A"}

**Outcomes:**
${outcomesWithPrices}`;

  if (includeDetails) {
    const vol24h = parseFloat(market.volume24hr || "0");
    const priceChange = parseFloat(market.oneDayPriceChange || "0") * 100;

    result += `

**24h Volume:** $${vol24h.toLocaleString()}
**24h Price Change:** ${priceChange >= 0 ? "+" : ""}${priceChange.toFixed(1)}%`;

    if (market.description) {
      result += `

**Description:** ${market.description.slice(0, 200)}${market.description.length > 200 ? "..." : ""}`;
    }
  }

  return result.trim();
}

function formatEvent(event: Event): string {
  let result = `
# ${event.title}

**ID:** ${event.id}
**Slug:** ${event.slug}
**Category:** ${event.category || "N/A"}
**Status:** ${event.closed ? "Closed" : "Active"}
**Volume:** $${parseFloat(event.volume || "0").toLocaleString()}
**Liquidity:** $${parseFloat(event.liquidity || "0").toLocaleString()}
**Open Interest:** $${parseFloat(event.openInterest || "0").toLocaleString()}
**Markets:** ${event.markets?.length || 0}
`;

  if (event.tags?.length > 0) {
    result += `**Tags:** ${event.tags.join(", ")}\n`;
  }

  if (event.description) {
    result += `\n**Description:** ${event.description.slice(0, 300)}${event.description.length > 300 ? "..." : ""}\n`;
  }

  if (event.markets && event.markets.length > 0) {
    result += `\n## Markets in this Event\n`;

    for (const market of event.markets) {
      let outcomes: string[] = [];
      let prices: string[] = [];
      try {
        outcomes = JSON.parse(market.outcomes || "[]");
        prices = JSON.parse(market.outcomePrices || "[]");
      } catch {
        // Keep empty
      }

      const priceStr = outcomes.map((o, i) => {
        const p = prices[i] ? (parseFloat(prices[i]) * 100).toFixed(1) + "%" : "N/A";
        return `${o}: ${p}`;
      }).join(" | ");

      result += `\n### ${market.question}\n`;
      result += `- **ID:** ${market.id}\n`;
      result += `- **Prices:** ${priceStr}\n`;
      result += `- **Volume:** $${parseFloat(market.volume || "0").toLocaleString()}\n`;
    }
  }

  return result.trim();
}

function formatPriceHistory(history: PriceHistory, question: string): string {
  if (!history.history || history.history.length === 0) {
    return "No price history available for this market.";
  }

  const points = history.history;
  const latest = points[points.length - 1];
  const oldest = points[0];

  // Calculate stats
  const prices = points.map(p => p.p);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

  // Price change
  const priceChange = latest.p - oldest.p;
  const priceChangePercent = (priceChange / oldest.p) * 100;

  let result = `
# Price History: ${question}

**Current Price:** ${(latest.p * 100).toFixed(1)}%
**Period Start:** ${new Date(oldest.t * 1000).toLocaleDateString()}
**Period End:** ${new Date(latest.t * 1000).toLocaleDateString()}

## Statistics
- **Starting Price:** ${(oldest.p * 100).toFixed(1)}%
- **Ending Price:** ${(latest.p * 100).toFixed(1)}%
- **Change:** ${priceChange >= 0 ? "+" : ""}${(priceChange * 100).toFixed(1)} pts (${priceChangePercent >= 0 ? "+" : ""}${priceChangePercent.toFixed(1)}%)
- **High:** ${(maxPrice * 100).toFixed(1)}%
- **Low:** ${(minPrice * 100).toFixed(1)}%
- **Average:** ${(avgPrice * 100).toFixed(1)}%
- **Data Points:** ${points.length}

## Recent Price Points
`;

  // Show last 10 price points
  const recentPoints = points.slice(-10);
  for (const point of recentPoints) {
    const date = new Date(point.t * 1000).toLocaleString();
    result += `- ${date}: ${(point.p * 100).toFixed(1)}%\n`;
  }

  return result.trim();
}

function formatOrderBook(orderBook: OrderBook, question: string): string {
  const topBids = orderBook.bids.slice(0, 10);
  const topAsks = orderBook.asks.slice(0, 10);

  // Calculate spread
  const bestBid = parseFloat(topBids[0]?.price || "0");
  const bestAsk = parseFloat(topAsks[0]?.price || "0");
  const spread = bestAsk - bestBid;
  const midPrice = (bestBid + bestAsk) / 2;

  // Calculate total liquidity
  const totalBidLiquidity = topBids.reduce((sum, b) => sum + parseFloat(b.size), 0);
  const totalAskLiquidity = topAsks.reduce((sum, a) => sum + parseFloat(a.size), 0);

  let result = `
# Order Book: ${question}

**Best Bid:** ${(bestBid * 100).toFixed(2)}%
**Best Ask:** ${(bestAsk * 100).toFixed(2)}%
**Spread:** ${(spread * 100).toFixed(2)} pts
**Mid Price:** ${(midPrice * 100).toFixed(2)}%

## Top Bids (Buy Orders)
| Price | Size |
|-------|------|
`;

  for (const bid of topBids) {
    const price = (parseFloat(bid.price) * 100).toFixed(2);
    const size = parseFloat(bid.size).toLocaleString();
    result += `| ${price}% | $${size} |\n`;
  }

  result += `\n**Total Bid Liquidity (top 10):** $${totalBidLiquidity.toLocaleString()}\n`;

  result += `
## Top Asks (Sell Orders)
| Price | Size |
|-------|------|
`;

  for (const ask of topAsks) {
    const price = (parseFloat(ask.price) * 100).toFixed(2);
    const size = parseFloat(ask.size).toLocaleString();
    result += `| ${price}% | $${size} |\n`;
  }

  result += `\n**Total Ask Liquidity (top 10):** $${totalAskLiquidity.toLocaleString()}\n`;
  result += `\n**Tick Size:** ${orderBook.tick_size}\n`;
  result += `**Min Order Size:** ${orderBook.min_order_size}\n`;

  return result.trim();
}

// =============================================================================
// MCP Server
// =============================================================================

const server = new McpServer({
  name: "polymarket-mcp",
  version: "1.0.0",
});

// Tool: list_markets
server.tool(
  "list_markets",
  "List prediction markets from Polymarket. Returns market information including questions, outcomes, prices, volume, and liquidity.",
  {
    limit: z.number().min(1).max(100).optional().default(10).describe("Number of markets to return (1-100, default: 10)"),
    active: z.boolean().optional().describe("Filter by active status"),
    closed: z.boolean().optional().describe("Filter by closed status"),
    offset: z.number().min(0).optional().describe("Offset for pagination (default: 0)"),
  },
  async (params) => {
    try {
      const markets = await fetchMarkets({
        limit: params.limit,
        active: params.active,
        closed: params.closed,
        offset: params.offset,
      });

      if (markets.length === 0) {
        return {
          content: [{ type: "text", text: "No markets found matching the criteria." }],
        };
      }

      const formattedMarkets = markets.map(m => formatMarket(m)).join("\n\n---\n\n");

      let response = `# Polymarket Markets\n\nFound ${markets.length} markets.\n\n${formattedMarkets}`;

      if (markets.length === params.limit) {
        const nextOffset = (params.offset || 0) + markets.length;
        response += `\n\n---\n\n**Next offset:** ${nextOffset}\n(Use this offset value to fetch the next page of results)`;
      }

      return {
        content: [{ type: "text", text: response }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error fetching markets: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// Tool: search_markets
server.tool(
  "search_markets",
  "Search for prediction markets by keyword. Searches market questions and descriptions.",
  {
    query: z.string().min(1).describe("Search query to find markets"),
    limit: z.number().min(1).max(50).optional().default(10).describe("Number of results to return (1-50, default: 10)"),
    active: z.boolean().optional().describe("Filter by active status"),
    closed: z.boolean().optional().describe("Filter by closed status"),
  },
  async (params) => {
    try {
      const markets = await searchMarkets({
        query: params.query,
        limit: params.limit,
        active: params.active,
        closed: params.closed,
      });

      if (markets.length === 0) {
        return {
          content: [{ type: "text", text: `No markets found matching "${params.query}".` }],
        };
      }

      const formattedMarkets = markets.map(m => formatMarket(m)).join("\n\n---\n\n");

      const response = `# Search Results for "${params.query}"\n\nFound ${markets.length} markets.\n\n${formattedMarkets}`;

      return {
        content: [{ type: "text", text: response }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error searching markets: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// Tool: get_event
server.tool(
  "get_event",
  "Get a Polymarket event with all its sub-markets. Events group related markets together (e.g., 'Bitcoin price targets' with markets for $100k, $150k, $200k, etc.).",
  {
    slug: z.string().optional().describe("Event slug (e.g., 'presidential-election-winner-2024')"),
    event_id: z.string().optional().describe("Event ID"),
    list_events: z.boolean().optional().describe("If true, list available events instead of fetching a specific one"),
    limit: z.number().min(1).max(50).optional().default(10).describe("Number of events to list (when list_events=true)"),
  },
  async (params) => {
    try {
      // List events mode
      if (params.list_events) {
        const events = await fetchEvents({
          limit: params.limit,
          closed: false,
        });

        if (events.length === 0) {
          return {
            content: [{ type: "text", text: "No events found." }],
          };
        }

        let response = "# Polymarket Events\n\n";
        response += "| Title | Markets | Volume | Slug |\n";
        response += "|-------|---------|--------|------|\n";

        for (const event of events) {
          const vol = parseFloat(event.volume || "0").toLocaleString();
          const marketCount = event.markets?.length || 0;
          response += `| ${event.title.slice(0, 50)}${event.title.length > 50 ? "..." : ""} | ${marketCount} | $${vol} | \`${event.slug}\` |\n`;
        }

        response += "\n\nUse `get_event` with a specific slug to see all markets in an event.";

        return {
          content: [{ type: "text", text: response }],
        };
      }

      // Fetch specific event
      if (!params.slug && !params.event_id) {
        return {
          content: [{ type: "text", text: "Please provide either a slug or event_id, or set list_events=true to see available events." }],
          isError: true,
        };
      }

      let event: Event | null = null;

      if (params.slug) {
        event = await fetchEventBySlug(params.slug);
      }

      if (!event) {
        return {
          content: [{ type: "text", text: `Event not found. Use list_events=true to see available events.` }],
        };
      }

      return {
        content: [{ type: "text", text: formatEvent(event) }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error fetching event: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// Tool: get_events_by_category
server.tool(
  "get_events_by_category",
  "Get prediction market events filtered by category. Categories: politics, crypto, sports, world, entertainment, economy, science, legal, racing. Use this when asking about specific topics like 'show me politics markets' or 'what crypto markets are there'.",
  {
    category: z.enum(["politics", "crypto", "sports", "world", "entertainment", "economy", "science", "legal", "racing"]).describe("Category to filter by: politics, crypto, sports, world, entertainment, economy, science, legal, racing"),
    limit: z.number().min(1).max(50).optional().default(10).describe("Number of events to return (1-50, default: 10)"),
    active: z.boolean().optional().default(true).describe("Filter by active status (default: true)"),
    closed: z.boolean().optional().default(false).describe("Filter by closed status (default: false)"),
  },
  async (params) => {
    try {
      const categoryConfig = CATEGORIES.categories[params.category];

      if (!categoryConfig) {
        const availableCategories = Object.keys(CATEGORIES.categories).join(", ");
        return {
          content: [{ type: "text", text: `Unknown category: ${params.category}. Available categories: ${availableCategories}` }],
          isError: true,
        };
      }

      const events = await fetchEventsByCategory({
        category: params.category,
        limit: params.limit,
        active: params.active,
        closed: params.closed,
      });

      if (events.length === 0) {
        return {
          content: [{ type: "text", text: `No events found in the "${categoryConfig.label}" category.` }],
        };
      }

      let response = `# ${categoryConfig.label} Events\n\n`;
      response += `*${categoryConfig.description}*\n\n`;
      response += `Found ${events.length} events.\n\n`;

      for (const event of events) {
        const vol = parseFloat(event.volume || "0").toLocaleString();
        const marketCount = event.markets?.length || 0;

        response += `## ${event.title}\n\n`;
        response += `- **Volume:** $${vol}\n`;
        response += `- **Markets:** ${marketCount}\n`;
        response += `- **Category:** ${event.category || "N/A"}\n`;
        response += `- **Slug:** \`${event.slug}\`\n`;

        if (event.description) {
          response += `- **Description:** ${event.description.slice(0, 150)}${event.description.length > 150 ? "..." : ""}\n`;
        }

        // Show top markets with prices
        if (event.markets && event.markets.length > 0) {
          response += `\n**Top Markets:**\n`;
          const topMarkets = event.markets.slice(0, 3);
          for (const market of topMarkets) {
            let outcomes: string[] = [];
            let prices: string[] = [];
            try {
              outcomes = JSON.parse(market.outcomes || "[]");
              prices = JSON.parse(market.outcomePrices || "[]");
            } catch {
              // Keep empty
            }
            const priceStr = outcomes.map((o, i) => {
              const p = prices[i] ? (parseFloat(prices[i]) * 100).toFixed(0) + "%" : "N/A";
              return `${o}: ${p}`;
            }).join(" | ");
            response += `  - ${market.question.slice(0, 60)}${market.question.length > 60 ? "..." : ""} (${priceStr})\n`;
          }
          if (event.markets.length > 3) {
            response += `  - *...and ${event.markets.length - 3} more markets*\n`;
          }
        }

        response += `\n---\n\n`;
      }

      response += `\nUse \`get_event\` with a slug to see full details of any event.`;

      return {
        content: [{ type: "text", text: response }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error fetching events by category: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// Tool: list_categories
server.tool(
  "list_categories",
  "List all available categories for filtering prediction markets.",
  {},
  async () => {
    let response = "# Available Categories\n\n";
    response += "Use `get_events_by_category` with any of these categories:\n\n";
    response += "| Category | Description | Example Tags |\n";
    response += "|----------|-------------|-------------|\n";

    for (const [key, config] of Object.entries(CATEGORIES.categories)) {
      const exampleTags = config.tags.slice(0, 3).join(", ");
      response += `| **${key}** | ${config.description} | ${exampleTags} |\n`;
    }

    response += "\n## Usage Examples\n\n";
    response += "- `get_events_by_category(category='politics')` - Political events and elections\n";
    response += "- `get_events_by_category(category='crypto')` - Cryptocurrency markets\n";
    response += "- `get_events_by_category(category='sports')` - Sports betting markets\n";

    return {
      content: [{ type: "text", text: response }],
    };
  }
);

// Tool: get_trending_markets
server.tool(
  "get_trending_markets",
  "Get trending/top markets sorted by volume or price change. Great for discovering hot markets.",
  {
    sort_by: z.enum(["volume24hr", "volume1wk", "oneDayPriceChange", "oneWeekPriceChange"]).optional().default("volume24hr").describe("Sort by: volume24hr, volume1wk, oneDayPriceChange, or oneWeekPriceChange"),
    limit: z.number().min(1).max(50).optional().default(10).describe("Number of markets to return (1-50, default: 10)"),
  },
  async (params) => {
    try {
      const markets = await fetchTrendingMarkets({
        sortBy: params.sort_by,
        limit: params.limit,
      });

      if (markets.length === 0) {
        return {
          content: [{ type: "text", text: "No trending markets found." }],
        };
      }

      const sortLabels: Record<string, string> = {
        volume24hr: "24h Volume",
        volume1wk: "Weekly Volume",
        oneDayPriceChange: "24h Price Change",
        oneWeekPriceChange: "Weekly Price Change",
      };

      let response = `# Trending Markets (by ${sortLabels[params.sort_by]})\n\n`;

      for (let i = 0; i < markets.length; i++) {
        const market = markets[i];
        const sortValue = String(market[params.sort_by as keyof Market] || "0");

        let valueStr: string;
        if (params.sort_by.includes("PriceChange")) {
          const change = parseFloat(sortValue) * 100;
          valueStr = `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
        } else {
          valueStr = `$${parseFloat(sortValue).toLocaleString()}`;
        }

        response += `### ${i + 1}. ${market.question}\n`;
        response += `- **${sortLabels[params.sort_by]}:** ${valueStr}\n`;
        response += `- **Total Volume:** $${parseFloat(market.volume || "0").toLocaleString()}\n`;

        let outcomes: string[] = [];
        let prices: string[] = [];
        try {
          outcomes = JSON.parse(market.outcomes || "[]");
          prices = JSON.parse(market.outcomePrices || "[]");
        } catch {
          // Keep empty
        }

        const priceStr = outcomes.map((o, i) => {
          const p = prices[i] ? (parseFloat(prices[i]) * 100).toFixed(1) + "%" : "N/A";
          return `${o}: ${p}`;
        }).join(" | ");

        response += `- **Prices:** ${priceStr}\n`;
        response += `- **ID:** ${market.id}\n\n`;
      }

      return {
        content: [{ type: "text", text: response }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error fetching trending markets: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// Tool: get_price_history
server.tool(
  "get_price_history",
  "Get historical price data for a market. Shows how odds have changed over time.",
  {
    market_id: z.string().describe("The market ID to get price history for"),
    outcome_index: z.number().min(0).optional().default(0).describe("Which outcome to get history for (0 = first outcome, usually 'Yes')"),
    interval: z.enum(["1d", "1w", "1m", "3m", "1y", "max"]).optional().default("1m").describe("Time interval: 1d, 1w, 1m, 3m, 1y, or max"),
  },
  async (params) => {
    try {
      // First fetch the market to get token IDs
      const market = await fetchMarketById(params.market_id);

      if (!market) {
        return {
          content: [{ type: "text", text: `Market with ID ${params.market_id} not found.` }],
          isError: true,
        };
      }

      let tokenIds: string[] = [];
      try {
        tokenIds = JSON.parse(market.clobTokenIds || "[]");
      } catch {
        return {
          content: [{ type: "text", text: "Could not parse token IDs for this market." }],
          isError: true,
        };
      }

      if (tokenIds.length === 0) {
        return {
          content: [{ type: "text", text: "No CLOB tokens available for this market." }],
          isError: true,
        };
      }

      const tokenId = tokenIds[params.outcome_index] || tokenIds[0];
      const history = await fetchPriceHistory({
        tokenId,
        interval: params.interval,
      });

      let outcomes: string[] = [];
      try {
        outcomes = JSON.parse(market.outcomes || "[]");
      } catch {
        // Keep empty
      }

      const outcomeName = outcomes[params.outcome_index] || `Outcome ${params.outcome_index}`;
      const question = `${market.question} (${outcomeName})`;

      return {
        content: [{ type: "text", text: formatPriceHistory(history, question) }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error fetching price history: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// Tool: get_order_book
server.tool(
  "get_order_book",
  "Get the order book (market depth) for a market. Shows current bids and asks.",
  {
    market_id: z.string().describe("The market ID to get order book for"),
    outcome_index: z.number().min(0).optional().default(0).describe("Which outcome to get order book for (0 = first outcome, usually 'Yes')"),
  },
  async (params) => {
    try {
      // First fetch the market to get token IDs
      const market = await fetchMarketById(params.market_id);

      if (!market) {
        return {
          content: [{ type: "text", text: `Market with ID ${params.market_id} not found.` }],
          isError: true,
        };
      }

      let tokenIds: string[] = [];
      try {
        tokenIds = JSON.parse(market.clobTokenIds || "[]");
      } catch {
        return {
          content: [{ type: "text", text: "Could not parse token IDs for this market." }],
          isError: true,
        };
      }

      if (tokenIds.length === 0) {
        return {
          content: [{ type: "text", text: "No CLOB tokens available for this market." }],
          isError: true,
        };
      }

      const tokenId = tokenIds[params.outcome_index] || tokenIds[0];
      const orderBook = await fetchOrderBook(tokenId);

      let outcomes: string[] = [];
      try {
        outcomes = JSON.parse(market.outcomes || "[]");
      } catch {
        // Keep empty
      }

      const outcomeName = outcomes[params.outcome_index] || `Outcome ${params.outcome_index}`;
      const question = `${market.question} (${outcomeName})`;

      return {
        content: [{ type: "text", text: formatOrderBook(orderBook, question) }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error fetching order book: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// Tool: get_market
server.tool(
  "get_market",
  "Get detailed information about a specific market by ID.",
  {
    market_id: z.string().describe("The market ID to fetch"),
  },
  async (params) => {
    try {
      const market = await fetchMarketById(params.market_id);

      if (!market) {
        return {
          content: [{ type: "text", text: `Market with ID ${params.market_id} not found.` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: formatMarket(market, true) }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error fetching market: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// =============================================================================
// Start Server
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Polymarket MCP server started");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
