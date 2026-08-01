import Binance from 'binance-api-node';

export interface BinanceCredentials {
  apiKey?: string;
  apiSecret?: string;
  mode?: 'paper' | 'testnet' | 'live';
}

export function createBinanceClient(options: BinanceCredentials) {
  const binanceFactory = typeof Binance === 'function' 
    ? Binance 
    : (Binance as any)?.default;

  if (typeof binanceFactory !== 'function') {
    throw new Error('Librăria binance-api-node nu a putut fi instanțiată.');
  }

  const isTestnet = options.mode === 'testnet';
  const httpBase = isTestnet ? 'https://testnet.binance.vision' : 'https://api.binance.com';

  return binanceFactory({
    apiKey: options.apiKey,
    apiSecret: options.apiSecret,
    httpBase
  });
}

export async function getAccountInfo(options: BinanceCredentials) {
  if (!options.apiKey || !options.apiSecret) {
    throw new Error('Cheile API Binance sunt lipsă.');
  }
  const client = createBinanceClient(options);
  return await client.accountInfo();
}

export async function getMyTrades(symbol: string, options: BinanceCredentials) {
  if (!options.apiKey || !options.apiSecret) {
    throw new Error('Cheile API Binance sunt lipsă.');
  }
  const client = createBinanceClient(options);
  return await client.myTrades({ symbol });
}

export async function getOpenOrders(options: BinanceCredentials, symbol?: string) {
  if (!options.apiKey || !options.apiSecret) {
    throw new Error('Cheile API Binance sunt lipsă.');
  }
  const client = createBinanceClient(options);
  return await client.openOrders(symbol ? { symbol } : undefined);
}

export async function getExchangeInfo(options: BinanceCredentials) {
  const client = createBinanceClient(options);
  return await client.exchangeInfo();
}
