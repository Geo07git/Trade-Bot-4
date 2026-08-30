import { Signal } from '../signal/SignalEngine';
import { ScalpingConfig } from '../../../src/types';
import { getSymbolCooldown } from '../../../src/services/ml';
import { logger } from '../../../src/utils/logger';

export type RiskDecision = 'ALLOW' | 'REDUCE_SIZE' | 'BLOCK' | 'EMERGENCY_CLOSE';

export interface RiskRequest {
  symbol: string;
  signal: Signal;
  scalpConfig: ScalpingConfig;
  currentBalanceUSDT: number;
  hasOpenPosition: boolean;
  globalAutoTradingActive: boolean;
  oppInfo?: any;
}

export interface RiskResult {
  decision: RiskDecision;
  reason: string;
  vetoType?: string;
}

export class RiskEngine {
  
  public evaluateOrder(req: RiskRequest): RiskResult {
    const { symbol, signal, scalpConfig, currentBalanceUSDT, hasOpenPosition, globalAutoTradingActive, oppInfo } = req;
    
    // 1. Auto-Trading Check
    if (!globalAutoTradingActive) {
      return { decision: 'BLOCK', reason: `Auto-Trading OPRIT (MetaScore ${signal.metaScore}/100)`, vetoType: 'SYSTEM' };
    }

    // 2. Active Config Check
    if (!scalpConfig.active) {
      return { decision: 'BLOCK', reason: 'Motor Scalping Dezactivat din Setări', vetoType: 'CONFIG' };
    }

    // 3. Existing Position Check
    if (hasOpenPosition) {
      return { decision: 'BLOCK', reason: `Poziție Activă În Curs (${symbol})`, vetoType: 'POSITION' };
    }

    // 4. Probability Check
    const minRfProb = scalpConfig.minRfProb ?? 70;
    if (signal.confidence < minRfProb) {
      return { decision: 'BLOCK', reason: `RF Prob ${signal.confidence}% < minim ${minRfProb}%`, vetoType: 'PROBABILITY' };
    }

    // 5. Anti-Whipsaw Cooldown Check
    const cooldown = getSymbolCooldown(symbol);
    if (cooldown && cooldown.active) {
      return { decision: 'BLOCK', reason: `Cooldown Activ (${cooldown.remainingMinutes}m rămase)`, vetoType: 'COOLDOWN' };
    }

    // 6. Stagnation / Volatility Protection Check
    const atrPct = signal.mlRes?.marketRegime?.atrPercent ?? oppInfo?.atrPercent ?? 0.10;
    const range20pPct = signal.mlRes?.marketRegime?.range20pPct ?? 0;
    const isStagnationEnabled = scalpConfig.enableStagnationFilter !== false;
    const minAtr = scalpConfig.minAtrPctThreshold ?? 0.05;
    const minRange = scalpConfig.minRange20pThreshold ?? 0.20;

    if (isStagnationEnabled) {
      const vetoReasons: string[] = [];
      if (atrPct < minAtr) vetoReasons.push(`ATR ${atrPct.toFixed(2)}% < ${minAtr}%`);
      if (range20pPct > 0 && range20pPct < minRange) vetoReasons.push(`Range20 ${range20pPct.toFixed(2)}% < ${minRange}%`);
      if (vetoReasons.length > 0) {
        return { decision: 'BLOCK', reason: `Regim Stagnare: ${vetoReasons.join(' și ')}`, vetoType: 'STAGNATION' };
      }
    }

    // 7. MetaScore Check
    const minMetaScore = scalpConfig.minMetaScore ?? 70;
    if (signal.metaScore < minMetaScore) {
      return { decision: 'BLOCK', reason: `MetaScore ${signal.metaScore}/100 < minim ${minMetaScore}`, vetoType: 'METASCORE' };
    }

    // 8. Balance Check
    if (currentBalanceUSDT < 0.5) {
      return { decision: 'BLOCK', reason: `Balanță USDT Insuficientă (${currentBalanceUSDT.toFixed(2)})`, vetoType: 'BALANCE' };
    }

    return {
      decision: 'ALLOW',
      reason: 'Semnal Aprobat'
    };
  }

  public evaluateSystemHealth(): 'HEALTHY' | 'RISK_LOCK' {
    return 'HEALTHY';
  }
}

export const riskEngine = new RiskEngine();
