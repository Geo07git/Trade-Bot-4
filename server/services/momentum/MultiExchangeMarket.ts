import { KlineSnapshot } from './types';
import fs from 'fs';
import path from 'path';

export interface ExchangeConfig {
  exchangeProvider: 'binance' | 'bybit' | 'okx';
  binanceMode?: 'paper' | 'testnet' | 'live';
}

function getStoredExchangeProvider(): 'binance' | 'bybit' | 'okx' {
  try {
    const stateFile = path.join(process.cwd(), 'server', 'data', 'bot_state.json');
    if (fs.existsSync(stateFile)) {
      const raw = fs.readFileSync(stateFile, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.exchangeProvider) {
        return parsed.exchangeProvider;
      }
    }
  } catch (e) {
    // ignore
  }
  return 'binance';
}

export async function getActiveExchangeUniverse(): Promise<{
  marketContext: string[];
  tradingUniverse: string[];
  excluded: { symbol: string; reason: string }[];
}> {
  const provider = getStoredExchangeProvider();
  const MARKET_CONTEXT = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];

  if (provider === 'bybit') {
    try {
      const res = await fetch('https://api.bybit.com/v5/market/instruments-info?category=spot');
      const data = await res.json();
      const list = data?.result?.list || [];
      const tradingUniverse: string[] = [];
      const excluded: { symbol: string; reason: string }[] = [];

      for (const item of list) {
        const symbol = item.symbol;
        if (!symbol) continue;
        if (item.status !== 'Trading') {
          excluded.push({ symbol, reason: 'Not Trading on Bybit' });
          continue;
        }
        if (!symbol.endsWith('USDT')) {
          excluded.push({ symbol, reason: 'Non-USDT pair' });
          continue;
        }
        if (['BTCUSDT', 'ETHUSDT'].includes(symbol)) {
          excluded.push({ symbol, reason: 'Market Context Asset' });
          continue;
        }
        tradingUniverse.push(symbol);
      }
      return { marketContext: ['BTCUSDT', 'ETHUSDT'], tradingUniverse, excluded };
    } catch (err) {
      console.error('[MultiExchangeMarket] Bybit exchangeInfo failed, falling back to Binance:', err);
    }
  }

  if (provider === 'okx') {
    try {
      const res = await fetch('https://www.okx.com/api/v5/public/instruments?instType=SPOT');
      const data = await res.json();
      const list = data?.data || [];
      const tradingUniverse: string[] = [];
      const excluded: { symbol: string; reason: string }[] = [];

      for (const item of list) {
        const instId = item.instId; // ex: BTC-USDT
        if (!instId) continue;
        if (item.state !== 'live') {
          excluded.push({ symbol: instId, reason: 'Not live on OKX' });
          continue;
        }
        if (!instId.endsWith('-USDT')) {
          excluded.push({ symbol: instId, reason: 'Non-USDT pair' });
          continue;
        }
        const symbol = instId.replace('-', '');
        if (['BTCUSDT', 'ETHUSDT'].includes(symbol)) {
          excluded.push({ symbol, reason: 'Market Context Asset' });
          continue;
        }
        tradingUniverse.push(symbol);
      }
      return { marketContext: ['BTCUSDT', 'ETHUSDT'], tradingUniverse, excluded };
    } catch (err) {
      console.error('[MultiExchangeMarket] OKX instruments failed, falling back to Binance:', err);
    }
  }

  // Default Binance fallback
  try {
    const res = await fetch('https://api.binance.com/api/v3/exchangeInfo');
    const data = await res.json();
    const symbols = data?.symbols || [];
    const tradingUniverse: string[] = [];
    const excluded: { symbol: string; reason: string }[] = [];

    for (const s of symbols) {
      const symbol = s.symbol;
      if (s.status !== 'TRADING') {
        excluded.push({ symbol, reason: 'Not Trading' });
        continue;
      }
      if (!symbol.endsWith('USDT')) {
        excluded.push({ symbol, reason: 'Non-USDT pair' });
        continue;
      }
      if (MARKET_CONTEXT.includes(symbol)) {
        excluded.push({ symbol, reason: 'Market Context Asset' });
        continue;
      }
      tradingUniverse.push(symbol);
    }
    return { marketContext: MARKET_CONTEXT, tradingUniverse, excluded };
  } catch (err) {
    return { marketContext: MARKET_CONTEXT, tradingUniverse: [], excluded: [] };
  }
}

