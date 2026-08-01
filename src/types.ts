export type ViewState = 'superDashboard' | 'dashboard' | 'journal' | 'analyst' | 'news' | 'alerts' | 'logs' | 'settings';

export interface MarketOpportunity {
  symbol: string;
  price: number;
  opportunityScore: number; // 0 - 100
  rfProb: number;
  metaProb: number;
  trendAlignment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  adx: number;
  atrPercent: number;
  momentumScore: number; // 0 - 100
  volume24h: number; // in USDT
  volumeGrowth24h: number; // %
  liquidityScore: number; // 0 - 100
  spreadPercent: number;
  reversalSignal: 'BULLISH_REVERSAL' | 'BEARISH_REVERSAL' | 'NONE';
  sentimentLabel: 'bullish' | 'bearish' | 'neutral';
  regime: 'TRENDING_BULL' | 'RANGING' | 'TRENDING_BEAR';
  historicalPerformanceScore: number; // -15 to +15 bonus/penalty
  inDynamicWatchlist: boolean;
  rank: number;
  updatedAt: string;
  reason: string;
}

export interface SymbolPerformanceStat {
  symbol: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number; // %
  realizedPnL: number; // USDT
  profitFactor: number;
  avgProfitPercent: number;
  avgLossPercent: number;
  maxDrawdownPercent: number;
  sharpeScore: number;
  avgHoldDurationMinutes: number;
  lastTradedAt?: string;
}

export interface JournalEntry {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  price: number;
  amount: number;
  fee: number;
  pnl: number;
  pnlPercent: number;
  mlProbability: number;
  modelName: string;
  entryReason: string;
  mode: 'paper' | 'testnet' | 'live';
  timestamp: string;
  date: string; // YYYY-MM-DD
  notes?: string;
  tradeGrade?: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  tradeQualityScore?: number;
  stars?: number;
  oppScore?: number;
}

export interface DailySnapshot {
  date: string; // YYYY-MM-DD
  equity: number;
  realizedPnL: number;
  unrealizedPnL: number;
  winRate: number;
  totalTrades: number;
  bestModel: string;
  bestStrategy: string;
  timestamp: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  categories: string[];
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  imageUrl?: string;
  relatedSymbols?: string[];
}

export interface Position {
  id?: string;
  symbol: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  highestPrice?: number;
  openedAt?: number;
  entryMlProb?: number;
  entryOppScore?: number;
  shares?: number;
  pnl?: number;
  pnlPercent?: number;
}

export interface TradeLog {
  id: string;
  timestamp: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  shares: number;
  price: number;
  reason: string;
  equity?: number;
}

export interface BacktestResult {
  strategy: string;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  trades: number;
  chartData: { time: string; equity: number }[];
}
