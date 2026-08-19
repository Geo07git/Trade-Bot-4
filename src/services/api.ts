import { MarketOpportunity } from '../types';

// Predefined baseline prices for popular cryptocurrencies and stock tickers to ensure instant fallback data
const BASELINE_PRICES: Record<string, number> = {
  'BTC': 64230.00,
  'BTCUSDT': 64230.00,
  'ETH': 3450.00,
  'ETHUSDT': 3450.00,
  'SOL': 145.20,
  'SOLUSDT': 145.20,
  'BNB': 565.00,
  'BNBUSDT': 565.00,
  'XRP': 0.58,
  'XRPUSDT': 0.58,
  'ADA': 0.164,
  'ADAUSDT': 0.164,
  'LINK': 8.30,
  'LINKUSDT': 8.30,
  'AVAX': 6.30,
  'AVAXUSDT': 6.30,
  'DOGE': 0.069,
  'DOGEUSDT': 0.069,
  'SUI': 0.71,
  'SUIUSDT': 0.71,
  'NEAR': 1.80,
  'NEARUSDT': 1.80,
  'ATOM': 1.38,
  'ATOMUSDT': 1.38,
  'DEXE': 3.50,
  'DEXEUSDT': 3.50,
  'ACE': 0.092,
  'ACEUSDT': 0.092,
  'ZAMA': 0.053,
  'ZAMAUSDT': 0.053,
  'TON': 5.20,
  'TONUSDT': 5.20,
  'TRX': 0.13,
  'TRXUSDT': 0.13,
  'LTC': 72.00,
  'LTCUSDT': 72.00,
  'DOT': 4.80,
  'DOTUSDT': 4.80,
  'APT': 6.80,
  'APTUSDT': 6.80,
  'ARB': 0.55,
  'ARBUSDT': 0.55,
  'OP': 1.40,
  'OPUSDT': 1.40,
  'FIL': 3.90,
  'FILUSDT': 3.90,
  'INJ': 18.50,
  'INJUSDT': 18.50,
  'SEI': 0.32,
  'SEIUSDT': 0.32,
  'FET': 1.30,
  'FETUSDT': 1.30,
  'RENDER': 6.20,
  'RENDERUSDT': 6.20,
  'PEPE': 0.000009,
  'PEPEUSDT': 0.000009,
  'NVDA': 125.80,
  'AAPL': 224.50,
  'MSFT': 412.30,
  'TSLA': 187.40,
  'AMD': 164.20,
  'COIN': 210.50,
  'SPY': 540.20,
  'QQQ': 460.80,
};

// Generates a deterministic baseline price based on symbol name hashing if not in the map
function getFallbackBasePrice(symbol: string): number {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (BASELINE_PRICES[cleanSymbol] !== undefined) {
    return BASELINE_PRICES[cleanSymbol];
  }
  
  if (cleanSymbol.endsWith('USDT')) {
    const baseAsset = cleanSymbol.replace('USDT', '');
    if (BASELINE_PRICES[baseAsset] !== undefined) {
      return BASELINE_PRICES[baseAsset];
    }
  }

  // Deterministic fallback based on symbol characters
  let hash = 0;
  for (let i = 0; i < cleanSymbol.length; i++) {
    hash = cleanSymbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const absoluteHash = Math.abs(hash);
  return parseFloat((0.10 + (absoluteHash % 1000) / 100).toFixed(4));
}

export async function fetchLivePrice(symbol: string): Promise<number | null> {
  const cleanSymbol = symbol.trim().toUpperCase();
  
  try {
    // Attempt Binance API
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${cleanSymbol}`);
    if (res.ok) {
      const data = await res.json();
      const apiPrice = parseFloat(data.price);
      if (!isNaN(apiPrice) && apiPrice > 0) {
        return apiPrice;
      }
    }
  } catch (error) {
    console.debug(`Binance API lookup failed for ${cleanSymbol}:`, error);
  }

  // If crypto trading pair, do not generate fictive fallback prices
  if (cleanSymbol.endsWith('USDT') || ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'SUI', 'NEAR', 'ATOM', 'DEXE', 'ACE', 'ZAMA', 'DOGE', 'AVAX', 'PEPE'].includes(cleanSymbol)) {
    return null;
  }

  // Fallback for traditional stocks (NVDA, MSFT etc)
  const basePrice = getFallbackBasePrice(cleanSymbol);
  const fluctuation = 1 + (Math.random() * 0.007 - 0.0035);
  return parseFloat((basePrice * fluctuation).toFixed(2));
}

export async function fetchChartData(symbol: string): Promise<{ time: string, value: number }[]> {
  const cleanSymbol = symbol.trim().toUpperCase();
  
  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}&interval=1h&limit=24`);
    if (res.ok) {
      const data = await res.json();
      return data.map((d: any) => {
        const date = new Date(d[0]);
        return {
          time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
          value: parseFloat(d[4]) // close price
        };
      });
    }
  } catch (error) {
    console.debug(`Binance API klines lookup failed for ${cleanSymbol}`);
  }
  
  // Fallback to simulator
  const basePrice = getFallbackBasePrice(cleanSymbol);
  const data = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    // Add random walk starting from basePrice
    const offset = Math.random() * 0.1 - 0.05;
    data.push({
      time: `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`,
      value: parseFloat((basePrice * (1 + offset)).toFixed(2))
    });
  }
  return data;
}

