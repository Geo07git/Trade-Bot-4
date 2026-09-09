export interface BybitCredentials {
  apiKey?: string;
  apiSecret?: string;
  mode?: 'paper' | 'testnet' | 'live';
}

export function getBybitHttpBase(mode: 'paper' | 'testnet' | 'live'): string {
  if (mode === 'testnet') {
    return 'https://api-testnet.bybit.com';
  }
  return 'https://api.bybit.com';
}

export async function getBybitAccountInfo(options: BybitCredentials) {
  if (!options.apiKey || !options.apiSecret) {
    throw new Error('Cheile API Bybit sunt lipsă.');
  }
  const base = getBybitHttpBase(options.mode || 'testnet');
  return {
    success: true,
    exchange: 'bybit',
    mode: options.mode || 'testnet',
    endpoint: base,
    accountType: 'UNIFIED'
  };
}

export async function getBybitExchangeInfo(options: BybitCredentials) {
  const base = getBybitHttpBase(options.mode || 'testnet');
  try {
    const res = await fetch(`${base}/v5/market/instruments-info?category=spot`);
    const data = await res.json();
    return data;
  } catch (err: any) {
    throw new Error(`Eroare comunicare Bybit ExchangeInfo: ${err.message}`);
  }
}
