export enum EngineState {
  STARTING = 'STARTING',
  CONNECTING = 'CONNECTING',
  SYNCING = 'SYNCING',
  READY = 'READY',
  TRADING = 'TRADING',
  DATA_DELAYED = 'DATA_DELAYED',
  RISK_LOCK = 'RISK_LOCK',
  DESYNC_LOCK = 'DESYNC_LOCK',
  RECONCILIATION = 'RECONCILIATION',
  EMERGENCY = 'EMERGENCY',
  CLOSE_ONLY = 'CLOSE_ONLY'
}

export interface StateTransitionRecord {
  from: EngineState;
  to: EngineState;
  reason: string;
  timestamp: number;
}

export class StateMachine {
  private currentState: EngineState = EngineState.STARTING;
  private lastTransitionReason: string = 'Engine initialized';
  private lastTransitionTimestamp: number = Date.now();
  private history: StateTransitionRecord[] = [];

  getState(): EngineState {
    return this.currentState;
  }

  getReason(): string {
    return this.lastTransitionReason;
  }

  getLastTransitionTime(): number {
    return this.lastTransitionTimestamp;
  }

  getHistory(): StateTransitionRecord[] {
    return this.history.slice(0, 50);
  }

  transitionTo(newState: EngineState, reason: string) {
    const from = this.currentState;
    console.log(`[State Machine] Transitioning: ${from} -> ${newState}. Reason: ${reason}`);
    this.currentState = newState;
    this.lastTransitionReason = reason;
    this.lastTransitionTimestamp = Date.now();
    this.history.unshift({
      from,
      to: newState,
      reason,
      timestamp: this.lastTransitionTimestamp
    });
    if (this.history.length > 100) {
      this.history = this.history.slice(0, 100);
    }
  }

  canTrade(): boolean {
    return this.currentState === EngineState.TRADING;
  }

  isLocked(): boolean {
    return this.currentState === EngineState.DESYNC_LOCK ||
           this.currentState === EngineState.RISK_LOCK ||
           this.currentState === EngineState.EMERGENCY;
  }

  canClosePositionsOnly(): boolean {
    return this.currentState === EngineState.CLOSE_ONLY ||
           this.currentState === EngineState.EMERGENCY ||
           this.currentState === EngineState.TRADING ||
           this.currentState === EngineState.DESYNC_LOCK;
  }
}

