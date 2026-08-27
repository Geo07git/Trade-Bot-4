import { KlineSnapshot } from './types';

const EPSILON = 1e-8;

export function calculateMomentumScore(
  kline15m: KlineSnapshot[],
  kline1h: KlineSnapshot[],
  kline4h: KlineSnapshot[]
) {
  // Helpers
  const last15 = kline15m[kline15m.length - 1];
  const last1h = kline1h[kline1h.length - 1];
  const last4h = kline4h[kline4h.length - 1];

  // 1. Momentum 15m, 1h & 4h (Rate of Change)
  const mom15 = ((last15.close / kline15m[kline15m.length - 2].close) - 1) * 100;
  const mom1h = (last1h.close / kline1h[kline1h.length - 2].close - 1) * 100;
  const mom4h = (last4h.close / kline4h[kline4h.length - 2].close - 1) * 100;

  // 2. RVOL (Relative Volume 1h)
  const vol1h = kline1h.slice(-21, -1); // 20 periods
  const avgVol1h = vol1h.reduce((a, b) => a + b.quoteVolume, 0) / 20;
  const rvol = last1h.quoteVolume / (avgVol1h + EPSILON);

  // 3. Volume Acceleration (RVOL Vector: 3 periods)
  const getRvol = (k: KlineSnapshot[]) => k[k.length - 1].quoteVolume / (k.slice(-21, -1).reduce((a, b) => a + b.quoteVolume, 0) / 20 + EPSILON);
  const rvol0 = getRvol(kline1h);
  const rvol1 = getRvol(kline1h.slice(0, -1));
  const rvol2 = getRvol(kline1h.slice(0, -2));
  
  let volAccel = 0; // Numeric acceleration
  if (rvol1 > 0 && rvol2 > 0) {
    volAccel = (rvol0 - rvol1) / rvol1;
  }

  // 4. Breakout Strength (15m, High of T-1 to T-20)
  const resistance = Math.max(...kline15m.slice(-21, -1).map(k => k.high));
  const atr15 = kline15m.slice(-15).reduce((a, b) => a + (b.high - b.low), 0) / 15;
  const breakoutStrength = (last15.close - resistance) / (atr15 + EPSILON);

  // 5. ATR Expansion (15m)
  const currentAtr15 = last15.high - last15.low;
  const avgAtr15 = kline15m.slice(-15, -1).reduce((a, b) => a + (b.high - b.low), 0) / 14;
  const atrExpansion = currentAtr15 / (avgAtr15 + EPSILON);

  // 6. Pullback Quality (15m, 10 periods)
  const range10 = kline15m.slice(-10);
  const high10 = Math.max(...range10.map(k => k.high));
  const low10 = Math.min(...range10.map(k => k.low));
  const pullbackQuality = (last15.close - low10) / (high10 - low10 + EPSILON);

  return {
    momentumScore: (mom1h * 1.5) + (mom4h * 1.0) + (Math.min(rvol, 10) * 2.0) + (atrExpansion * 5),
    momentum_15m: mom15,
    momentum_1h: mom1h,
    momentum_4h: mom4h,
    rvol_current: rvol,
    volumeAcceleration: volAccel,
    breakoutStrength,
    atrExpansion,
    pullbackQuality,
    distanceFromHighPct: 0, // placeholder
    relativeStrengthBTC: 0 // placeholder
  };
}
