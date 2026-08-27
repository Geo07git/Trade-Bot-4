import { KlineSnapshot } from './types';

// Standalone cache for backtest fetching to avoid API bans
const memCache = new Map<string, KlineSnapshot[]>();

export function clearCache() {
  memCache.clear();
}

export async function fetchHistoricalKlinesForMomentum(
  symbol: string,
  interval: '15m' | '1h' | '4h',
  limit: number = 1000
): Promise<KlineSnapshot[]> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const cacheKey = `${cleanSymbol}_${interval}_${limit}`;
  
  if (memCache.has(cacheKey)) {
    return memCache.get(cacheKey)!;
  }

  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Binance API error: ${res.statusText}`);
    }
    
    const data = await res.json();
    const parsed: KlineSnapshot[] = data.map((d: any) => ({
      openTime: parseInt(d[0]),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
      closeTime: parseInt(d[6]),
      quoteVolume: parseFloat(d[7]),
    }));

    // Ensure sorted by time
    parsed.sort((a, b) => a.closeTime - b.closeTime);
    memCache.set(cacheKey, parsed);
    return parsed;
  } catch (err) {
    console.error(`[DataFetcher] Failed to fetch klines for ${symbol} @ ${interval}:`, err);
    return [];
  }
}

/**
 * Creates a strictly synchronized snapshot ensuring NO look-ahead bias.
 * For a given anchor T (15m closeTime), it extracts only the candles that were FULLY CLOSED at or before T.
 */
export function buildSynchronizedSnapshot(
  tAnchorMs: number,
  klines15m: KlineSnapshot[],
  klines1h: KlineSnapshot[],
  klines4h: KlineSnapshot[]
) {
  // Only include candles whose closeTime <= tAnchorMs
  const valid15m = klines15m.filter(c => c.closeTime <= tAnchorMs);
  const valid1h = klines1h.filter(c => c.closeTime <= tAnchorMs);
  const valid4h = klines4h.filter(c => c.closeTime <= tAnchorMs);

  return {
    tAnchor: tAnchorMs,
    kline15m: valid15m,
    kline1h: valid1h,
    kline4h: valid4h
  };
}
