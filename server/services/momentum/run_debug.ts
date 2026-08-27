import { fetchHistoricalKlinesForMomentum, buildSynchronizedSnapshot } from './DataFetcher';
import { calculateMomentumScore } from './Scorer';

async function debugPromusdt() {
  console.log("=== DEBUG PROMUSDT START ===");
  const symbol = "PROMUSDT";

  try {
    // 1. Check 24h ticker / liquidity
    const tickerRes = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=PROMUSDT');
    const ticker: any = await tickerRes.json();
    
    const quoteVolume24h = parseFloat(ticker.quoteVolume || '0');
    const minLiquidityRequired = 10000000; // 10M USDT baseline config
    const isExcluded = ['UPUSDT', 'DOWNUSDT', 'BULLUSDT', 'BEARUSDT'].some(e => symbol.includes(e));
    
    let passedLiquidity = false;
    let excludedReason = "NONE";

    if (isExcluded) {
      excludedReason = "Leveraged token pattern";
    } else if (quoteVolume24h < minLiquidityRequired) {
      excludedReason = `Volume $${quoteVolume24h.toLocaleString()} is below threshold $${minLiquidityRequired.toLocaleString()}`;
    } else {
      passedLiquidity = true;
    }

    console.log(`Symbol: ${symbol}`);
    console.log(`24h Volume (USDT): $${quoteVolume24h.toLocaleString()}`);
    console.log(`Passed Liquidity: ${passedLiquidity ? 'YES' : 'NO'}`);
    console.log(`Excluded Reason: ${excludedReason}`);
    console.log(`Universe Check: ${passedLiquidity ? 'PASS' : 'FAIL'} → Reason: ${excludedReason}`);

    // 2. Fetch klines
    const k15m = await fetchHistoricalKlinesForMomentum(symbol, '15m', 100);
    const k1h = await fetchHistoricalKlinesForMomentum(symbol, '1h', 50);
    const k4h = await fetchHistoricalKlinesForMomentum(symbol, '4h', 30);

    console.log(`15m candles available: ${k15m.length}`);
    console.log(`1h candles available: ${k1h.length}`);
    console.log(`4h candles available: ${k4h.length}`);

    if (k15m.length > 0 && k1h.length > 0 && k4h.length > 0) {
      const now = Date.now();
      const snap = buildSynchronizedSnapshot(now, k15m, k1h, k4h);
      const result = calculateMomentumScore(snap.kline15m, snap.kline1h, snap.kline4h);
      console.log(`--- SCORE BREAKDOWN ---`);
      console.log(`Momentum 15m: ${result.momentum_15m.toFixed(2)}`);
      console.log(`Momentum 1h: ${result.momentum_1h.toFixed(2)}`);
      console.log(`Momentum 4h: ${result.momentum_4h.toFixed(2)}`);
      console.log(`RVOL 1h: ${result.rvol_current.toFixed(2)}`);
      console.log(`Vol Acceleration: ${result.volumeAcceleration.toFixed(2)}`);
      console.log(`ATR Expansion: ${result.atrExpansion.toFixed(2)}`);
      console.log(`Breakout Strength: ${result.breakoutStrength.toFixed(2)}`);
      console.log(`Pullback Quality: ${result.pullbackQuality.toFixed(2)}`);
      console.log(`Distance From High: ${result.distanceFromHighPct.toFixed(2)}`);
      console.log(`BTC Rel Strength: ${result.relativeStrengthBTC.toFixed(2)}`);
      console.log(`Final Score: ${result.momentumScore.toFixed(2)}`);
    } else {
      console.log("Momentum Score: N/A (Insufficient klines)");
    }

  } catch (err: any) {
    console.error("Error debugging PROMUSDT:", err.message);
  }

  console.log("=== DEBUG PROMUSDT END ===");
}

debugPromusdt();
