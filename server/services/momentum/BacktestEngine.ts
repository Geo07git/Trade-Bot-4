import { MomentumConfig, BacktestResult } from './types';
import { fetchHistoricalKlinesForMomentum, buildSynchronizedSnapshot, clearCache } from './DataFetcher';
import { calculateMomentumScore } from './Scorer';

export async function runBacktest(
  symbols: string[],
  config: MomentumConfig,
  startTime: number,
  endTime: number
) {
  const results: BacktestResult[] = [];
  const CHUNK_SIZE = 20;

  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    const chunk = symbols.slice(i, i + CHUNK_SIZE);
    console.log(`Processing chunk ${i / CHUNK_SIZE + 1}/${Math.ceil(symbols.length / CHUNK_SIZE)}`);
    
    for (const symbol of chunk) {
      const k15m = await fetchHistoricalKlinesForMomentum(symbol, '15m');
      const k1h = await fetchHistoricalKlinesForMomentum(symbol, '1h');
      const k4h = await fetchHistoricalKlinesForMomentum(symbol, '4h');

      // State tracker for this symbol in backtest
      let isPositionOpen = false;
      let positionEntryPrice = 0;
      let positionEntryTime = 0;

      for (let t = startTime; t < endTime; t += 15 * 60 * 1000) {
        // 1. Position management: If already open, skip signal generation
        if (isPositionOpen) {
          // Check if 24h passed to close
          if (t >= positionEntryTime + 24 * 60 * 60 * 1000) {
            isPositionOpen = false;
          }
          continue;
        }

        const snap = buildSynchronizedSnapshot(t, k15m, k1h, k4h);
        if (snap.kline15m.length < 2) continue;

        const scores = calculateMomentumScore(snap.kline15m, snap.kline1h, snap.kline4h);

        if (scores.momentumScore >= config.minMomentumScore) {
          // 2. Entry: Open of T+15m
          const entryKline = k15m.find(k => k.openTime === snap.kline15m[snap.kline15m.length - 1].closeTime + 1);
          if (!entryKline) continue;

          const rawEntry = entryKline.open;
          const adjustedEntryPrice = rawEntry * (1 + config.entrySlippagePct / 100);
          
          isPositionOpen = true;
          positionEntryPrice = adjustedEntryPrice;
          positionEntryTime = entryKline.openTime;

          // 3. Scan forward for MFE, MAE, PnL
          let mfe = 0;
          let mae = 0;
          let pnl24h = 0;

          const futureKlines = k15m.filter(k => k.openTime > entryKline.openTime && k.openTime <= entryKline.openTime + 24 * 60 * 60 * 1000);

          for (const k of futureKlines) {
            mfe = Math.max(mfe, ((k.high / adjustedEntryPrice) - 1) * 100);
            mae = Math.min(mae, ((k.low / adjustedEntryPrice) - 1) * 100);
          }

          const lastKline = futureKlines[futureKlines.length - 1] || entryKline;
          const exitPrice = lastKline.close * (1 - config.exitSlippagePct / 100);
          
          // PnL calculation
          const pnlRaw = (exitPrice / adjustedEntryPrice) - 1;
          pnl24h = (pnlRaw * (1 - config.entryFeePct / 100 - config.exitFeePct / 100)) * 100;

          results.push({
            symbol,
            signalTimestamp: t,
            entryTimestamp: entryKline.openTime,
            rawEntryPrice: rawEntry,
            adjustedEntryPrice,
            entryFeePct: config.entryFeePct,
            exitFeePct: config.exitFeePct,
            entrySlippagePct: config.entrySlippagePct,
            exitSlippagePct: config.exitSlippagePct,
            totalTradingCostPct: config.entryFeePct + config.exitFeePct + config.entrySlippagePct + config.exitSlippagePct,
            MFE_Pct: mfe,
            MAE_Pct: mae,
            plus_2h_Pct: 0, // Simplified for now
            plus_4h_Pct: 0,
            plus_8h_Pct: 0,
            plus_12h_Pct: 0,
            plus_20h_Pct: 0,
            plus_24h_Pct: pnl24h,
            maxDrawdownPct: mae,
            netPnL_at_24h_Pct: pnl24h,
            factors: {
              symbol,
              timestamp_T: t,
              ...scores,
              breakoutStrength: scores.breakoutStrength,
              relativeStrengthBTC: 0,
              pullbackQuality: scores.pullbackQuality,
              liquidityAtT: 0, // Placeholder
              distanceFromHighPct: 0
            }
          });
        }
      }
    }
    
    // Memory management: clear cache and throttle
    clearCache();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return results;
}
