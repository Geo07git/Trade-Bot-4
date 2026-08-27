import { getBinanceUniverse } from './services/momentum/Universe';
import { calculateMomentumScore } from './services/momentum/Scorer';
import { fetchHistoricalKlinesForMomentum } from './services/momentum/DataFetcher';

async function test() {
  console.log('--- Momentum Universe Audit ---');
  
  const { marketContext, tradingUniverse, excluded } = await getBinanceUniverse();

  console.log(`Market Context: ${marketContext.length}`);
  console.log(`Trading Universe: ${tradingUniverse.length}`);
  
  // Liquidity filter simulation
  const minLiquidity = 10000000;
  const tickerRes = await fetch('https://api.binance.com/api/v3/ticker/24hr');
  const tickers: any[] = await tickerRes.json();
  
  const eligibleSymbols = tradingUniverse.filter(symbol => {
    const ticker = tickers.find((t: any) => t.symbol === symbol);
    return ticker && parseFloat(ticker.quoteVolume) >= minLiquidity;
  });

  console.log(`Momentum evaluated (after liquidity filter): ${eligibleSymbols.length}`);

  // Get Scores for Top 10
  const scores: { symbol: string; score: number }[] = [];
  for (const symbol of eligibleSymbols.slice(0, 50)) { // Speed up test
    try {
        const k15m = await fetchHistoricalKlinesForMomentum(symbol, '15m', 100);
        const k1h = await fetchHistoricalKlinesForMomentum(symbol, '1h', 50);
        const k4h = await fetchHistoricalKlinesForMomentum(symbol, '4h', 30);
        
        if (k15m.length >= 2 && k1h.length >= 2 && k4h.length >= 2) {
            const res = calculateMomentumScore(k15m, k1h, k4h);
            scores.push({ symbol, score: res.momentumScore });
        }
    } catch {}
  }

  scores.sort((a, b) => b.score - a.score);
  console.log('\n--- TOP 10 MOMENTUM CANDIDATES ---');
  scores.slice(0, 10).forEach((s, i) => console.log(`${i+1}. ${s.symbol}: ${s.score.toFixed(2)}`));

  console.log('\n--- EXCLUDED SYMBOLS SAMPLE (First 10) ---');
  excluded.slice(0, 10).forEach(e => console.log(`${e.symbol}: ${e.reason}`));

  console.log('\n--- VERIFICATION ---');
  console.log(`BTC/ETH/BNB in Trading Universe: ${tradingUniverse.includes('BTCUSDT') || tradingUniverse.includes('ETHUSDT') || tradingUniverse.includes('BNBUSDT') ? 'FAIL' : 'PASS'}`);
}

test().catch(console.error);
