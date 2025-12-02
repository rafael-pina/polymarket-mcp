export interface CategoryConfig {
  label: string;
  description: string;
  tags: string[];
  apiCategory: string;
}

export interface CategoriesData {
  categories: Record<string, CategoryConfig>;
  allTags: Array<{ id: string; label: string; slug: string }>;
}

export interface Market {
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

export interface EventTag {
  id: string;
  label: string;
  slug: string;
}

export interface Series {
  id: string;
  ticker: string;
  slug: string;
  title: string;
  seriesType: string;
  recurrence: string;
  description?: string;
  image?: string;
  icon?: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  volume24hr: number;
  startDate?: string;
  commentCount: number;
}

export interface ExtendedMarket extends Market {
  resolutionSource?: string;
  closedTime?: string;
  competitive?: number;
}

export interface Event {
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
  markets: ExtendedMarket[];
  tags: EventTag[];
  series?: Series[];
  commentCount?: number;
  closedTime?: string;
  resolutionSource?: string;
}

export interface PricePoint {
  t: number;
  p: number;
}

export interface PriceHistory {
  history: PricePoint[];
}

export interface OrderBookLevel {
  price: string;
  size: string;
}

export interface OrderBook {
  market: string;
  asset_id: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  hash: string;
  timestamp: string;
  min_order_size: string;
  tick_size: string;
}
