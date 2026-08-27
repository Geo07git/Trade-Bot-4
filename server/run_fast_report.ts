import { runBacktest } from './services/momentum/BacktestEngine';
import { MomentumConfig, BacktestResult } from './services/momentum/types';

async function main() {
  console.log("=== ALTCOIN MOMENTUM ENGINE - BASELINE BACKTEST REPORT ===");
  
  // Top liquid altcoins basket for robust baseline evaluation
  const symbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 
    'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'LINKUSDT',
    'NEARUSDT', 'MATICUSDT', 'UNIUSDT', 'ATOMUSDT', 'LTCUSDT',
    'APTUSDT', 'ARBUSDT', 'OPUSDT', 'SUIUSDT', 'INJUSDT'
  ];

  const config: MomentumConfig = {
    minLiquidity24h: 5000000, 
    entryFeePct: 0.075,
    exitFeePct: 0.075,
    entrySlippagePct: 0.1,
    exitSlippagePct: 0.1,
    minMomentumScore: 50
  };

  const endTime = Date.now();
  const startTime = endTime - 30 * 24 * 60 * 60 * 1000; // 30 days

  console.log(`Perioada: 30 zile (${new Date(startTime).toISOString().split('T')[0]} - ${new Date(endTime).toISOString().split('T')[0]})`);
  console.log(`Simboluri testate: ${symbols.length} top altcoins`);
  console.log(`Configurare prag minim Momentum Score: ${config.minMomentumScore}`);

  const results: BacktestResult[] = await runBacktest(symbols, config, startTime, endTime);
  console.log(`Total semnale generate: ${results.length}`);

  if (results.length === 0) {
    console.log("Niciun semnal generat cu pragul 50 în această fereastră restrânsă. Rulăm cu pragul 20 pentru demonstrație statistică completă.");
  }

  const effectiveResults = results.length > 0 ? results : await runBacktest(symbols, { ...config, minMomentumScore: 20 }, startTime, endTime);

  // Compute metrics
  const totalSignals = effectiveResults.length;
  const winning = effectiveResults.filter(r => r.netPnL_at_24h_Pct > 0);
  const losing = effectiveResults.filter(r => r.netPnL_at_24h_Pct <= 0);
  const winRate = totalSignals > 0 ? (winning.length / totalSignals) * 100 : 0;

  const grossProfit = winning.reduce((acc, r) => acc + r.netPnL_at_24h_Pct, 0);
  const grossLoss = Math.abs(losing.reduce((acc, r) => acc + r.netPnL_at_24h_Pct, 0));
  const netPnL = effectiveResults.reduce((acc, r) => acc + r.netPnL_at_24h_Pct, 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;

  const avgWin = winning.length > 0 ? grossProfit / winning.length : 0;
  const avgLoss = losing.length > 0 ? grossLoss / losing.length : 0;
  const expectancy = totalSignals > 0 ? netPnL / totalSignals : 0;

  const maxDrawdown = Math.min(...effectiveResults.map(r => r.MAE_Pct), 0);
  const totalFees = totalSignals * (config.entryFeePct + config.exitFeePct);
  const totalSlippage = totalSignals * (config.entrySlippagePct + config.exitSlippagePct);

  const sortedPnL = [...effectiveResults.map(r => r.netPnL_at_24h_Pct)].sort((a, b) => a - b);
  const bestTrade = sortedPnL.length > 0 ? sortedPnL[sortedPnL.length - 1] : 0;
  const worstTrade = sortedPnL.length > 0 ? sortedPnL[0] : 0;

  // Score distribution
  const scores = effectiveResults.map(r => r.factors.momentumScore).sort((a, b) => a - b);
  const getPercentile = (arr: number[], p: number) => {
    if (arr.length === 0) return 0;
    const idx = Math.floor((p / 100) * arr.length);
    return arr[Math.min(idx, arr.length - 1)];
  };

  const p10 = getPercentile(scores, 10);
  const p25 = getPercentile(scores, 25);
  const p50 = getPercentile(scores, 50);
  const p75 = getPercentile(scores, 75);
  const p90 = getPercentile(scores, 90);
  const p95 = getPercentile(scores, 95);
  const p99 = getPercentile(scores, 99);

  const countScore = (min: number) => scores.filter(s => s >= min).length;

  console.log("\n--- JSON_REPORT_START ---");
  console.log(JSON.stringify({
    totalSignals,
    winningCount: winning.length,
    losingCount: losing.length,
    winRate,
    grossProfit,
    grossLoss,
    netPnL,
    profitFactor,
    avgWin,
    avgLoss,
    expectancy,
    maxDrawdown,
    totalFees,
    totalSlippage,
    bestTrade,
    worstTrade,
    scoreDist: { p10, p25, p50, p75, p90, p95, p99 },
    thresholds: {
      s50: countScore(50),
      s60: countScore(60),
      s70: countScore(70),
      s80: countScore(80),
      s90: countScore(90)
    }
  }, null, 2));
  console.log("--- JSON_REPORT_END ---");
}

main().catch(console.error);
