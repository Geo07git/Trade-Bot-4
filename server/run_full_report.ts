import { runBacktest } from './services/momentum/BacktestEngine';
import { getBinanceUniverse } from './services/momentum/Universe';
import { MomentumConfig, BacktestResult } from './services/momentum/types';

async function main() {
  console.log("1. STATUS EXECUȚIE: Rulează backtest-ul baseline...");
  const { tradingUniverse } = await getBinanceUniverse();
  console.log(`Univers detectat: ${tradingUniverse.length} simboluri.`);

  const config: MomentumConfig = {
    minLiquidity24h: 10000000, 
    entryFeePct: 0.075,
    exitFeePct: 0.075,
    entrySlippagePct: 0.1,
    exitSlippagePct: 0.1,
    minMomentumScore: 50
  };

  const endTime = Date.now();
  const startTime = endTime - 60 * 24 * 60 * 60 * 1000; // 60 days to ensure fast completion and reliability

  console.log(`Perioada: 60 zile (${new Date(startTime).toISOString()} - ${new Date(endTime).toISOString()})`);
  
  const results: BacktestResult[] = await runBacktest(tradingUniverse, config, startTime, endTime);
  console.log(`Total semnale generate: ${results.length}`);

  // Compute metrics
  const totalSignals = results.length;
  const winning = results.filter(r => r.netPnL_at_24h_Pct > 0);
  const losing = results.filter(r => r.netPnL_at_24h_Pct <= 0);
  const winRate = totalSignals > 0 ? (winning.length / totalSignals) * 100 : 0;

  const grossProfit = winning.reduce((acc, r) => acc + r.netPnL_at_24h_Pct, 0);
  const grossLoss = Math.abs(losing.reduce((acc, r) => acc + r.netPnL_at_24h_Pct, 0));
  const netPnL = results.reduce((acc, r) => acc + r.netPnL_at_24h_Pct, 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  const avgWin = winning.length > 0 ? grossProfit / winning.length : 0;
  const avgLoss = losing.length > 0 ? grossLoss / losing.length : 0;
  const expectancy = totalSignals > 0 ? netPnL / totalSignals : 0;

  const maxDrawdown = Math.min(...results.map(r => r.MAE_Pct), 0);
  const totalFees = totalSignals * (config.entryFeePct + config.exitFeePct);
  const totalSlippage = totalSignals * (config.entrySlippagePct + config.exitSlippagePct);

  const sortedPnL = [...results.map(r => r.netPnL_at_24h_Pct)].sort((a, b) => a - b);
  const bestTrade = sortedPnL.length > 0 ? sortedPnL[sortedPnL.length - 1] : 0;
  const worstTrade = sortedPnL.length > 0 ? sortedPnL[0] : 0;

  // Score distribution
  const scores = results.map(r => r.factors.momentumScore).sort((a, b) => a - b);
  const getPercentile = (arr: number[], p: number) => {
    if (arr.length === 0) return 0;
    const idx = Math.floor((p / 100) * arr.length);
    return arr[Math.min(idx, arr.length - 1)];
  };

  console.log("\n=================== RAPORT BASELINE BACKTEST ===================");
  console.log(`Perioada: 60 zile | Simboluri: ${tradingUniverse.length} | Semnale: ${totalSignals}`);
  console.log(`Win Rate: ${winRate.toFixed(2)}% | Net PnL: ${netPnL.toFixed(2)}% | Profit Factor: ${profitFactor.toFixed(2)}`);
  console.log(`Max Drawdown: ${maxDrawdown.toFixed(2)}% | Expectancy: ${expectancy.toFixed(4)}%`);
  console.log("===============================================================");
}

main().catch(console.error);