export async function fetchActiveTickers(): Promise<{ symbol: string; price: number; quoteVolume: number }[]> {
  const provider = getStoredExchangeProvider();

  if (provider === 'bybit') {
    try {
      const res = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
      const data = await res.json();
      const list = data?.result?.list || [];
      return list.map((t: any) => ({
        symbol: t.symbol,
        price: parseFloat(t.lastPrice || '0'),
        quoteVolume: parseFloat(t.turnover24h || '0')
      })).filter((t: any) => t.symbol && t.price > 0);
    } catch (err) {
      console.error('[MultiExchangeMarket] Bybit tickers failed, falling back to Binance:', err);
    }
  }

  if (provider === 'okx') {
    try {
      const res = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT');
      const data = await res.json();
      const list = data?.data || [];
      return list.map((t: any) => ({
        symbol: (t.instId || '').replace('-', ''),
        price: parseFloat(t.last || '0'),
        quoteVolume: parseFloat(t.volCcy24h || '0')
      })).filter((t: any) => t.symbol && t.price > 0);
    } catch (err) {
      console.error('[MultiExchangeMarket] OKX tickers failed, falling back to Binance:', err);
    }
  }

  // Binance Ticker 24hr fallback
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const tickers = await res.json();
    if (!Array.isArray(tickers)) return [];
    return tickers.map((t: any) => ({
      symbol: t.symbol,
      price: parseFloat(t.lastPrice || t.price || '0'),
      quoteVolume: parseFloat(t.quoteVolume || '0')
    })).filter((t: any) => t.symbol && t.price > 0);
  } catch (e) {
    return [];
  }
}

export async function fetchActiveKlines(symbol: string, interval: '15m' | '1h' | '4h', limit: number = 150): Promise<KlineSnapshot[]> {
  const provider = getStoredExchangeProvider();
  const cleanSymbol = symbol.trim().toUpperCase();

  if (provider === 'bybit') {
    // Bybit intervals: 15m -> '15', 1h -> '60', 4h -> '240'
    const intervalMap: Record<string, string> = { '15m': '15', '1h': '60', '4h': '240' };
    const bybitInt = intervalMap[interval] || '15';
    try {
      const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${cleanSymbol}&interval=${bybitInt}&limit=${limit}`;
      const res = await fetch(url);
      const data = await res.json();
      const list = data?.result?.list || [];
      // Bybit returns newest first [start, open, high, low, close, volume, turnover]
      const parsed: KlineSnapshot[] = list.map((d: any) => ({
        openTime: parseInt(d[0]),
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
        closeTime: parseInt(d[0]) + (interval === '15m' ? 900000 : interval === '1h' ? 3600000 : 14400000),
        quoteVolume: parseFloat(d[6] || d[5])
      }));
      parsed.sort((a, b) => a.closeTime - b.closeTime);
      return parsed;
    } catch (err) {
      console.error('[MultiExchangeMarket] Bybit klines failed, falling back to Binance:', err);
    }
  }

  if (provider === 'okx') {
    // OKX bars: 15m -> '15m', 1h -> '1H', 4h -> '4H'
    const okxIntervalMap: Record<string, string> = { '15m': '15m', '1h': '1H', '4h': '4H' };
    const okxBar = okxIntervalMap[interval] || '15m';
    const okxSymbol = cleanSymbol.endsWith('USDT') ? cleanSymbol.replace('USDT', '-USDT') : cleanSymbol;
    try {
      const url = `https://www.okx.com/api/v5/market/candles?instId=${okxSymbol}&bar=${okxBar}&limit=${limit}`;
      const res = await fetch(url);
      const data = await res.json();
      const list = data?.data || [];
      // OKX returns [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
      const parsed: KlineSnapshot[] = list.map((d: any) => ({
        openTime: parseInt(d[0]),
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
        closeTime: parseInt(d[0]) + (interval === '15m' ? 900000 : interval === '1h' ? 3600000 : 14400000),
        quoteVolume: parseFloat(d[6] || d[5])
      }));
      parsed.sort((a, b) => a.closeTime - b.closeTime);
      return parsed;
    } catch (err) {
      console.error('[MultiExchangeMarket] OKX klines failed, falling back to Binance:', err);
    }
  }

  // Binance fallback
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((d: any) => ({
      openTime: parseInt(d[0]),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
      closeTime: parseInt(d[6]),
      quoteVolume: parseFloat(d[7]),
    }));
  } catch (e) {
    return [];
  }
}
