
import { runBacktest } from './services/momentum/BacktestEngine';
import { getBinanceUniverse } from './services/momentum/Universe';
import { MomentumConfig } from './services/momentum/types';
import * as fs from 'fs';

async function generateReportToFile() {
  console.log("--- STARTING BASELINE BACKTEST ---");
  const { tradingUniverse } = await getBinanceUniverse();
  console.log(`Universe size: ${tradingUniverse.length} symbols.`);

  const config: MomentumConfig = {
    minLiquidity24h: 10000000, 
    entryFeePct: 0.075,
    exitFeePct: 0.075,
    entrySlippagePct: 0.1,
    exitSlippagePct: 0.1,
    minMomentumScore: 50
  };

  const endTime = Date.now();
  const startTime = endTime - 90 * 24 * 60 * 60 * 1000;

  console.log(`Running backtest for ${tradingUniverse.length} symbols over 90 days...`);
  
  // Rulăm backtest-ul
  const results = await runBacktest(tradingUniverse, config, startTime, endTime);

  // Scriem rezultatele în fișier (fără log-uri masive în consolă)
  fs.writeFileSync('server/backtest_results.json', JSON.stringify(results));
  console.log("--- BACKTEST COMPLETE. RESULTS WRITTEN TO FILE ---");
}

generateReportToFile().catch(console.error);