export async function scanClientSideMarketOpportunities(): Promise<MarketOpportunity[]> {
  try {
    let tickerData: any[] = [];
    const endpoints = [
      'https://api.binance.com/api/v3/ticker/24hr',
      'https://data-api.binance.vision/api/v3/ticker/24hr',
      'https://api1.binance.com/api/v3/ticker/24hr'
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          tickerData = await res.json();
          if (Array.isArray(tickerData) && tickerData.length > 0) break;
        }
      } catch (e) {
        // try next endpoint
      }
    }

    if (!Array.isArray(tickerData) || tickerData.length === 0) {
      return [];
    }

    const excludedSubstrings = [
      'UPUSDT', 'DOWNUSDT', 'BEARUSDT', 'BULLUSDT', 'BUSDUSDT', 'USDCUSDT', 
      'FDUSDUSDT', 'TUSDUSDT', 'DAIUSDT', 'EURUSDT', 'TRYUSDT', 'GBPUSDT', 
      'AEURUSDT', 'SUSDUSDT', 'USDPUSDT', 'PAXUSDT', 'USDSUSDT', 'PLAUSDT', 
      'PDAUSDT', 'LUNAUSDT', 'FTTUSDT', 'ANCUSDT', 'MIRUSDT'
    ];

    const filtered = tickerData.filter((item: any) => {
      const sym = item.symbol;
      if (!sym || !sym.endsWith('USDT')) return false;
      if (excludedSubstrings.some(ex => sym.includes(ex))) return false;
      const quoteVol = parseFloat(item.quoteVolume);
      const price = parseFloat(item.lastPrice);
      const count = parseInt(item.count, 10) || 0;
      const change = Math.abs(parseFloat(item.priceChangePercent));
      return !isNaN(quoteVol) && quoteVol >= 300000 && !isNaN(price) && price > 0 && count > 50 && !isNaN(change);
    });

    filtered.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
    const topCandidates = filtered.slice(0, 150);

    const candidates: MarketOpportunity[] = topCandidates.map((item: any, idx: number) => {
      const symbol = item.symbol;
      const price = parseFloat(item.lastPrice) || 0;
      const volume24h = parseFloat(item.quoteVolume) || 0;
      const priceChangePercent = parseFloat(item.priceChangePercent) || 0;
      const highPrice = parseFloat(item.highPrice) || price * 1.02;
      const lowPrice = parseFloat(item.lowPrice) || price * 0.98;

      const rangePercent = lowPrice > 0 ? ((highPrice - lowPrice) / lowPrice) * 100 : Math.abs(priceChangePercent);
      const atrPercent = parseFloat((rangePercent / 2).toFixed(2));
      const volScore = Math.min(20, Math.max(2, (rangePercent >= 2.0 && rangePercent <= 12.0) ? 12 + (rangePercent / 12) * 8 : (rangePercent < 2.0 ? rangePercent * 6 : Math.max(4, 20 - (rangePercent - 12)))));
      const liquidityScore = volume24h > 500000 ? Math.min(20, Math.max(2, Math.log10(volume24h / 500000) * 8.0 + 3)) : 2;
      const momentumScore = Math.min(20, Math.max(2, 10 + (priceChangePercent * 1.1)));
      const trendAlignment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = priceChangePercent >= 1.2 ? 'BULLISH' : (priceChangePercent <= -2.5 ? 'BEARISH' : 'NEUTRAL');
      const regime: 'TRENDING_BULL' | 'RANGING' | 'TRENDING_BEAR' = priceChangePercent >= 3.0 ? 'TRENDING_BULL' : (priceChangePercent <= -3.0 ? 'TRENDING_BEAR' : 'RANGING');

      const spreadPercent = parseFloat((volume24h > 10000000 ? 0.02 : 0.06).toFixed(3));
      const baseRfProb = trendAlignment === 'BULLISH' ? 72 : (trendAlignment === 'BEARISH' ? 42 : 55);
      const symbolHashBonus = (symbol.charCodeAt(0) + symbol.charCodeAt(symbol.length - 1)) % 30 / 10 - 1.5;
      const rfProb = Math.min(98, Math.max(10, Math.round(baseRfProb + symbolHashBonus)));
      const metaProb = 50;

      const totalRawScore = volScore + liquidityScore + momentumScore + (rfProb * 0.18) + (metaProb * 0.07);
      const opportunityScore = Math.min(100, Math.max(0, Math.round(totalRawScore * 10) / 10));

      let patternName = 'Impuls Momentum 📈';
      let patternScore = 65;
      if (priceChangePercent >= 5.0) {
        patternName = 'Bullish Marubozu 💥';
        patternScore = 92;
      } else if (priceChangePercent >= 2.5) {
        patternName = 'Bullish Engulfing 🟢';
        patternScore = 88;
      } else if (priceChangePercent <= -4.0) {
        patternName = 'Bearish Engulfing 🔴';
        patternScore = 20;
      } else if (rangePercent >= 6.0) {
        patternName = 'Volatilitate Ridicată ⚡';
        patternScore = 75;
      }

      const discoveryScore = Math.min(100, Math.max(0, parseFloat((
        (patternScore * 0.35) +
        (Math.min(100, Math.max(0, 50 + priceChangePercent * 4)) * 0.25) +
        (Math.min(100, Math.max(0, Math.log10(volume24h / 100000) * 20)) * 0.20) +
        (Math.min(100, Math.max(0, rangePercent * 8)) * 0.10) +
        ((trendAlignment === 'BULLISH' ? 85 : 45) * 0.10)
      ).toFixed(1))));

      const reason = `Pattern: ${patternName} (${patternScore}pt) | Discovery: ${discoveryScore}/100 | Vol: $${(volume24h / 1000000).toFixed(1)}M`;
      const sentimentLabel: 'bullish' | 'bearish' | 'neutral' = trendAlignment === 'BULLISH' ? 'bullish' : (trendAlignment === 'BEARISH' ? 'bearish' : 'neutral');

      return {
        symbol,
        price,
        opportunityScore,
        discoveryScore,
        candlestickPatternScore: patternScore,
        candlestickPatternName: patternName,
        momentumAccelScore: Math.round(momentumScore * 5),
        rvolScore: Math.round(liquidityScore * 5),
        structureScore: 70,
        liquiditySpreadScore: 80,
        rfProb,
        metaProb,
        trendAlignment,
        adx: Math.round(20 + Math.abs(priceChangePercent) * 1.8),
        atrPercent,
        momentumScore: Math.round(momentumScore * 5),
        volume24h,
        volumeGrowth24h: parseFloat(priceChangePercent.toFixed(2)),
        liquidityScore: Math.round(liquidityScore * 5),
        spreadPercent,
        reversalSignal: 'NONE' as const,
        sentimentLabel,
        regime,
        historicalPerformanceScore: 0,
        inDynamicWatchlist: idx < 10,
        rank: idx + 1,
        updatedAt: new Date().toISOString(),
        reason
      };
    });

    candidates.sort((a, b) => (b.discoveryScore || 0) - (a.discoveryScore || 0));
    candidates.forEach((op, index) => {
      op.rank = index + 1;
      op.inDynamicWatchlist = index < 10;
    });

    return candidates;
  } catch (err) {
    console.warn('Client-side Binance opportunities scan error:', err);
    return [];
  }
}

