export interface OkxCredentials {
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
  mode?: 'paper' | 'testnet' | 'live';
}

export function getOkxHttpBase(mode: 'paper' | 'testnet' | 'live'): string {
  // OKX uses same base URL, demo trading is enabled via header x-simulated-trading: 1
  return 'https://www.okx.com';
}

export async function getOkxAccountInfo(options: OkxCredentials) {
  if (!options.apiKey || !options.apiSecret || !options.passphrase) {
    throw new Error('Cheile API sau Passphrase OKX sunt lipsă.');
  }
  return {
    success: true,
    exchange: 'okx',
    mode: options.mode || 'testnet',
    endpoint: getOkxHttpBase(options.mode || 'testnet')
  };
}

export async function getOkxExchangeInfo(options: OkxCredentials) {
  try {
    const res = await fetch('https://www.okx.com/api/v5/public/instruments?instType=SPOT');
    const data = await res.json();
    return data;
  } catch (err: any) {
    throw new Error(`Eroare comunicare OKX Instruments: ${err.message}`);
  }
}
