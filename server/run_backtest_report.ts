
import { runBacktest } from './services/momentum/BacktestEngine';
import { getBinanceUniverse } from './services/momentum/Universe';
import { MomentumConfig, BacktestResult } from './services/momentum/types';

async function generateReport() {
  console.log("--- STARTING BASELINE BACKTEST ---");
  const { tradingUniverse } = await getBinanceUniverse();
  console.log(`Universe size: ${tradingUniverse.length} symbols.`);

  const config: MomentumConfig = {
    minLiquidity24h: 10000000, // 10M USDT as requested for liquid altcoins
    entryFeePct: 0.075,
    exitFeePct: 0.075,
    entrySlippagePct: 0.1,
    exitSlippagePct: 0.1,
    minMomentumScore: 50
  };

  const endTime = Date.now();
  const startTime = endTime - 90 * 24 * 60 * 60 * 1000;

  console.log(`Running backtest for ${tradingUniverse.length} symbols over 90 days...`);
  // Running on full universe might be slow and hit rate limits, 
  // but requested for "minimum 60 days, ideal 90 days"
  const results = await runBacktest(tradingUniverse, config, startTime, endTime);

  console.log("--- GENERATING REPORT ---");
  console.log(`Total signals: ${results.length}`);
  
  // Logic to calculate stats will go here...
  // Since I cannot change BacktestEngine.ts, I process `results` here.
  
  console.log(JSON.stringify(results.slice(0, 5), null, 2)); // Preview
}

generateReport().catch(console.error);
