import { KlineSnapshot } from './types';

export const MARKET_CONTEXT = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];

export async function getBinanceUniverse(): Promise<{
  marketContext: string[];
  tradingUniverse: string[];
  excluded: { symbol: string; reason: string }[];
}> {
  try {
    const res = await fetch('https://api.binance.com/api/v3/exchangeInfo');
    const data = await res.json();
    
    const excluded: { symbol: string; reason: string }[] = [];
    const tradingUniverse: string[] = [];

    data.symbols.forEach((s: any) => {
      const symbol = s.symbol;

      if (s.status !== 'TRADING') {
        excluded.push({ symbol, reason: 'Not Trading' });
        return;
      }
      if (!symbol.endsWith('USDT')) {
        excluded.push({ symbol, reason: 'Non-USDT pair' });
        return;
      }
      if (MARKET_CONTEXT.includes(symbol)) {
        excluded.push({ symbol, reason: 'Market Context Asset' });
        return;
      }
      
      // Exclude stablecoins and other patterns
      const forbiddenPatterns = ['USDC', 'FDUSD', 'USD1', 'RLUSD', 'EUR', 'PAXG', 'XAUT', 'UP', 'DOWN', 'BULL', 'BEAR'];
      if (forbiddenPatterns.some(p => symbol.includes(p))) {
        excluded.push({ symbol, reason: 'Stablecoin/Commodity/Leveraged/Fiat' });
        return;
      }

      tradingUniverse.push(symbol);
    });

    return {
      marketContext: MARKET_CONTEXT,
      tradingUniverse,
      excluded
    };
  } catch (err) {
    console.error('[Universe] Failed to fetch symbols:', err);
    return { marketContext: MARKET_CONTEXT, tradingUniverse: [], excluded: [] };
  }
}

// Filtru lichiditate la momentul T
export function filterCandidatesByLiquidity(
  snapshots: { symbol: string; quoteVolume: number }[],
  minLiquidity: number
): string[] {
  return snapshots
    .filter(s => s.quoteVolume >= minLiquidity)
    .map(s => s.symbol);
}
