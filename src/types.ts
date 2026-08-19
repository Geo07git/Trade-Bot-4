export type ViewState = 'superDashboard' | 'dashboard' | 'scalping' | 'grid' | 'journal' | 'analyst' | 'alerts' | 'logs' | 'settings' | 'calibration';

export type ExecutionEngineMode = 'both' | 'grid' | 'scalping';

export type MlModelSelection = 'rf' | 'tcn' | 'both';

export interface ScalpingConfig {
  active: boolean;
  minRfProb: number;            // e.g. 70%
  minMetaScore: number;         // e.g. 70
  stopLossPercent: number;      // e.g. 1.0%
  targetTakeProfit: number;     // e.g. 3.0%
  trailingStopActivation: number; // e.g. 1.5%
  trailingStopDistance: number;   // e.g. 0.5%
  breakEvenActivation: number;    // e.g. 1.0%
  positionSizePercent: number;    // e.g. 5.0%
  maxHoldMinutes: number;         // e.g. 15
  maxNegativeHoldMinutes?: number; // e.g. 1.0 minute on drawdown/loss
  enableMaxNegativeHold?: boolean; // ON/OFF switch for max negative hold limit rule
  minOpportunityScore: number;    // e.g. 50
  cooldownMinutes: number;        // e.g. 2
  enableDynamicSizing: boolean;   // e.g. true (3% - 8% based on MetaScore)
  minVolumeGrowth?: number;       // e.g. 0.8x
  enableStagnationFilter?: boolean;  // Default: true (Filtru Stagnare & Volatilitate Scăzută NO-TRADE)
  minAtrPctThreshold?: number;     // Default: 0.30% (ATR minim pentru acoperire comisioane)
  minRange20pThreshold?: number;    // Default: 0.55% (Range 20 lumânări minim)
  leverage?: number;               // e.g. 1, 2, 3, 5, 10, 20 (Levier ajustabil scalping)
}

export interface MetaTradeScoreBreakdown {
  finalTradeScore: number;
  opportunityScore: number;
  aiProbability: number;
  rangeProbability: number;
  historicalCoinPFScore: number;
  marketRegimeScore: number;
  feeEfficiencyScore: number;
  isApproved: boolean;
  executionRule: 'DIRECT_EXECUTE' | 'CONFIRMATION_EXECUTE' | 'REJECTED_VETO';
  netProfitMarginPct: number;
  dynamicTPPct: number;
  dynamicPositionSizePct: number;
  vetoReason?: string;
}

export interface GridConfig {
  active: boolean;
  autoRegimeSwitch: boolean;
  gridMode: 'dynamic_atr' | 'support_resistance' | 'fixed_percent';
  gridLevels: number; // e.g. 6 (3 buy, 3 sell)
  rangePercent: number; // e.g. 2.5%
  highVolMultiplier: number; // e.g. 1.8x step expansion
  capitalPerGridPercent: number; // base capital %
  dynamicCapital: boolean; // dynamic 5% - 25% allocation based on risk score
  rangeThresholdProb: number; // e.g. 75%
  // Capital Rotation Engine (Opportunity Cost & Smart Time Stop)
  enableCapitalRotation?: boolean;
  minRotationHoldMinutes?: number; // e.g. 90 minutes
  minOppScoreDiff?: number; // e.g. +15 points higher
  stagnantProfitMaxPct?: number; // e.g. 0.30%
}

