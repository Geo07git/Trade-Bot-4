import { KlineSnapshot } from './types';
import { getActiveExchangeUniverse } from './MultiExchangeMarket';

export const MARKET_CONTEXT = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];

export async function getBinanceUniverse(): Promise<{
  marketContext: string[];
  tradingUniverse: string[];
  excluded: { symbol: string; reason: string }[];
}> {
  try {
    return await getActiveExchangeUniverse();
  } catch (err) {
    console.error('[Universe] Failed to fetch symbols via multi-exchange market:', err);
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
