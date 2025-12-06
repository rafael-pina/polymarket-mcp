# Polymarket MCP Server

[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-blue)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org)

A powerful **MCP (Model Context Protocol) server** for querying [Polymarket](https://polymarket.com) prediction markets. Access real-time odds, market data, price history, and order books directly from your AI assistant.

## 🎯 What is This?

This MCP server enables AI assistants like **Claude**, **Cursor**, and other MCP-compatible tools to interact with Polymarket's prediction markets API. Query live market odds, track price movements, analyze order books, and explore markets by category — all through natural language.

## ✨ Features

| Tool                     | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| `list_markets`           | List and paginate through all Polymarket prediction markets |
| `search_markets`         | Search markets by keyword (questions & descriptions)        |
| `get_market`             | Get detailed information about a specific market by ID      |
| `get_event`              | Fetch event details with all sub-markets grouped together   |
| `get_events_by_category` | Filter markets by category (politics, crypto, sports, etc.) |
| `list_categories`        | List all available market categories                        |
| `get_trending_markets`   | Discover hot markets by volume or price movement            |
| `get_price_history`      | Historical price/odds data for any market                   |
| `get_order_book`         | Real-time order book depth (bids & asks)                    |

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/poly-mcp.git
cd poly-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## 🚀 Usage

### Running the Server

```bash
# Production mode
npm start

# Development mode (with hot reload)
npm run dev

# MCP Inspector (for testing)
npm run client
```

### Adding to Cursor IDE

Add this to your Cursor MCP settings file (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "polymarket": {
      "command": "node",
      "args": ["/absolute/path/to/poly-mcp/dist/index.js"]
    }
  }
}
```

### Adding to Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "polymarket": {
      "command": "node",
      "args": ["/absolute/path/to/poly-mcp/dist/index.js"]
    }
  }
}
```

## 🛠️ Tools Reference

### `list_markets`

List prediction markets from Polymarket with pagination support.

| Parameter | Type    | Default | Description               |
| --------- | ------- | ------- | ------------------------- |
| `limit`   | number  | 10      | Number of markets (1-100) |
| `active`  | boolean | -       | Filter by active status   |
| `closed`  | boolean | -       | Filter by closed status   |
| `offset`  | number  | 0       | Pagination offset         |

**Example:** _"List 20 active markets on Polymarket"_

---

### `search_markets`

Search for markets by keyword matching questions and descriptions.

| Parameter | Type    | Default    | Description              |
| --------- | ------- | ---------- | ------------------------ |
| `query`   | string  | _required_ | Search query             |
| `limit`   | number  | 10         | Number of results (1-50) |
| `active`  | boolean | -          | Filter by active status  |
| `closed`  | boolean | -          | Filter by closed status  |

**Example:** _"Search for Bitcoin prediction markets"_

---

### `get_market`

Get detailed information about a specific market.

| Parameter   | Type   | Description            |
| ----------- | ------ | ---------------------- |
| `market_id` | string | The market ID to fetch |

**Example:** _"Get details for market ID 0x..."_

---

### `get_event`

Fetch an event with all its sub-markets. Events group related markets together.

| Parameter     | Type    | Description                                            |
| ------------- | ------- | ------------------------------------------------------ |
| `slug`        | string  | Event slug (e.g., `presidential-election-winner-2024`) |
| `event_id`    | string  | Event ID                                               |
| `list_events` | boolean | List available events instead                          |
| `limit`       | number  | Number of events to list (default: 10)                 |

**Example:** _"Show me the presidential election event on Polymarket"_

---

### `get_events_by_category`

Filter prediction markets by category for focused exploration.

| Parameter  | Type    | Default    | Description                 |
| ---------- | ------- | ---------- | --------------------------- |
| `category` | enum    | _required_ | Category filter (see below) |
| `limit`    | number  | 10         | Number of events (1-50)     |
| `active`   | boolean | true       | Filter by active status     |
| `closed`   | boolean | false      | Filter by closed status     |

**Available Categories:**

- `politics` — Elections, government, political events
- `crypto` — Cryptocurrency, blockchain, DeFi
- `sports` — NFL, NBA, Soccer, and more
- `world` — International relations, geopolitics
- `entertainment` — Music, TV, celebrities
- `economy` — GDP, markets, business
- `science` — Technology, AI, space, climate
- `legal` — Court cases, laws
- `racing` — F1, NASCAR, motorsports

**Example:** _"Show me politics markets on Polymarket"_

---

### `list_categories`

List all available categories for filtering markets.

**Example:** _"What categories are available on Polymarket?"_

---

### `get_trending_markets`

Discover trending markets sorted by activity metrics.

| Parameter | Type   | Default      | Description              |
| --------- | ------ | ------------ | ------------------------ |
| `sort_by` | enum   | `volume24hr` | Sort metric              |
| `limit`   | number | 10           | Number of markets (1-50) |

**Sort Options:**

- `volume24hr` — 24-hour trading volume
- `volume1wk` — Weekly trading volume
- `oneDayPriceChange` — 24-hour price movement
- `oneWeekPriceChange` — Weekly price movement

**Example:** _"Show me the hottest markets by 24h volume"_

---

### `get_price_history`

Get historical price/odds data for market analysis.

| Parameter       | Type   | Default    | Description             |
| --------------- | ------ | ---------- | ----------------------- |
| `market_id`     | string | _required_ | Market ID               |
| `outcome_index` | number | 0          | Outcome index (0 = Yes) |
| `interval`      | enum   | `1m`       | Time range              |

**Intervals:** `1d`, `1w`, `1m`, `3m`, `1y`, `max`

**Example:** _"Show price history for market 0x... over the past month"_

---

### `get_order_book`

Get real-time order book depth showing current bids and asks.

| Parameter       | Type   | Default    | Description             |
| --------------- | ------ | ---------- | ----------------------- |
| `market_id`     | string | _required_ | Market ID               |
| `outcome_index` | number | 0          | Outcome index (0 = Yes) |

**Example:** _"Show me the order book for market 0x..."_

## 💡 Example Queries

Once configured, you can ask your AI assistant:

- _"Show me politics markets with more than 50% odds for Yes"_
- _"What are the trending crypto markets right now?"_
- _"Search for Trump prediction markets"_
- _"Get the price history for the Bitcoin $100k market"_
- _"List all sports betting markets"_
- _"What's the order book depth for the presidential election market?"_

### Prompt Templates

Quick prompts to try with your AI assistant:

```
# Quick market check
What does Polymarket say about [TOPIC]? Show me the odds.

# Cross-source validation
News reports say [EVENT]. Check Polymarket and tell me if the
smart money agrees.

# Find opportunities
Find markets closing in the next 24 hours with 90%+ odds on one side.
```

## 🔧 Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Test with MCP Inspector
npm run client
```

## 📄 API Sources

This server uses the following Polymarket APIs:

- **Gamma API** (`gamma-api.polymarket.com`) — Market and event data
- **CLOB API** (`clob.polymarket.com`) — Order books and price history

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Links

- [Polymarket](https://polymarket.com) — The prediction market platform
- [Model Context Protocol](https://modelcontextprotocol.io) — MCP specification
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — Official SDK

---

**Keywords:** Polymarket, MCP, Model Context Protocol, prediction markets, AI assistant, Claude, Cursor, betting odds, crypto markets, political betting, sports betting, market analysis, order book, price history
