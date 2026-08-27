export interface MomentumConfig {
  minLiquidity24h: number;     // Quote volume (USDT) minimum at time T
  entryFeePct: number;         // e.g., 0.075 for Binance VIP 0 taker
  exitFeePct: number;          // e.g., 0.075
  entrySlippagePct: number;    // e.g., 0.1 for market order slippage
  exitSlippagePct: number;     // e.g., 0.1
  minMomentumScore: number;    // Minimum score to trigger a candidate
}

export interface KlineSnapshot {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;       // Base asset volume
  quoteVolume: number;  // USDT volume
  closeTime: number;
}

export interface MultiTimeframeSnapshot {
  tAnchor: number; // Anchor timestamp (close time of the 15m candle)
  kline15m: KlineSnapshot[]; // Array of 15m candles up to T
  kline1h: KlineSnapshot[];  // Array of 1h candles up to T
  kline4h: KlineSnapshot[];  // Array of 4h candles up to T
}

export interface CandidateFactors {
  symbol: string;
  timestamp_T: number; // The anchor closeTime
  momentumScore: number;
  momentum_15m: number;
  momentum_1h: number;
  momentum_4h: number;
  rvol_current: number;
  volumeAcceleration: number; // Numeric acceleration
  breakoutStrength: number;
  atrExpansion: number;
  relativeStrengthBTC: number;
  pullbackQuality: number; // Changed to number based on Scorer logic
  liquidityAtT: number;    // 24h Quote volume up to T
  distanceFromHighPct: number;
}

export interface BacktestResult {
  symbol: string;
  signalTimestamp: number;   // T (anchor closeTime)
  entryTimestamp: number;    // T + 15m (openTime of next candle)
  rawEntryPrice: number;     // Open price of T + 15m candle
  adjustedEntryPrice: number;// rawEntryPrice * (1 + entrySlippagePct/100)
  
  // Cost breakdown
  entryFeePct: number;
  exitFeePct: number;
  entrySlippagePct: number;
  exitSlippagePct: number;
  totalTradingCostPct: number;
  
  // Performance from Adjusted Entry
  MFE_Pct: number;
  MAE_Pct: number;
  plus_2h_Pct: number;
  plus_4h_Pct: number;
  plus_8h_Pct: number;
  plus_12h_Pct: number;
  plus_20h_Pct: number;
  plus_24h_Pct: number;
  maxDrawdownPct: number;
  netPnL_at_24h_Pct: number;
  
  factors: CandidateFactors;
}
