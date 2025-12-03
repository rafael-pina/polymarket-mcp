import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import type { CategoriesData, Event, Market } from "./types.js";
import { AVAILABLE_SERIES } from "./utils.js";
import {
  formatMarket,
  formatEvent,
  formatPriceHistory,
  formatOrderBook,
} from "./formatters.js";
import {
  fetchMarkets,
  searchMarkets,
  searchEvents,
  fetchEvents,
  fetchEventBySlug,
  fetchEventsByCategory,
  fetchTrendingMarkets,
  fetchPriceHistory,
  fetchOrderBook,
  fetchMarketById,
  fetchEventsBySeries,
  fetchClosingSoon,
  fetchMostEngaged,
  fetchHighLiquidityMarkets,
  fetchRecentlyResolved,
  fetchEventsByTag,
  fetchCompetitiveMarkets,
} from "./api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const categoriesPath = join(__dirname, "categories.json");
const categoriesData = JSON.parse(readFileSync(categoriesPath, "utf-8"));
const CATEGORIES: CategoriesData = categoriesData;

const server = new McpServer({
  name: "polymarket-mcp",
  version: "1.0.0",
});

server.registerTool(
  "list_markets",
  {
    description:
      "List prediction markets from Polymarket. Returns market information including questions, outcomes, prices, volume, and liquidity.",
    inputSchema: {
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .default(10)
        .describe("Number of markets to return (1-100, default: 10)"),
      active: z.boolean().optional().describe("Filter by active status"),
      closed: z.boolean().optional().describe("Filter by closed status"),
      offset: z
        .number()
        .min(0)
        .optional()
        .describe("Offset for pagination (default: 0)"),
    },
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
          content: [
            { type: "text", text: "No markets found matching the criteria." },
          ],
        };
      }

      const formattedMarkets = markets
        .map((m) => formatMarket(m))
        .join("\n\n---\n\n");
      let response = `# Polymarket Markets\n\nFound ${markets.length} markets.\n\n${formattedMarkets}`;

      if (markets.length === params.limit) {
        const nextOffset = (params.offset || 0) + markets.length;
        response += `\n\n---\n\n**Next offset:** ${nextOffset}\n(Use this offset value to fetch the next page of results)`;
      }

      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          { type: "text", text: `Error fetching markets: ${errorMessage}` },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "search_markets",
  {
    description:
      "Search for prediction markets by keyword. Searches market questions, descriptions, and events. This searches through events for comprehensive coverage.",
    inputSchema: {
      query: z.string().min(1).describe("Search query to find markets"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Number of results to return (1-50, default: 10)"),
      active: z.boolean().optional().describe("Filter by active status"),
      closed: z.boolean().optional().describe("Filter by closed status"),
    },
  },
  async (params) => {
    try {
      const markets = await searchMarkets({
        query: params.query,
        limit: params.limit,
        active: params.active,
        closed: params.closed,
      });

      if (markets.length > 0) {
        const formattedMarkets = markets
          .map((m) => formatMarket(m))
          .join("\n\n---\n\n");
        return {
          content: [
            {
              type: "text",
              text: `# Search Results for "${params.query}"\n\nFound ${markets.length} markets.\n\n${formattedMarkets}`,
            },
          ],
        };
      }

      const events = await searchEvents({
        query: params.query,
        limit: params.limit,
        active: params.active,
        closed: params.closed,
      });

      if (events.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No markets or events found matching "${params.query}".`,
            },
          ],
        };
      }

      let response = `# Search Results for "${params.query}"\n\nFound ${events.length} events matching your search.\n\n`;

      for (const event of events) {
        const vol = parseFloat(event.volume || "0").toLocaleString();
        const marketCount = event.markets?.length || 0;

        response += `## ${event.title}\n\n`;
        response += `- **Volume:** $${vol}\n`;
        response += `- **Markets:** ${marketCount}\n`;
        response += `- **Slug:** \`${event.slug}\`\n`;

        if (event.description) {
          response += `- **Description:** ${event.description.slice(0, 150)}${
            event.description.length > 150 ? "..." : ""
          }\n`;
        }

        if (event.markets && event.markets.length > 0) {
          response += `\n**Markets:**\n`;
          const topMarkets = event.markets.slice(0, 5);
          for (const market of topMarkets) {
            let outcomes: string[] = [];
            let prices: string[] = [];
            try {
              outcomes = JSON.parse(market.outcomes || "[]");
              prices = JSON.parse(market.outcomePrices || "[]");
            } catch {
              /* empty */
            }
            const priceStr = outcomes
              .map((o, i) => {
                const p = prices[i]
                  ? (parseFloat(prices[i]) * 100).toFixed(1) + "%"
                  : "N/A";
                return `${o}: ${p}`;
              })
              .join(" | ");
            response += `  - ${market.question} (${priceStr})\n`;
            response += `    ID: ${market.id}\n`;
          }
          if (event.markets.length > 5) {
            response += `  - *...and ${
              event.markets.length - 5
            } more markets*\n`;
          }
        }
        response += `\n---\n\n`;
      }

      response += `\nUse \`get_event\` with a slug for full event details.`;
      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          { type: "text", text: `Error searching markets: ${errorMessage}` },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "search_events",
  {
    description:
      "Search for prediction market events by keyword. Events group related markets together. This is useful for finding markets on specific topics.",
    inputSchema: {
      query: z
        .string()
        .min(1)
        .describe(
          "Search query to find events (e.g., 'Venezuela', 'Trump', 'Bitcoin')"
        ),
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Number of results to return (1-50, default: 10)"),
      active: z.boolean().optional().describe("Filter by active status"),
      closed: z.boolean().optional().describe("Filter by closed status"),
    },
  },
  async (params) => {
    try {
      const events = await searchEvents({
        query: params.query,
        limit: params.limit,
        active: params.active,
        closed: params.closed,
      });

      if (events.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No events found matching "${params.query}".`,
            },
          ],
        };
      }

      let response = `# Event Search Results for "${params.query}"\n\nFound ${events.length} events.\n\n`;

      for (const event of events) {
        const vol = parseFloat(event.volume || "0").toLocaleString();
        const marketCount = event.markets?.length || 0;

        response += `## ${event.title}\n\n`;
        response += `- **Volume:** $${vol}\n`;
        response += `- **Liquidity:** $${parseFloat(
          event.liquidity || "0"
        ).toLocaleString()}\n`;
        response += `- **Markets:** ${marketCount}\n`;
        response += `- **Slug:** \`${event.slug}\`\n`;

        if (event.tags && event.tags.length > 0) {
          const tagLabels = event.tags
            .map((t) => (typeof t === "string" ? t : t.label))
            .join(", ");
          response += `- **Tags:** ${tagLabels}\n`;
        }

        if (event.description) {
          response += `\n**Description:** ${event.description.slice(0, 200)}${
            event.description.length > 200 ? "..." : ""
          }\n`;
        }

        if (event.markets && event.markets.length > 0) {
          response += `\n**Markets:**\n`;
          const topMarkets = event.markets.slice(0, 5);
          for (const market of topMarkets) {
            let outcomes: string[] = [];
            let prices: string[] = [];
            try {
              outcomes = JSON.parse(market.outcomes || "[]");
              prices = JSON.parse(market.outcomePrices || "[]");
            } catch {
              /* empty */
            }
            const priceStr = outcomes
              .map((o, i) => {
                const p = prices[i]
                  ? (parseFloat(prices[i]) * 100).toFixed(1) + "%"
                  : "N/A";
                return `${o}: ${p}`;
              })
              .join(" | ");
            response += `  - ${market.question}\n`;
            response += `    ${priceStr} | Volume: $${parseFloat(
              market.volume || "0"
            ).toLocaleString()}\n`;
          }
          if (event.markets.length > 5) {
            response += `  - *...and ${
              event.markets.length - 5
            } more markets*\n`;
          }
        }
        response += `\n---\n\n`;
      }

      response += `\nUse \`get_event\` with a slug for full event details.`;
      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          { type: "text", text: `Error searching events: ${errorMessage}` },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_event",
  {
    description:
      "Get a Polymarket event with all its sub-markets. Events group related markets together (e.g., 'Bitcoin price targets' with markets for $100k, $150k, $200k, etc.).",
    inputSchema: {
      slug: z
        .string()
        .optional()
        .describe("Event slug (e.g., 'presidential-election-winner-2024')"),
      event_id: z.string().optional().describe("Event ID"),
      list_events: z
        .boolean()
        .optional()
        .describe(
          "If true, list available events instead of fetching a specific one"
        ),
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Number of events to list (when list_events=true)"),
    },
  },
  async (params) => {
    try {
      if (params.list_events) {
        const events = await fetchEvents({
          limit: params.limit,
          closed: false,
        });

        if (events.length === 0) {
          return { content: [{ type: "text", text: "No events found." }] };
        }

        let response =
          "# Polymarket Events\n\n| Title | Markets | Volume | Slug |\n|-------|---------|--------|------|\n";

        for (const event of events) {
          const vol = parseFloat(event.volume || "0").toLocaleString();
          const marketCount = event.markets?.length || 0;
          response += `| ${event.title.slice(0, 50)}${
            event.title.length > 50 ? "..." : ""
          } | ${marketCount} | $${vol} | \`${event.slug}\` |\n`;
        }

        response +=
          "\n\nUse `get_event` with a specific slug to see all markets in an event.";
        return { content: [{ type: "text", text: response }] };
      }

      if (!params.slug && !params.event_id) {
        return {
          content: [
            {
              type: "text",
              text: "Please provide either a slug or event_id, or set list_events=true to see available events.",
            },
          ],
          isError: true,
        };
      }

      let event: Event | null = null;
      if (params.slug) {
        event = await fetchEventBySlug(params.slug);
      }

      if (!event) {
        return {
          content: [
            {
              type: "text",
              text: `Event not found. Use list_events=true to see available events.`,
            },
          ],
        };
      }

      return { content: [{ type: "text", text: formatEvent(event) }] };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          { type: "text", text: `Error fetching event: ${errorMessage}` },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_events_by_category",
  {
    description:
      "Get prediction market events filtered by category. Categories: politics, crypto, sports, world, entertainment, economy, science, legal, racing.",
    inputSchema: {
      category: z
        .enum([
          "politics",
          "crypto",
          "sports",
          "world",
          "entertainment",
          "economy",
          "science",
          "legal",
          "racing",
        ])
        .describe("Category to filter by"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Number of events to return (1-50, default: 10)"),
      active: z
        .boolean()
        .optional()
        .default(true)
        .describe("Filter by active status (default: true)"),
      closed: z
        .boolean()
        .optional()
        .default(false)
        .describe("Filter by closed status (default: false)"),
    },
  },
  async (params) => {
    try {
      const categoryConfig = CATEGORIES.categories[params.category];

      if (!categoryConfig) {
        const availableCategories = Object.keys(CATEGORIES.categories).join(
          ", "
        );
        return {
          content: [
            {
              type: "text",
              text: `Unknown category: ${params.category}. Available categories: ${availableCategories}`,
            },
          ],
          isError: true,
        };
      }

      const events = await fetchEventsByCategory(CATEGORIES, {
        category: params.category,
        limit: params.limit,
        active: params.active,
        closed: params.closed,
      });

      if (events.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No events found in the "${categoryConfig.label}" category.`,
            },
          ],
        };
      }

      let response = `# ${categoryConfig.label} Events\n\n*${categoryConfig.description}*\n\nFound ${events.length} events.\n\n`;

      for (const event of events) {
        const vol = parseFloat(event.volume || "0").toLocaleString();
        const marketCount = event.markets?.length || 0;

        response += `## ${event.title}\n\n`;
        response += `- **Volume:** $${vol}\n`;
        response += `- **Markets:** ${marketCount}\n`;
        response += `- **Category:** ${event.category || "N/A"}\n`;
        response += `- **Slug:** \`${event.slug}\`\n`;

        if (event.description) {
          response += `- **Description:** ${event.description.slice(0, 150)}${
            event.description.length > 150 ? "..." : ""
          }\n`;
        }

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
              /* empty */
            }
            const priceStr = outcomes
              .map((o, i) => {
                const p = prices[i]
                  ? (parseFloat(prices[i]) * 100).toFixed(0) + "%"
                  : "N/A";
                return `${o}: ${p}`;
              })
              .join(" | ");
            response += `  - ${market.question.slice(0, 60)}${
              market.question.length > 60 ? "..." : ""
            } (${priceStr})\n`;
          }
          if (event.markets.length > 3) {
            response += `  - *...and ${
              event.markets.length - 3
            } more markets*\n`;
          }
        }
        response += `\n---\n\n`;
      }

      response += `\nUse \`get_event\` with a slug to see full details of any event.`;
      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching events by category: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "list_categories",
  {
    description:
      "List all available categories for filtering prediction markets.",
  },
  async () => {
    let response =
      "# Available Categories\n\nUse `get_events_by_category` with any of these categories:\n\n";
    response +=
      "| Category | Description | Example Tags |\n|----------|-------------|-------------|\n";

    for (const [key, config] of Object.entries(CATEGORIES.categories)) {
      const exampleTags = config.tags.slice(0, 3).join(", ");
      response += `| **${key}** | ${config.description} | ${exampleTags} |\n`;
    }

    response += "\n## Usage Examples\n\n";
    response +=
      "- `get_events_by_category(category='politics')` - Political events and elections\n";
    response +=
      "- `get_events_by_category(category='crypto')` - Cryptocurrency markets\n";
    response +=
      "- `get_events_by_category(category='sports')` - Sports betting markets\n";

    return { content: [{ type: "text", text: response }] };
  }
);

server.registerTool(
  "get_trending_markets",
  {
    description:
      "Get trending/top markets sorted by volume or price change. Great for discovering hot markets.",
    inputSchema: {
      sort_by: z
        .enum([
          "volume24hr",
          "volume1wk",
          "oneDayPriceChange",
          "oneWeekPriceChange",
        ])
        .optional()
        .default("volume24hr")
        .describe(
          "Sort by: volume24hr, volume1wk, oneDayPriceChange, or oneWeekPriceChange"
        ),
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Number of markets to return (1-50, default: 10)"),
    },
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

      let response = `# Trending Markets (by ${
        sortLabels[params.sort_by]
      })\n\n`;

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
        response += `- **Total Volume:** $${parseFloat(
          market.volume || "0"
        ).toLocaleString()}\n`;

        let outcomes: string[] = [];
        let prices: string[] = [];
        try {
          outcomes = JSON.parse(market.outcomes || "[]");
          prices = JSON.parse(market.outcomePrices || "[]");
        } catch {
          /* empty */
        }

        const priceStr = outcomes
          .map((o, i) => {
            const p = prices[i]
              ? (parseFloat(prices[i]) * 100).toFixed(1) + "%"
              : "N/A";
            return `${o}: ${p}`;
          })
          .join(" | ");

        response += `- **Prices:** ${priceStr}\n`;
        response += `- **ID:** ${market.id}\n\n`;
      }

      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching trending markets: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_price_history",
  {
    description:
      "Get historical price data for a market. Shows how odds have changed over time.",
    inputSchema: {
      market_id: z.string().describe("The market ID to get price history for"),
      outcome_index: z
        .number()
        .min(0)
        .optional()
        .default(0)
        .describe(
          "Which outcome to get history for (0 = first outcome, usually 'Yes')"
        ),
      interval: z
        .enum(["1d", "1w", "1m", "3m", "1y", "max"])
        .optional()
        .default("1m")
        .describe("Time interval: 1d, 1w, 1m, 3m, 1y, or max"),
    },
  },
  async (params) => {
    try {
      const market = await fetchMarketById(params.market_id);

      if (!market) {
        return {
          content: [
            {
              type: "text",
              text: `Market with ID ${params.market_id} not found.`,
            },
          ],
          isError: true,
        };
      }

      let tokenIds: string[] = [];
      try {
        tokenIds = JSON.parse(market.clobTokenIds || "[]");
      } catch {
        return {
          content: [
            {
              type: "text",
              text: "Could not parse token IDs for this market.",
            },
          ],
          isError: true,
        };
      }

      if (tokenIds.length === 0) {
        return {
          content: [
            { type: "text", text: "No CLOB tokens available for this market." },
          ],
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
        /* empty */
      }

      const outcomeName =
        outcomes[params.outcome_index] || `Outcome ${params.outcome_index}`;
      const question = `${market.question} (${outcomeName})`;

      return {
        content: [
          { type: "text", text: formatPriceHistory(history, question) },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching price history: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_order_book",
  {
    description:
      "Get the order book (market depth) for a market. Shows current bids and asks.",
    inputSchema: {
      market_id: z.string().describe("The market ID to get order book for"),
      outcome_index: z
        .number()
        .min(0)
        .optional()
        .default(0)
        .describe(
          "Which outcome to get order book for (0 = first outcome, usually 'Yes')"
        ),
    },
  },
  async (params) => {
    try {
      const market = await fetchMarketById(params.market_id);

      if (!market) {
        return {
          content: [
            {
              type: "text",
              text: `Market with ID ${params.market_id} not found.`,
            },
          ],
          isError: true,
        };
      }

      let tokenIds: string[] = [];
      try {
        tokenIds = JSON.parse(market.clobTokenIds || "[]");
      } catch {
        return {
          content: [
            {
              type: "text",
              text: "Could not parse token IDs for this market.",
            },
          ],
          isError: true,
        };
      }

      if (tokenIds.length === 0) {
        return {
          content: [
            { type: "text", text: "No CLOB tokens available for this market." },
          ],
          isError: true,
        };
      }

      const tokenId = tokenIds[params.outcome_index] || tokenIds[0];
      const orderBook = await fetchOrderBook(tokenId);

      let outcomes: string[] = [];
      try {
        outcomes = JSON.parse(market.outcomes || "[]");
      } catch {
        /* empty */
      }

      const outcomeName =
        outcomes[params.outcome_index] || `Outcome ${params.outcome_index}`;
      const question = `${market.question} (${outcomeName})`;

      return {
        content: [{ type: "text", text: formatOrderBook(orderBook, question) }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          { type: "text", text: `Error fetching order book: ${errorMessage}` },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_market",
  {
    description: "Get detailed information about a specific market by ID.",
    inputSchema: {
      market_id: z.string().describe("The market ID to fetch"),
    },
  },
  async (params) => {
    try {
      const market = await fetchMarketById(params.market_id);

      if (!market) {
        return {
          content: [
            {
              type: "text",
              text: `Market with ID ${params.market_id} not found.`,
            },
          ],
          isError: true,
        };
      }

      return { content: [{ type: "text", text: formatMarket(market, true) }] };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          { type: "text", text: `Error fetching market: ${errorMessage}` },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_events_by_series",
  {
    description:
      "Get prediction market events for a specific sports series (e.g., NBA, NFL, MLB, NHL). Great for finding all games/matches for a league.",
    inputSchema: {
      series: z
        .string()
        .describe(
          "Series identifier (e.g., 'nba', 'nfl', 'mlb', 'nhl', 'soccer', 'f1', 'ufc')"
        ),
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Number of events to return (1-50, default: 10)"),
      active: z
        .boolean()
        .optional()
        .default(true)
        .describe("Filter by active status (default: true)"),
      closed: z
        .boolean()
        .optional()
        .default(false)
        .describe("Filter by closed status (default: false)"),
    },
  },
  async (params) => {
    try {
      const events = await fetchEventsBySeries({
        series: params.series,
        limit: params.limit,
        active: params.active,
        closed: params.closed,
      });

      if (events.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No events found for series "${
                params.series
              }".\n\nAvailable series: ${AVAILABLE_SERIES.join(", ")}`,
            },
          ],
        };
      }

      let response = `# ${params.series.toUpperCase()} Events\n\nFound ${
        events.length
      } events.\n\n`;

      for (const event of events) {
        const vol = parseFloat(event.volume || "0").toLocaleString();
        const marketCount = event.markets?.length || 0;

        response += `## ${event.title}\n\n`;
        response += `- **Volume:** $${vol}\n`;
        response += `- **Markets:** ${marketCount}\n`;
        response += `- **End Date:** ${
          event.endDate ? new Date(event.endDate).toLocaleDateString() : "N/A"
        }\n`;
        response += `- **Slug:** \`${event.slug}\`\n`;

        if (event.series && event.series.length > 0) {
          const seriesNames = event.series.map((s) => s.title).join(", ");
          response += `- **Series:** ${seriesNames}\n`;
        }

        if (event.markets && event.markets.length > 0) {
          response += `\n**Markets:**\n`;
          const topMarkets = event.markets.slice(0, 3);
          for (const market of topMarkets) {
            let outcomes: string[] = [];
            let prices: string[] = [];
            try {
              outcomes = JSON.parse(market.outcomes || "[]");
              prices = JSON.parse(market.outcomePrices || "[]");
            } catch {
              /* empty */
            }
            const priceStr = outcomes
              .map((o, i) => {
                const p = prices[i]
                  ? (parseFloat(prices[i]) * 100).toFixed(0) + "%"
                  : "N/A";
                return `${o}: ${p}`;
              })
              .join(" | ");
            response += `  - ${market.question.slice(0, 60)}${
              market.question.length > 60 ? "..." : ""
            } (${priceStr})\n`;
          }
          if (event.markets.length > 3) {
            response += `  - *...and ${
              event.markets.length - 3
            } more markets*\n`;
          }
        }
        response += `\n---\n\n`;
      }

      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching events by series: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_closing_soon",
  {
    description:
      "Get markets that are closing/resolving soon. Great for finding imminent trading opportunities.",
    inputSchema: {
      hours: z
        .number()
        .min(1)
        .max(168)
        .optional()
        .default(24)
        .describe("Hours until close (1-168, default: 24)"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Number of events to return (1-50, default: 10)"),
    },
  },
  async (params) => {
    try {
      const events = await fetchClosingSoon({
        hours: params.hours,
        limit: params.limit,
      });

      if (events.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No markets found closing within ${params.hours} hours.`,
            },
          ],
        };
      }

      let response = `# Markets Closing Soon (within ${params.hours} hours)\n\nFound ${events.length} events closing soon.\n\n`;
      const now = new Date();

      for (const event of events) {
        const endDate = new Date(event.endDate);
        const hoursLeft = Math.round(
          (endDate.getTime() - now.getTime()) / (1000 * 60 * 60)
        );
        const vol = parseFloat(event.volume || "0").toLocaleString();

        response += `## ${event.title}\n\n`;
        response += `- **⏰ Closes in:** ${hoursLeft} hours (${endDate.toLocaleString()})\n`;
        response += `- **Volume:** $${vol}\n`;
        response += `- **Liquidity:** $${parseFloat(
          event.liquidity || "0"
        ).toLocaleString()}\n`;
        response += `- **Slug:** \`${event.slug}\`\n`;

        if (event.markets && event.markets.length > 0) {
          response += `\n**Markets:**\n`;
          for (const market of event.markets.slice(0, 3)) {
            let outcomes: string[] = [];
            let prices: string[] = [];
            try {
              outcomes = JSON.parse(market.outcomes || "[]");
              prices = JSON.parse(market.outcomePrices || "[]");
            } catch {
              /* empty */
            }
            const priceStr = outcomes
              .map((o, i) => {
                const p = prices[i]
                  ? (parseFloat(prices[i]) * 100).toFixed(0) + "%"
                  : "N/A";
                return `${o}: ${p}`;
              })
              .join(" | ");
            response += `  - ${market.question.slice(
              0,
              50
            )}... (${priceStr})\n`;
          }
        }
        response += `\n---\n\n`;
      }

      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching closing soon: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_most_engaged",
  {
    description:
      "Get the most engaged markets sorted by comment count. High comment counts often indicate controversial or high-interest markets.",
    inputSchema: {
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Number of events to return (1-50, default: 10)"),
      active: z
        .boolean()
        .optional()
        .default(true)
        .describe("Filter by active status (default: true)"),
    },
  },
  async (params) => {
    try {
      const events = await fetchMostEngaged({
        limit: params.limit,
        active: params.active,
      });

      if (events.length === 0) {
        return {
          content: [{ type: "text", text: "No engaged markets found." }],
        };
      }

      let response = `# Most Engaged Markets (by Comment Count)\n\n`;

      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const comments = event.commentCount || 0;
        const vol = parseFloat(event.volume || "0").toLocaleString();

        response += `### ${i + 1}. ${event.title}\n\n`;
        response += `- **💬 Comments:** ${comments.toLocaleString()}\n`;
        response += `- **Volume:** $${vol}\n`;
        response += `- **Category:** ${event.category || "N/A"}\n`;
        response += `- **Slug:** \`${event.slug}\`\n`;

        if (event.markets && event.markets.length > 0) {
          const market = event.markets[0];
          let outcomes: string[] = [];
          let prices: string[] = [];
          try {
            outcomes = JSON.parse(market.outcomes || "[]");
            prices = JSON.parse(market.outcomePrices || "[]");
          } catch {
            /* empty */
          }
          const priceStr = outcomes
            .map((o, i) => {
              const p = prices[i]
                ? (parseFloat(prices[i]) * 100).toFixed(0) + "%"
                : "N/A";
              return `${o}: ${p}`;
            })
            .join(" | ");
          response += `- **Current Odds:** ${priceStr}\n`;
        }
        response += `\n`;
      }

      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching most engaged: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_high_liquidity_markets",
  {
    description:
      "Get markets with the highest liquidity. High liquidity means better execution and tighter spreads for traders.",
    inputSchema: {
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Number of markets to return (1-50, default: 10)"),
      min_liquidity: z
        .number()
        .min(0)
        .optional()
        .describe("Minimum liquidity threshold in USD"),
    },
  },
  async (params) => {
    try {
      const markets = await fetchHighLiquidityMarkets({
        limit: params.limit,
        minLiquidity: params.min_liquidity,
      });

      if (markets.length === 0) {
        return {
          content: [{ type: "text", text: "No high liquidity markets found." }],
        };
      }

      let response = `# High Liquidity Markets\n\n`;
      if (params.min_liquidity) {
        response += `*Minimum liquidity: $${params.min_liquidity.toLocaleString()}*\n\n`;
      }

      for (let i = 0; i < markets.length; i++) {
        const market = markets[i];
        const liquidity = parseFloat(market.liquidity || "0");
        const volume = parseFloat(market.volume || "0");

        response += `### ${i + 1}. ${market.question}\n\n`;
        response += `- **💧 Liquidity:** $${liquidity.toLocaleString()}\n`;
        response += `- **Volume:** $${volume.toLocaleString()}\n`;
        response += `- **Spread:** ${parseFloat(market.spread || "0").toFixed(
          2
        )}\n`;

        let outcomes: string[] = [];
        let prices: string[] = [];
        try {
          outcomes = JSON.parse(market.outcomes || "[]");
          prices = JSON.parse(market.outcomePrices || "[]");
        } catch {
          /* empty */
        }

        const priceStr = outcomes
          .map((o, i) => {
            const p = prices[i]
              ? (parseFloat(prices[i]) * 100).toFixed(1) + "%"
              : "N/A";
            return `${o}: ${p}`;
          })
          .join(" | ");

        response += `- **Prices:** ${priceStr}\n`;
        response += `- **ID:** ${market.id}\n\n`;
      }

      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching high liquidity markets: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_recently_resolved",
  {
    description:
      "Get markets that have recently resolved/closed. See historical results and how markets were settled.",
    inputSchema: {
      days: z
        .number()
        .min(1)
        .max(30)
        .optional()
        .default(7)
        .describe("Look back period in days (1-30, default: 7)"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Number of events to return (1-50, default: 10)"),
    },
  },
  async (params) => {
    try {
      const events = await fetchRecentlyResolved({
        days: params.days,
        limit: params.limit,
      });

      if (events.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No markets resolved in the last ${params.days} days.`,
            },
          ],
        };
      }

      let response = `# Recently Resolved Markets (last ${params.days} days)\n\nFound ${events.length} resolved events.\n\n`;

      for (const event of events) {
        const closedDate = event.closedTime
          ? new Date(event.closedTime)
          : new Date(event.endDate);
        const vol = parseFloat(event.volume || "0").toLocaleString();

        response += `## ${event.title}\n\n`;
        response += `- **✅ Resolved:** ${closedDate.toLocaleString()}\n`;
        response += `- **Final Volume:** $${vol}\n`;
        response += `- **Category:** ${event.category || "N/A"}\n`;

        if (event.markets && event.markets.length > 0) {
          response += `\n**Results:**\n`;
          for (const market of event.markets.slice(0, 5)) {
            let outcomes: string[] = [];
            let prices: string[] = [];
            try {
              outcomes = JSON.parse(market.outcomes || "[]");
              prices = JSON.parse(market.outcomePrices || "[]");
            } catch {
              /* empty */
            }

            const priceStr = outcomes
              .map((o, i) => {
                const p = parseFloat(prices[i] || "0");
                const pct = (p * 100).toFixed(0) + "%";
                const marker = p > 0.99 ? "✓ " : p < 0.01 ? "✗ " : "";
                return `${marker}${o}: ${pct}`;
              })
              .join(" | ");

            response += `  - ${market.question.slice(0, 50)}${
              market.question.length > 50 ? "..." : ""
            }\n`;
            response += `    ${priceStr}\n`;
          }
        }
        response += `\n---\n\n`;
      }

      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching recently resolved: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_events_by_tag",
  {
    description:
      "Get events filtered by a specific tag. More granular than category filtering - find events by specific topics like 'trump', 'bitcoin', 'nfl', etc.",
    inputSchema: {
      tag: z
        .string()
        .describe(
          "Tag to filter by (e.g., 'trump', 'bitcoin', 'nfl', 'kamala-harris')"
        ),
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Number of events to return (1-50, default: 10)"),
      active: z
        .boolean()
        .optional()
        .default(true)
        .describe("Filter by active status (default: true)"),
      closed: z
        .boolean()
        .optional()
        .default(false)
        .describe("Filter by closed status (default: false)"),
    },
  },
  async (params) => {
    try {
      const events = await fetchEventsByTag({
        tag: params.tag,
        limit: params.limit,
        active: params.active,
        closed: params.closed,
      });

      if (events.length === 0) {
        const sampleTags = CATEGORIES.allTags
          .slice(0, 10)
          .map((t) => t.slug)
          .join(", ");
        return {
          content: [
            {
              type: "text",
              text: `No events found with tag "${params.tag}".\n\nSome available tags: ${sampleTags}`,
            },
          ],
        };
      }

      let response = `# Events Tagged "${params.tag}"\n\nFound ${events.length} events.\n\n`;

      for (const event of events) {
        const vol = parseFloat(event.volume || "0").toLocaleString();
        const marketCount = event.markets?.length || 0;

        response += `## ${event.title}\n\n`;
        response += `- **Volume:** $${vol}\n`;
        response += `- **Markets:** ${marketCount}\n`;
        response += `- **Category:** ${event.category || "N/A"}\n`;

        if (event.tags && event.tags.length > 0) {
          const tagLabels = event.tags
            .map((t) => (typeof t === "string" ? t : t.label))
            .join(", ");
          response += `- **Tags:** ${tagLabels}\n`;
        }

        response += `- **Slug:** \`${event.slug}\`\n`;

        if (event.markets && event.markets.length > 0) {
          response += `\n**Markets:**\n`;
          for (const market of event.markets.slice(0, 2)) {
            let outcomes: string[] = [];
            let prices: string[] = [];
            try {
              outcomes = JSON.parse(market.outcomes || "[]");
              prices = JSON.parse(market.outcomePrices || "[]");
            } catch {
              /* empty */
            }
            const priceStr = outcomes
              .map((o, i) => {
                const p = prices[i]
                  ? (parseFloat(prices[i]) * 100).toFixed(0) + "%"
                  : "N/A";
                return `${o}: ${p}`;
              })
              .join(" | ");
            response += `  - ${market.question.slice(0, 50)}${
              market.question.length > 50 ? "..." : ""
            } (${priceStr})\n`;
          }
        }
        response += `\n---\n\n`;
      }

      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching events by tag: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_competitive_markets",
  {
    description:
      "Get markets with close/competitive odds (near 50/50). These are the most uncertain markets where the outcome is genuinely in question.",
    inputSchema: {
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Number of markets to return (1-50, default: 10)"),
      spread_threshold: z
        .number()
        .min(0.05)
        .max(0.5)
        .optional()
        .default(0.2)
        .describe("Maximum spread from 50/50 (0.05-0.5, default: 0.2 = 20%)"),
    },
  },
  async (params) => {
    try {
      const markets = await fetchCompetitiveMarkets({
        limit: params.limit,
        spreadThreshold: params.spread_threshold,
      });

      if (markets.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No competitive markets found within ${
                params.spread_threshold * 100
              }% of 50/50.`,
            },
          ],
        };
      }

      let response = `# Competitive Markets (within ${
        params.spread_threshold * 100
      }% of 50/50)\n\nThese markets have the most uncertain outcomes.\n\n`;

      for (let i = 0; i < markets.length; i++) {
        const market = markets[i];

        let outcomes: string[] = [];
        let prices: number[] = [];
        try {
          outcomes = JSON.parse(market.outcomes || "[]");
          const pricesStr = JSON.parse(market.outcomePrices || "[]");
          prices = pricesStr.map((p: string) => parseFloat(p));
        } catch {
          /* empty */
        }

        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
        const competitiveness = 1 - Math.abs(maxPrice - 0.5) * 2;

        response += `### ${i + 1}. ${market.question}\n\n`;

        const priceStr = outcomes
          .map((o, i) => {
            const p = prices[i] ? (prices[i] * 100).toFixed(1) + "%" : "N/A";
            return `**${o}:** ${p}`;
          })
          .join(" vs ");

        response += `- ${priceStr}\n`;
        response += `- **Competitiveness:** ${(competitiveness * 100).toFixed(
          0
        )}%\n`;
        response += `- **Volume:** $${parseFloat(
          market.volume || "0"
        ).toLocaleString()}\n`;
        response += `- **Liquidity:** $${parseFloat(
          market.liquidity || "0"
        ).toLocaleString()}\n`;
        response += `- **ID:** ${market.id}\n\n`;
      }

      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching competitive markets: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Polymarket MCP server started");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
