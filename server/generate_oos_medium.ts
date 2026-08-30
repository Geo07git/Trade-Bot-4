import { runBacktest } from './services/momentum/BacktestEngine';
import { getBinanceUniverse } from './services/momentum/Universe';
import { MomentumConfig } from './services/momentum/types';
import * as fs from 'fs';

async function generateOOS() {
  console.log("--- STARTING MEDIUM OOS BACKTEST GENERATION ---");
  const { tradingUniverse } = await getBinanceUniverse();
  
  // Try 10 symbols, 3 months
  const symbols = tradingUniverse.slice(0, 10); 
  console.log(`Universe size: ${symbols.length} symbols.`);

  const config: MomentumConfig = {
    minLiquidity24h: 10000000, 
    entryFeePct: 0.075,
    exitFeePct: 0.075,
    entrySlippagePct: 0.1,
    exitSlippagePct: 0.1,
    minMomentumScore: 50 // Keep the signal threshold identical
  };

  const oosEndTime = new Date('2025-07-29T23:59:59Z').getTime();
  const oosStartTime = new Date('2025-02-01T00:00:00Z').getTime(); // 6 months

  console.log(`Running MEDIUM OOS backtest for ${symbols.length} symbols from ${new Date(oosStartTime).toISOString()} to ${new Date(oosEndTime).toISOString()}`);
  
  const results = await runBacktest(symbols, config, oosStartTime, oosEndTime);
  
  const filename = 'server/data/backtests/bt_OOS.json';
  fs.writeFileSync(filename, JSON.stringify(results));
  console.log(`--- MEDIUM OOS BACKTEST COMPLETE. WRITTEN TO ${filename} ---`);
}

generateOOS().catch(console.error);
