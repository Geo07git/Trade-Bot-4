import { KlineSnapshot } from './types';

// Standalone cache for backtest fetching to avoid API bans
const memCache = new Map<string, KlineSnapshot[]>();

export function clearCache() {
  memCache.clear();
}

export async function fetchHistoricalKlinesForMomentum(
  symbol: string,
  interval: '15m' | '1h' | '4h',
  startTime?: number,
  endTime?: number
): Promise<KlineSnapshot[]> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const cacheKey = `${cleanSymbol}_${interval}_${startTime || 0}_${endTime || 0}`;
  
  if (memCache.has(cacheKey)) {
    return memCache.get(cacheKey)!;
  }
  
  try {
    let allKlines: KlineSnapshot[] = [];
    let currentStart = startTime;
    const limit = 1000;
    
    // Daca nu primim interval, functionam ca inainte, tragem ultimele 1000
    if (!startTime || !endTime) {
      const url = `https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}&interval=${interval}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Binance API error: ${res.statusText}`);
      
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
      parsed.sort((a, b) => a.closeTime - b.closeTime);
      memCache.set(cacheKey, parsed);
      return parsed;
    }
    
    // Paginated fetch pentru range-uri lungi (ex. backtest 12 luni)
    while (true) {
      let url = `https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}&interval=${interval}&limit=${limit}`;
      if (currentStart) url += `&startTime=${currentStart}`;
      url += `&endTime=${endTime}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Binance API error: ${res.statusText}`);
      
      const data = await res.json();
      if (data.length === 0) break;
      
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
      
      allKlines = allKlines.concat(parsed);
      
      // Am primit mai putin decat limita, e gata
      if (parsed.length < limit) break;
      
      currentStart = parsed[parsed.length - 1].closeTime + 1;
      
      if (currentStart > endTime) break;
      
      // Rate limiting rudimentar pentru a nu fi banati de Binance (aprox 70ms)
      await new Promise(r => setTimeout(r, 70));
    }
    
    // Sort si deduplicare pentru siguranta
    const uniqueMap = new Map<number, KlineSnapshot>();
    for (const k of allKlines) {
       uniqueMap.set(k.openTime, k);
    }
    allKlines = Array.from(uniqueMap.values()).sort((a, b) => a.closeTime - b.closeTime);
    
    memCache.set(cacheKey, allKlines);
    return allKlines;
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
