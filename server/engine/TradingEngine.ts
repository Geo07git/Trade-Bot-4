import { StateMachine, EngineState } from './State';
import { RiskEngine } from './risk/RiskEngine';
import { SignalEngine } from './signal/SignalEngine';
import { OrderManager } from './order/OrderManager';
import { ReconciliationEngine } from './reconciliation/ReconciliationEngine';
import { ExchangeAdapter } from './adapters/ExchangeAdapter';
import { db } from './database/Database';
import { logger } from '../../src/utils/logger';

export class TradingEngine {
  private stateMachine: StateMachine;
  private riskEngine: RiskEngine;
  private signalEngine: SignalEngine;
  private orderManager: OrderManager;
  private reconciliationEngine: ReconciliationEngine;
  
  private adapter: ExchangeAdapter | null = null;

  constructor() {
    this.stateMachine = new StateMachine();
    this.riskEngine = new RiskEngine();
    this.signalEngine = new SignalEngine();
    this.orderManager = new OrderManager();
    this.reconciliationEngine = new ReconciliationEngine(this.stateMachine);
  }

  get engines() {
    return {
      state: this.stateMachine,
      risk: this.riskEngine,
      signal: this.signalEngine,
      order: this.orderManager,
      reconciliation: this.reconciliationEngine
    };
  }

  setAdapter(adapter: ExchangeAdapter) {
    this.adapter = adapter;
    this.orderManager.setAdapter(adapter);
    this.reconciliationEngine.setAdapter(adapter);
  }

  async start() {
    this.stateMachine.transitionTo(EngineState.STARTING, 'Engine initialized');
    await db.connect();
    
    if (this.adapter) {
      this.stateMachine.transitionTo(EngineState.CONNECTING, 'Connecting to exchange');
      await this.adapter.connect();

      this.stateMachine.transitionTo(EngineState.SYNCING, 'Syncing state with exchange');
      await this.reconciliationEngine.reconcile([], 0);
    }

    this.stateMachine.transitionTo(EngineState.READY, 'Sync complete');
    this.stateMachine.transitionTo(EngineState.TRADING, 'Trading activated');
    await db.logEvent('ENGINE_STARTED', { state: EngineState.TRADING }, undefined, 'TradeBot', 'START');
  }

  async stop() {
    this.stateMachine.transitionTo(EngineState.CLOSE_ONLY, 'Engine stopping gracefully');
    if (this.adapter) {
      await this.adapter.disconnect();
    }
    await db.logEvent('ENGINE_STOPPED', { state: EngineState.CLOSE_ONLY }, undefined, 'TradeBot', 'STOP');
  }

  async emergencyStop(reason: string = 'Operator Kill Switch') {
    this.stateMachine.transitionTo(EngineState.EMERGENCY, reason);
    logger.error(`🚨 [KILL SWITCH] Trading engine halted: ${reason}`);
    await db.logEvent('KILL_SWITCH_ACTIVATED', { reason }, undefined, 'TradeBot', 'EMERGENCY');
  }

  async resumeTrading(reason: string = 'Operator Resume') {
    this.stateMachine.transitionTo(EngineState.TRADING, reason);
    logger.info(`▶️ [ENGINE] Trading resumed: ${reason}`);
    await db.logEvent('ENGINE_RESUMED', { reason }, undefined, 'TradeBot', 'RESUME');
  }

  async reconcile(localPositions: any[], localBalance: number, explicitExchangeBalances?: Record<string, number>, explicitExchangePositions?: any[]) {
    return await this.reconciliationEngine.reconcile(localPositions, localBalance, explicitExchangeBalances, explicitExchangePositions);
  }

  unlockDesync(reason: string = 'Manual operator unlock') {
    return this.reconciliationEngine.unlockDesync(reason);
  }

  getFullStatus() {
    const currentState = this.stateMachine.getState();
    const reconStatus = this.reconciliationEngine.getStatus();
    const auditStats = db.getAuditStats();

    return {
      state: currentState,
      stateReason: this.stateMachine.getReason(),
      lastStateChangeTime: this.stateMachine.getLastTransitionTime(),
      canTrade: this.stateMachine.canTrade(),
      isLocked: this.stateMachine.isLocked(),
      reconciliation: reconStatus,
      auditStats,
      stateHistory: this.stateMachine.getHistory()
    };
  }
}

export const tradingEngine = new TradingEngine();
