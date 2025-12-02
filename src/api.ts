import type {
  Market,
  Event,
  PriceHistory,
  OrderBook,
  CategoriesData,
} from "./types.js";
import {
  GAMMA_API_BASE,
  CLOB_API_BASE,
  matchesCategory,
  scoreEventForSearch,
} from "./utils.js";

export async function fetchMarkets(params: {
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
    throw new Error(
      `Failed to fetch markets: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    return data as Market[];
  }

  throw new Error("Unexpected API response format");
}

export async function searchMarkets(params: {
  query: string;
  limit?: number;
  active?: boolean;
  closed?: boolean;
}): Promise<Market[]> {
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
    throw new Error(
      `Failed to search markets: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected API response format");
  }

  const markets = data as Market[];
  const queryLower = params.query.toLowerCase();

  const filtered = markets.filter(
    (m) =>
      m.question?.toLowerCase().includes(queryLower) ||
      m.description?.toLowerCase().includes(queryLower)
  );

  return filtered.slice(0, params.limit || 10);
}

export async function searchEvents(params: {
  query: string;
  limit?: number;
  active?: boolean;
  closed?: boolean;
}): Promise<Event[]> {
  const querySlug = params.query.toLowerCase().replace(/\s+/g, "-");
  const queryLower = params.query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
  let events: Event[] = [];

  const baseParams = new URLSearchParams();
  if (params.active !== undefined) {
    baseParams.set("active", params.active.toString());
  }
  if (params.closed !== undefined) {
    baseParams.set("closed", params.closed.toString());
  }

  const tagParams = new URLSearchParams(baseParams);
  tagParams.set("tag_slug", querySlug);
  tagParams.set("limit", "100");
  let url = `${GAMMA_API_BASE}/events?${tagParams.toString()}`;
  let response = await fetch(url);

  if (response.ok) {
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      events = data as Event[];
    }
  }

  const volumeParams = new URLSearchParams(baseParams);
  volumeParams.set("limit", "500");
  volumeParams.set("order", "volume");
  volumeParams.set("ascending", "false");
  url = `${GAMMA_API_BASE}/events?${volumeParams.toString()}`;
  response = await fetch(url);

  if (response.ok) {
    const data = await response.json();
    if (Array.isArray(data)) {
      const allEvents = data as Event[];

      const scoredEvents = allEvents.map((event) => ({
        event,
        score: scoreEventForSearch(event, queryLower, querySlug, queryWords),
      }));

      const matchedEvents = scoredEvents
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ event }) => event);

      const existingIds = new Set(events.map((e) => e.id));
      for (const event of matchedEvents) {
        if (!existingIds.has(event.id)) {
          events.push(event);
          existingIds.add(event.id);
        }
      }
    }
  }

  events.sort((a, b) => {
    const volA = parseFloat(a.volume || "0");
    const volB = parseFloat(b.volume || "0");
    return volB - volA;
  });

  return events.slice(0, params.limit || 10);
}

