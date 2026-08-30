import { ExchangeAdapter } from '../adapters/ExchangeAdapter';
import { StateMachine, EngineState } from '../State';
import { db } from '../database/Database';
import { logger } from '../../../src/utils/logger';

export interface ReconciliationStatus {
  lastReconciledAt: number | null;
  isDesync: boolean;
  desyncReason: string | null;
  localBalance: number;
  exchangeBalance: number;
  balanceDriftUSDT: number;
  localPositionsCount: number;
  exchangePositionsCount: number;
  unmatchedPositions: string[];
  engineState: EngineState;
}

export class ReconciliationEngine {
  private adapter: ExchangeAdapter | null = null;
  private stateMachine: StateMachine;
  private lastReconciledAt: number | null = null;
  private isDesync: boolean = false;
  private desyncReason: string | null = null;
  private lastLocalBalance: number = 0;
  private lastExchangeBalance: number = 0;
  private balanceDrift: number = 0;
  private localPositionsCount: number = 0;
  private exchangePositionsCount: number = 0;
  private unmatchedPositions: string[] = [];
  private maxAllowedDriftUSDT: number = 5.0; // $5 tolerance for small fee discrepancies

  constructor(stateMachine: StateMachine) {
    this.stateMachine = stateMachine;
  }

  setAdapter(adapter: ExchangeAdapter) {
    this.adapter = adapter;
  }

  setMaxAllowedDrift(drift: number) {
    this.maxAllowedDriftUSDT = drift;
  }

  getStatus(): ReconciliationStatus {
    return {
      lastReconciledAt: this.lastReconciledAt,
      isDesync: this.isDesync,
      desyncReason: this.desyncReason,
      localBalance: this.lastLocalBalance,
      exchangeBalance: this.lastExchangeBalance,
      balanceDriftUSDT: this.balanceDrift,
      localPositionsCount: this.localPositionsCount,
      exchangePositionsCount: this.exchangePositionsCount,
      unmatchedPositions: this.unmatchedPositions,
      engineState: this.stateMachine.getState()
    };
  }

  async reconcile(localPositions: any[] = [], localBalance: number = 0, explicitExchangeBalances?: Record<string, number>, explicitExchangePositions?: any[]): Promise<boolean> {
    this.lastReconciledAt = Date.now();
    this.lastLocalBalance = localBalance;
    this.localPositionsCount = localPositions.length;
    this.unmatchedPositions = [];

    logger.info('[Reconciliation] Starting state reconciliation check...');

    let exchangeBalances: Record<string, number> = explicitExchangeBalances || {};
    let exchangePositions: any[] = explicitExchangePositions || [];

    if (this.adapter && (!explicitExchangeBalances || !explicitExchangePositions)) {
      try {
        if (!explicitExchangeBalances) {
          exchangeBalances = await this.adapter.getBalance();
        }
        if (!explicitExchangePositions) {
          exchangePositions = await this.adapter.getPositions();
        }
      } catch (err: any) {
        logger.error(`[Reconciliation] Failed to query exchange during reconciliation: ${err?.message || err}`);
        await db.logEvent('RECONCILIATION_ERROR', { error: err?.message || String(err) }, undefined, 'reconciliation', 'CHECK');
        return false;
      }
    }

    const usdtBalance = exchangeBalances['USDT'] ?? exchangeBalances['usdt'] ?? localBalance;
    this.lastExchangeBalance = usdtBalance;
    this.balanceDrift = parseFloat(Math.abs(usdtBalance - localBalance).toFixed(4));
    this.exchangePositionsCount = exchangePositions.length;

    let desyncDetected = false;
    const reasons: string[] = [];

    // Check 1: Balance Drift
    if (this.balanceDrift > this.maxAllowedDriftUSDT && localBalance > 0 && usdtBalance > 0) {
      desyncDetected = true;
      reasons.push(`Balance drift: local $${localBalance.toFixed(2)} vs exchange $${usdtBalance.toFixed(2)} (diff $${this.balanceDrift.toFixed(2)} > max $${this.maxAllowedDriftUSDT})`);
    }

    // Check 2: Mismatched position symbols if exchange positions are reported
    if (exchangePositions.length > 0) {
      const localSymbols = new Set(localPositions.map(p => p.symbol));
      for (const ep of exchangePositions) {
        if (ep.symbol && !localSymbols.has(ep.symbol)) {
          this.unmatchedPositions.push(ep.symbol);
        }
      }
    }

    if (desyncDetected) {
      this.isDesync = true;
      this.desyncReason = reasons.join('; ');
      
      // CRITICAL: Lock trading engine immediately on desynchronization
      this.stateMachine.transitionTo(EngineState.DESYNC_LOCK, `Desynchronization detected: ${this.desyncReason}`);
      
      await db.logEvent('DESYNC_LOCK', {
        reason: this.desyncReason,
        localBalance,
        exchangeBalance: usdtBalance,
        driftUSDT: this.balanceDrift,
        localPositionsCount: this.localPositionsCount,
        exchangePositionsCount: this.exchangePositionsCount,
        unmatchedPositions: this.unmatchedPositions
      }, undefined, 'reconciliation', 'LOCK');

      logger.warn(`🚨 [DESYNC_LOCK] Trading halted due to state desync: ${this.desyncReason}`);
      return false;
    }

    // Sync is healthy
    this.isDesync = false;
    this.desyncReason = null;

    if (this.stateMachine.getState() === EngineState.DESYNC_LOCK) {
      this.stateMachine.transitionTo(EngineState.TRADING, 'Reconciliation resolved successfully');
    }

    await db.logEvent('RECONCILIATION_CHECK', {
      status: 'SYNCHRONIZED',
      localBalance,
      exchangeBalance: usdtBalance,
      driftUSDT: this.balanceDrift,
      localPositionsCount: this.localPositionsCount,
      exchangePositionsCount: this.exchangePositionsCount
    }, undefined, 'reconciliation', 'AUDIT');

    logger.info(`✅ [Reconciliation] State verified. Drift: $${this.balanceDrift.toFixed(2)} USDT.`);
    return true;
  }

  unlockDesync(reason: string = 'Manual operator unlock'): boolean {
    this.isDesync = false;
    this.desyncReason = null;
    this.stateMachine.transitionTo(EngineState.TRADING, `DESYNC_LOCK released: ${reason}`);
    db.logEvent('DESYNC_UNLOCKED', { reason }, undefined, 'reconciliation', 'UNLOCK');
    logger.info(`🔓 [DESYNC_LOCK] Operator unlocked state: ${reason}`);
    return true;
  }
}

