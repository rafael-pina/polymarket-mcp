import type { Market, Event, PriceHistory, OrderBook } from "./types.js";

export function formatMarket(market: Market, includeDetails = true): string {
  let outcomes: string[] = [];
  let prices: string[] = [];

  try {
    outcomes = JSON.parse(market.outcomes || "[]");
    prices = JSON.parse(market.outcomePrices || "[]");
  } catch {
    // Keep empty
  }

  const outcomesWithPrices = outcomes
    .map((outcome, i) => {
      const price = prices[i]
        ? (parseFloat(prices[i]) * 100).toFixed(1) + "%"
        : "N/A";
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

export function formatEvent(event: Event): string {
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

      const priceStr = outcomes
        .map((o, i) => {
          const p = prices[i]
            ? (parseFloat(prices[i]) * 100).toFixed(1) + "%"
            : "N/A";
          return `${o}: ${p}`;
        })
        .join(" | ");

      result += `\n### ${market.question}\n`;
      result += `- **ID:** ${market.id}\n`;
      result += `- **Prices:** ${priceStr}\n`;
      result += `- **Volume:** $${parseFloat(market.volume || "0").toLocaleString()}\n`;
    }
  }

  return result.trim();
}

export function formatPriceHistory(
  history: PriceHistory,
  question: string
): string {
  if (!history.history || history.history.length === 0) {
    return "No price history available for this market.";
  }

  const points = history.history;
  const latest = points[points.length - 1];
  const oldest = points[0];

  const prices = points.map((p) => p.p);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

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

  const recentPoints = points.slice(-10);
  for (const point of recentPoints) {
    const date = new Date(point.t * 1000).toLocaleString();
    result += `- ${date}: ${(point.p * 100).toFixed(1)}%\n`;
  }

  return result.trim();
}

export function formatOrderBook(orderBook: OrderBook, question: string): string {
  const topBids = orderBook.bids.slice(0, 10);
  const topAsks = orderBook.asks.slice(0, 10);

  const bestBid = parseFloat(topBids[0]?.price || "0");
  const bestAsk = parseFloat(topAsks[0]?.price || "0");
  const spread = bestAsk - bestBid;
  const midPrice = (bestBid + bestAsk) / 2;

  const totalBidLiquidity = topBids.reduce(
    (sum, b) => sum + parseFloat(b.size),
    0
  );
  const totalAskLiquidity = topAsks.reduce(
    (sum, a) => sum + parseFloat(a.size),
    0
  );

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