export async function fetchEvents(params: {
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
    throw new Error(
      `Failed to fetch events: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    return data as Event[];
  }

  throw new Error("Unexpected API response format");
}

export async function fetchEventBySlug(slug: string): Promise<Event | null> {
  const url = `${GAMMA_API_BASE}/events?slug=${encodeURIComponent(slug)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch event: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (Array.isArray(data) && data.length > 0) {
    return data[0] as Event;
  }

  return null;
}

export async function fetchEventsByCategory(
  categories: CategoriesData,
  params: {
    category: string;
    limit?: number;
    active?: boolean;
    closed?: boolean;
  }
): Promise<Event[]> {
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
    throw new Error(
      `Failed to fetch events: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected API response format");
  }

  const events = data as Event[];
  const filtered = events.filter((event) =>
    matchesCategory(categories, event, params.category)
  );

  return filtered.slice(0, params.limit || 10);
}

export async function fetchTrendingMarkets(params: {
  limit?: number;
  sortBy: "volume24hr" | "volume1wk" | "oneDayPriceChange" | "oneWeekPriceChange";
}): Promise<Market[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", "100");
  searchParams.set("active", "true");
  searchParams.set("closed", "false");

  const url = `${GAMMA_API_BASE}/markets?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch markets: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected API response format");
  }

  const markets = data as Market[];

  const sorted = markets.sort((a, b) => {
    const aVal = Math.abs(parseFloat(a[params.sortBy] || "0"));
    const bVal = Math.abs(parseFloat(b[params.sortBy] || "0"));
    return bVal - aVal;
  });

  return sorted.slice(0, params.limit || 10);
}

export async function fetchPriceHistory(params: {
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
    throw new Error(
      `Failed to fetch price history: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as PriceHistory;
}

export async function fetchOrderBook(tokenId: string): Promise<OrderBook> {
  const url = `${CLOB_API_BASE}/book?token_id=${tokenId}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch order book: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as OrderBook;
}

export async function fetchMarketById(marketId: string): Promise<Market | null> {
  const url = `${GAMMA_API_BASE}/markets/${marketId}`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(
      `Failed to fetch market: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as Market;
}

export async function fetchEventsBySeries(params: {
  series: string;
  limit?: number;
  active?: boolean;
  closed?: boolean;
}): Promise<Event[]> {
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
    throw new Error(
      `Failed to fetch events: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected API response format");
  }

  const events = data as Event[];
  const seriesLower = params.series.toLowerCase();

  const filtered = events.filter((event) => {
    if (event.series && Array.isArray(event.series)) {
      return event.series.some(
        (s) =>
          s.slug?.toLowerCase() === seriesLower ||
          s.ticker?.toLowerCase() === seriesLower ||
          s.title?.toLowerCase().includes(seriesLower)
      );
    }
    const titleLower = event.title?.toLowerCase() || "";
    return titleLower.includes(seriesLower);
  });

  return filtered.slice(0, params.limit || 10);
}

export async function fetchClosingSoon(params: {
  hours?: number;
  limit?: number;
}): Promise<Event[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", "200");
  searchParams.set("active", "true");
  searchParams.set("closed", "false");

  const url = `${GAMMA_API_BASE}/events?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch events: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected API response format");
  }

  const events = data as Event[];
  const now = new Date();
  const hoursThreshold = params.hours || 24;
  const cutoffTime = new Date(now.getTime() + hoursThreshold * 60 * 60 * 1000);

  const closing = events.filter((event) => {
    if (!event.endDate) return false;
    const endDate = new Date(event.endDate);
    return endDate > now && endDate <= cutoffTime;
  });

  closing.sort((a, b) => {
    const dateA = new Date(a.endDate);
    const dateB = new Date(b.endDate);
    return dateA.getTime() - dateB.getTime();
  });

  return closing.slice(0, params.limit || 10);
}

export async function fetchMostEngaged(params: {
  limit?: number;
  active?: boolean;
}): Promise<Event[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", "200");

  if (params.active !== undefined) {
    searchParams.set("active", params.active.toString());
  }

  const url = `${GAMMA_API_BASE}/events?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch events: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected API response format");
  }

  const events = data as Event[];

  const sorted = events.sort((a, b) => {
    const countA = a.commentCount || 0;
    const countB = b.commentCount || 0;
    return countB - countA;
  });

  return sorted.slice(0, params.limit || 10);
}

export async function fetchHighLiquidityMarkets(params: {
  limit?: number;
  minLiquidity?: number;
}): Promise<Market[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", "100");
  searchParams.set("active", "true");
  searchParams.set("closed", "false");

  const url = `${GAMMA_API_BASE}/markets?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch markets: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected API response format");
  }

  let markets = data as Market[];

  if (params.minLiquidity) {
    markets = markets.filter(
      (m) => parseFloat(m.liquidity || "0") >= params.minLiquidity!
    );
  }

  const sorted = markets.sort((a, b) => {
    const liqA = parseFloat(a.liquidity || "0");
    const liqB = parseFloat(b.liquidity || "0");
    return liqB - liqA;
  });

  return sorted.slice(0, params.limit || 10);
}

export async function fetchRecentlyResolved(params: {
  limit?: number;
  days?: number;
}): Promise<Event[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", "200");
  searchParams.set("closed", "true");

  const url = `${GAMMA_API_BASE}/events?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch events: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected API response format");
  }

  const events = data as Event[];
  const now = new Date();
  const daysThreshold = params.days || 7;
  const cutoffTime = new Date(
    now.getTime() - daysThreshold * 24 * 60 * 60 * 1000
  );

  const recent = events.filter((event) => {
    const closedTime = event.closedTime ? new Date(event.closedTime) : null;
    const endDate = event.endDate ? new Date(event.endDate) : null;
    const checkDate = closedTime || endDate;
    return checkDate && checkDate >= cutoffTime;
  });

  recent.sort((a, b) => {
    const dateA = new Date(a.closedTime || a.endDate);
    const dateB = new Date(b.closedTime || b.endDate);
    return dateB.getTime() - dateA.getTime();
  });

  return recent.slice(0, params.limit || 10);
}

export async function fetchEventsByTag(params: {
  tag: string;
  limit?: number;
  active?: boolean;
  closed?: boolean;
}): Promise<Event[]> {
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
    throw new Error(
      `Failed to fetch events: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected API response format");
  }

  const events = data as Event[];
  const tagLower = params.tag.toLowerCase();

  const filtered = events.filter((event) => {
    if (event.tags && Array.isArray(event.tags)) {
      return event.tags.some((t) => {
        const tagSlug = typeof t === "string" ? t : t.slug;
        const tagLabel = typeof t === "string" ? t : t.label;
        return (
          tagSlug?.toLowerCase() === tagLower ||
          tagLabel?.toLowerCase().includes(tagLower)
        );
      });
    }
    return false;
  });

  return filtered.slice(0, params.limit || 10);
}

export async function fetchCompetitiveMarkets(params: {
  limit?: number;
  spreadThreshold?: number;
}): Promise<Market[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", "100");
  searchParams.set("active", "true");
  searchParams.set("closed", "false");

  const url = `${GAMMA_API_BASE}/markets?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch markets: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected API response format");
  }

  const markets = data as Market[];
  const spreadThreshold = params.spreadThreshold || 0.2;

  const withCompetitiveness = markets.map((market) => {
    let prices: number[] = [];
    try {
      const pricesStr = JSON.parse(market.outcomePrices || "[]");
      prices = pricesStr.map((p: string) => parseFloat(p));
    } catch {
      // Keep empty
    }

    let competitiveness = 0;
    if (prices.length >= 2) {
      const maxPrice = Math.max(...prices);
      competitiveness = 1 - Math.abs(maxPrice - 0.5) * 2;
    }

    return { market, competitiveness, prices };
  });

  const competitive = withCompetitiveness.filter(
    ({ competitiveness }) => competitiveness >= 1 - spreadThreshold
  );

  competitive.sort((a, b) => b.competitiveness - a.competitiveness);

  return competitive.slice(0, params.limit || 10).map(({ market }) => market);
}