export interface SmartGridStatus {
  symbol: string;
  regime: 'Range' | 'Trend' | 'High Volatility' | 'High Risk';
  regimeBadge: '🟢 Range' | '🔵 Trend' | '🟠 Volatilitate' | '🔴 Risc Ridicat';
  regimeExplanation: string;
  gridActive: boolean;
  gridAnchorPrice?: number;
  currentPrice: number;
  lowerPrice: number;
  upperPrice: number;
  gridStepPercent: number;
  buyLevels: number[];
  sellLevels: number[];
  executedGridTrades: number;
  gridProfit: number; // USDT
  opportunityScore: number;
  // Commercial AI Indicators & Multi-Regime Probabilities
  rangeProb: number; // 0 - 100%
  trendProb: number; // 0 - 100%
  breakoutProb: number; // 0 - 100%
  gridConfidence: number; // 0 - 100%
  expectedDailyProfitPct: number; // e.g. 0.7
  expectedDailyProfitMargin: number; // e.g. 0.4
  maxDrawdownEstPct: number; // e.g. -8.2%
  choppinessIndex: number; // e.g. 58.4 (>38.2 means range)
  bollingerWidthPct: number; // e.g. 3.2%
  hurstExponent: number; // < 0.5 mean reversion / range
  adxValue: number;
  atrPercent: number;
  allocatedCapitalPct: number; // 5%, 10%, 15%, 25%
  supportPrice: number;
  resistancePrice: number;
  lastAction?: string;
  updatedAt: string;
  // Volatility Shock & Smart Recovery Diagnostics
  shockScore?: number;
  shockLevel?: 'MIC' | 'MEDIU' | 'EXTREM' | 'NONE';
  shockUntilMs?: number;
  // Rotation Engine Diagnostics
  openedAt?: string;
  holdMinutes?: number;
  rotationReadiness?: 'LOW_HOLD_TIME' | 'MONITORING' | 'EVALUATING_ROTATION' | 'ROTATION_CANDIDATE';
  rotationTargetSymbol?: string;
}

export interface GridOrderHistory {
  id: string;
  symbol: string;
  action: 'GRID_BUY' | 'GRID_SELL' | 'GRID_ROTATION';
  price: number;
  amount: number;
  pnl?: number;
  regime: string;
  timestamp: string;
  holdMinutes?: number;
  rotationDetail?: string;
}

export interface MarketOpportunity {
  symbol: string;
  price: number;
  opportunityScore: number; // 0 - 100
  discoveryScore?: number; // 0 - 100 (Separate Discovery Score for pair selection)
  patternScore?: number;
  patternName?: string;
  priceChangePercent?: number;
  candlestickPatternScore?: number; // 0 - 100 (50% weight)
  candlestickPatternName?: string;
  momentumAccelScore?: number; // 0 - 100 (15% weight)
  rvolScore?: number; // 0 - 100 (10% weight)
  structureScore?: number; // 0 - 100 (10% weight)
  liquiditySpreadScore?: number; // 0 - 100 (5% weight)
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

export interface MinuteProfitLog {
  minute: number;
  pnlPercent: number;
  pnl: number;
  price: number;
  timestamp: string;
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
  minuteProfitLogs?: MinuteProfitLog[];
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
  lowestPrice?: number;
  mfePct?: number;
  maePct?: number;
  openedAt?: number;
  negativeEnteredAt?: number;
  lastMinuteLogged?: number;
  minuteProfitLogs?: MinuteProfitLog[];
  entryMlProb?: number;
  entryOppScore?: number;
  shares?: number;
  pnl?: number;
  pnlPercent?: number;
  strategy?: 'grid' | 'scalping' | 'manual';
  entryPatternName?: string;
  leverage?: number;
  margin?: number;
}

export interface TradeLog {
  id: string;
  timestamp: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  shares: number;
  price: number;
  reason: string;
  mfePct?: number;
  maePct?: number;
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

export interface SignalJournalEntry {
  id: string;
  timestamp: string;
  time: string;
  symbol: string;
  price: number;
  rfProb: number;
  metaProb: number;
  reversalScore: number;
  isReversal: boolean;
  reversalType?: 'bullish' | 'bearish';
  newsSentiment?: 'bullish' | 'bearish' | 'neutral';
  finalAction: 'BUY' | 'SELL' | 'HOLD';
  vetoReason: string;
  explanation?: string[];
}
