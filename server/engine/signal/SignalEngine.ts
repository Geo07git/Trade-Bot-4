import { runRealStrategyAnalysis } from '../../../src/services/ml';
import { logger } from '../../../src/utils/logger';
import { calculateMetaTradeScore } from '../../bot';

export interface Signal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  strategy: string;
  regime: string;
  timestamp: number;
  explanation?: string;
  metaScore: number;
  metaBreakdown?: any;
  mlRes?: any;
}

// Keeping cache here for separation
const realStrategyCache = new Map<string, { res: any; timestamp: number }>();
const serverSignalCache = new Map<string, { result: any; timestamp: number }>();

export class SignalEngine {
  public async getCachedRealStrategyAnalysis(symbol: string, mlModelType: 'rf' = 'rf'): Promise<any> {
    const cleanSymbol = symbol.trim().toUpperCase();
    const cacheKey = `${cleanSymbol}_${mlModelType}`;
    const cached = realStrategyCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < 60000)) {
      return cached.res;
    }

    // Async trigger lightweight ML strategy
    runRealStrategyAnalysis(cleanSymbol, 'rf', { fastMode: true })
      .then(res => {
        if (res) {
          realStrategyCache.set(cacheKey, { res, timestamp: Date.now() });
        }
      })
      .catch(err => {
        logger.warn(`[ML Real Strategy Background Warning for ${cleanSymbol}]: ${err?.message || err}`);
      });

    return cached ? cached.res : null;
  }

  public async generateSignalServer(symbol: string, currentPrice: number): Promise<{ action: 'BUY' | 'SELL' | 'HOLD'; prob: number; modelName: string; reason: string }> {
    const cleanSymbol = symbol.trim().toUpperCase();
    const cacheKey = `${cleanSymbol}_rf`;
    const cached = serverSignalCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < 30000)) {
      return cached.result;
    }

    try {
      const mlRes = await this.getCachedRealStrategyAnalysis(cleanSymbol);
      if (mlRes && mlRes.signal) {
        const result = {
          action: mlRes.signal as 'BUY' | 'SELL' | 'HOLD',
          prob: mlRes.probability,
          modelName: 'Random Forest Ensemble (1m)',
          reason: mlRes.explanation?.find((e: string) => e.includes('Semnal') || e.includes('Reversal')) || `Scor Composite AI: ${mlRes.probability}% (${mlRes.signal})`
        };
        serverSignalCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }
    } catch (err: any) {
      logger.warn(`[ML Signal Server Warning] Could not run ML analysis for ${cleanSymbol}, using technical fallback: ${err?.message || err}`);
    }

    try {
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}&interval=1m&limit=150`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length >= 30) {
          const closes = data.map((d: any) => parseFloat(d[4]));
          let gains = 0, losses = 0;
          for (let i = 1; i <= 14; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff >= 0) gains += diff;
            else losses -= diff;
          }
          let avgGain = gains / 14;
          let avgLoss = losses / 14;

          for (let i = 15; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            const gain = diff > 0 ? diff : 0;
            const loss = diff < 0 ? -diff : 0;
            avgGain = (avgGain * 13 + gain) / 14;
            avgLoss = (avgLoss * 13 + loss) / 14;
          }

          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
          const lastClose = closes[closes.length - 1];
          const prevClose = closes[closes.length - 2];
          const mom = ((lastClose - prevClose) / prevClose) * 100;

          let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
          let prob = 52;
          
          if (rsi < 48 || (rsi < 55 && mom > 0.05)) {
            action = 'BUY';
            prob = Math.min(92, Math.max(55, Math.round(58 + (50 - rsi) * 1.1 + Math.max(0, mom * 5))));
          } else if (rsi > 65) {
            action = 'SELL';
            prob = Math.min(90, Math.max(58, Math.round(60 + (rsi - 65) * 1.2)));
          }

          const fallbackRes = { action, prob, modelName: 'Technical Fallback (RSI+Mom)', reason: `RSI (${rsi.toFixed(1)}) | Mom (${mom.toFixed(2)}%)` };
          serverSignalCache.set(cleanSymbol, { result: fallbackRes, timestamp: Date.now() });
          return fallbackRes;
        }
      }
    } catch (err) {
      // Fallback
    }

    return { 
      action: 'HOLD', 
      prob: 52, 
      modelName: 'Random Forest Ensemble', 
      reason: `Consolidare Piață (${cleanSymbol})` 
    };
  }

  public async evaluateSymbol(symbol: string, currentPrice: number, oppInfo?: any, symStat?: any): Promise<Signal> {
    const mlRes = await this.getCachedRealStrategyAnalysis(symbol);
    const signal = await this.generateSignalServer(symbol, currentPrice);
    const oppScore = oppInfo?.opportunityScore || 50;

    let effectiveAction: 'BUY' | 'SELL' | 'HOLD' = signal.action;
    let effectiveProb = signal.prob;

    if (mlRes) {
      effectiveAction = mlRes.signal;
      effectiveProb = Math.min(98, Math.max(5, Math.round(mlRes.probability || 50)));
    }

    const atrPct = mlRes?.marketRegime?.atrPercent ?? oppInfo?.atrPercent ?? 0.10;
    const volRatio = mlRes?.lastVolRatio ?? (oppInfo?.volumeGrowth24h !== undefined ? (1 + oppInfo.volumeGrowth24h / 100) : 1.0);
    const regime = mlRes?.marketRegime?.currentRegime || oppInfo?.regime || 'UNKNOWN';

    const metaBreakdown = calculateMetaTradeScore({
      symbol,
      opportunityScore: oppScore,
      aiProbability: effectiveProb,
      rangeProbability: oppInfo?.rfProb || (oppInfo?.regime === 'RANGING' ? 82 : 55),
      trendAlignment: oppInfo?.trendAlignment || (effectiveProb >= 60 ? 'BULLISH' : 'NEUTRAL'),
      volumeRatio: volRatio,
      priceChangePercent: oppInfo?.volumeGrowth24h || 0,
      symbolStat: symStat,
      regime: oppInfo?.regime,
      atrPercent: atrPct,
      adxValue: mlRes?.indicators?.adx ?? oppInfo?.adx ?? 25,
      reversalScore: mlRes?.reversalSignal?.score ?? 50,
      newsSentimentLabel: mlRes?.newsSentiment?.sentimentLabel
    });

    return {
      symbol,
      action: effectiveAction,
      confidence: effectiveProb,
      strategy: 'SCALPING',
      regime,
      timestamp: Date.now(),
      explanation: signal.reason,
      metaScore: metaBreakdown.finalTradeScore,
      metaBreakdown,
      mlRes
    };
  }
}

export const signalEngine = new SignalEngine();
