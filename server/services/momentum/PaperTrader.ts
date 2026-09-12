import fs from 'fs';
import path from 'path';
import { getBinanceUniverse, filterCandidatesByLiquidity } from './Universe';
import { fetchHistoricalKlinesForMomentum, buildSynchronizedSnapshot } from './DataFetcher';
import { fetchActiveTickers } from './MultiExchangeMarket';
import { calculateMomentumScore } from './Scorer';
import { journalService } from '../JournalService';
import { MomentumConfig } from './types';
import { db } from '../../engine/database/Database';

export interface PositionSnapshot {
  timestamp: number;
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  pnlPct: number;
  mfe: number;
  mae: number;
  elapsedMinutes: number;
  entryScore: number;
  momentum_15m: number;
  momentum_1h: number;
  momentum_4h: number;
  rvol: number;
  atrExpansion: number;
  breakoutStrength: number;
  trailingStop?: number;
  breakEvenActive: boolean;
  currentRegime: string;
}

export interface PaperPosition {
  id: string;
  symbol: string;
  entryTimestamp: number;
  entryPrice: number;
  sizeUSDT: number;
  feePaid: number;
  status: 'OPEN' | 'CLOSED';
  exitTimestamp?: number;
  exitPrice?: number;
  exitReason?: 'SL' | 'TRAILING' | '24H_EXPIRY' | string;
  realizedPnL?: number;
  realizedPnLPct?: number;
  grossPnL?: number;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  highestPrice?: number;
  trailingStopPrice?: number;
  trailingActive?: boolean;
  durationMinutes?: number;
  scoreAtEntry?: number;
  scoreBreakdown?: {
    momentum_15m: number;
    momentum_1h: number;
    momentum_4h: number;
    rvol: number;
    volumeAcceleration: number;
    breakoutStrength: number;
    atrExpansion: number;
    pullbackQuality: number;
  };
  currentPrice?: number;
  currentPnLPct?: number;
  trailingStop?: number;
  breakEvenActive?: boolean;
  currentRegime?: string;
  snapshots?: PositionSnapshot[];
}

export interface PaperState {
  active: boolean;
  paperBalanceUSDT: number;
  startingBalanceUSDT: number;
  minMomentumScore: number;
  intervalMinutes: number;
  trailingActivationPct: number; // 0-10%, step 0.5, default 3.0
  trailingDistancePct: number;   // 0-5%, step 0.5, default 0.5
  hardStopLossPct: number;       // 0-5% below entry (e.g. 5.0 means -5.0%), step 0.5, default 5.0
  maxHoldMinutes: number;        // 0-1440 min, step 10 min, default 1440
  takeProfitPct: number | null;  // null = Dezactivat
  positionAllocationPct: number; // 1-100% of balance per position, default 10%
  hardStopTriggered?: 'DRAWDOWN_50' | 'PROFIT_100' | null;
  totalFeesPaid?: number;
  positions: PaperPosition[];
  history: PaperPosition[];
  lastRunTimestamp: number;
  logs: { timestamp: number; message: string }[];
}

const STATE_FILE = path.join(process.cwd(), 'server', 'data', 'momentum_paper_state.json');
const SNAPSHOTS_FILE = path.join(process.cwd(), 'server', 'data', 'momentum_hour_snapshots.json');

export class PaperTrader {
  private config: MomentumConfig;
  private state: PaperState;
  private timer: NodeJS.Timeout | null = null;
  private hourTimer: NodeJS.Timeout | null = null;
  private positionTimer: NodeJS.Timeout | null = null;
  private isScanning = false;
  private externalPositionChecker: ((symbol: string) => boolean) | null = null;

  constructor(config: MomentumConfig) {
    this.config = config;
    this.state = this.loadState();
    this.enforceMaxOnePositionPerCoin();
    
    // Sync state configuration
    if (this.state.minMomentumScore !== undefined) {
      this.config.minMomentumScore = this.state.minMomentumScore;
    } else {
      this.state.minMomentumScore = config.minMomentumScore;
    }

    if (this.state.intervalMinutes === undefined) {
      this.state.intervalMinutes = 15;
    }

    if (this.state.trailingActivationPct === undefined) {
      this.state.trailingActivationPct = config.trailingActivationPct ?? 3.0;
    }
    if (this.state.trailingDistancePct === undefined) {
      this.state.trailingDistancePct = config.trailingDistancePct ?? 0.5;
    }
    if (this.state.hardStopLossPct === undefined) {
      this.state.hardStopLossPct = config.hardStopLossPct ?? 5.0;
    }
    if (this.state.maxHoldMinutes === undefined) {
      this.state.maxHoldMinutes = config.maxHoldMinutes ?? 1440;
    }
    if (this.state.takeProfitPct === undefined) {
      this.state.takeProfitPct = config.takeProfitPct ?? null;
    }
    if (this.state.positionAllocationPct === undefined) {
      this.state.positionAllocationPct = config.positionAllocationPct ?? 10;
    }
    if (this.state.totalFeesPaid === undefined) {
      this.state.totalFeesPaid = 0;
    }
    if (this.state.hardStopTriggered === undefined) {
      this.state.hardStopTriggered = null;
    }
    if (this.state.startingBalanceUSDT === undefined) {
      this.state.startingBalanceUSDT = this.state.paperBalanceUSDT || 1000;
    }
    
    if (this.state.active) {
      this.log('Reactivating paper trading from state...');
      this.start(this.state.intervalMinutes);
    }

    this.syncExistingPositionsToAudit();
  }

  public syncExistingPositionsToAudit() {
    try {
      const existingEvents = db.getAuditEvents({ limit: 500 }).events;
      const loggedPosIds = new Set(
        existingEvents
          .filter(e => e.eventType === 'POSITION_OPENED' && e.details?.orderId)
          .map(e => e.details.orderId)
      );

      for (const pos of this.state.positions || []) {
        if (pos.status === 'OPEN' && !loggedPosIds.has(pos.id)) {
          db.logEvent('POSITION_OPENED', {
            orderId: pos.id,
            symbol: pos.symbol,
            side: 'BUY',
            entryPrice: pos.entryPrice,
            sizeUSDT: pos.sizeUSDT,
            amount: pos.sizeUSDT / pos.entryPrice,
            feePaid: pos.feePaid,
            scoreAtEntry: pos.scoreAtEntry,
            trailingActivationPct: this.state.trailingActivationPct,
            trailingDistancePct: this.state.trailingDistancePct,
            hardStopLossPct: this.state.hardStopLossPct,
            entryReason: `Scor Momentum: ${(pos.scoreAtEntry || 60).toFixed(1)}/100 (Momentum Breakout Active Position)`
          }, pos.symbol, 'MomentumBreakout', 'BUY').catch(() => {});
        }
      }
    } catch (err) {
      console.error('[PaperTrader] syncExistingPositionsToAudit error:', err);
    }
  }

  private deduplicateHistory(history: PaperPosition[]): PaperPosition[] {
    if (!Array.isArray(history)) return [];
    const seen = new Set<string>();
    return history.filter(item => {
      if (!item || !item.id) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  private loadState(): PaperState {
    try {
      const dir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.positionAllocationPct === undefined) {
          parsed.positionAllocationPct = 10;
        }
        if (parsed.startingBalanceUSDT === undefined) {
          parsed.startingBalanceUSDT = parsed.paperBalanceUSDT || 1000;
        }
        if (parsed.history && Array.isArray(parsed.history)) {
          parsed.history = this.deduplicateHistory(parsed.history);
        }
        return parsed;
      }
    } catch (err) {
      console.error('[PaperTrader] Failed to load state:', err);
    }

    return {
      active: false,
      paperBalanceUSDT: 1000,
      startingBalanceUSDT: 1000,
      minMomentumScore: 50,
      intervalMinutes: 15,
      trailingActivationPct: 3.0,
      trailingDistancePct: 0.5,
      hardStopLossPct: 5.0,
      maxHoldMinutes: 1440,
      takeProfitPct: null,
      positionAllocationPct: 10,
      hardStopTriggered: null,
      totalFeesPaid: 0,
      positions: [],
      history: [],
      lastRunTimestamp: 0,
      logs: []
    };
  }

  private saveState() {
    try {
      const dir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tempFile = `${STATE_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.state, null, 2));
      fs.renameSync(tempFile, STATE_FILE);
    } catch (err) {
      console.error('[PaperTrader] Failed to save state:', err);
    }
  }

  private saveHourSnapshot(snapshot: PositionSnapshot) {
    try {
      const dir = path.dirname(SNAPSHOTS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      let allSnapshots: PositionSnapshot[] = [];
      if (fs.existsSync(SNAPSHOTS_FILE)) {
        try {
          allSnapshots = JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, 'utf8'));
        } catch {
          allSnapshots = [];
        }
      }
      allSnapshots.push(snapshot);
      // Keep last 5000 snapshots to avoid bloat
      if (allSnapshots.length > 5000) {
        allSnapshots = allSnapshots.slice(-5000);
      }
      fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(allSnapshots, null, 2), 'utf8');
    } catch (err) {
      console.error('[PaperTrader] Failed to save hour snapshot:', err);
    }
  }

  private log(message: string) {
    const entry = { timestamp: Date.now(), message };
    console.log(`[PaperTrader] ${message}`);
    this.state.logs.unshift(entry);
    if (this.state.logs.length > 150) {
      this.state.logs.pop();
    }
  }

  private onBalanceChange?: (newBalance: number) => void;
  private onPositionChange?: () => void;
  private externalBalanceProvider?: () => number;
  private externalBalanceUpdater?: (newBal: number) => void;
  private externalStartingBalanceProvider?: () => number;

  public setOnBalanceChange(cb: (newBalance: number) => void) {
    this.onBalanceChange = cb;
  }

  public setExternalBalanceInterfaces(provider: () => number, updater: (newBal: number) => void, startingBalProvider?: () => number) {
    this.externalBalanceProvider = provider;
    this.externalBalanceUpdater = updater;
    this.externalStartingBalanceProvider = startingBalProvider;
  }

  public setOnPositionChange(cb: () => void) {
    this.onPositionChange = cb;
  }

  private notifyPositionChange() {
    if (this.onPositionChange) {
      try {
        this.onPositionChange();
      } catch (e) {
        console.error('[PaperTrader onPositionChange Error]', e);
      }
    }
  }

  public setExternalPositionChecker(checker: (symbol: string) => boolean) {
    this.externalPositionChecker = checker;
  }

  private executionEngineChecker?: () => string;

  public setExecutionEngineChecker(checker: () => string) {
    this.executionEngineChecker = checker;
  }

  public getEffectiveBalance(): number {
    if (this.externalBalanceProvider) return this.externalBalanceProvider();
    return this.state.paperBalanceUSDT;
  }

  public deductCapital(amount: number) {
    const cur = this.getEffectiveBalance();
    const next = Math.max(0, parseFloat((cur - amount).toFixed(4)));
    if (this.externalBalanceUpdater) {
      this.externalBalanceUpdater(next);
    } else {
      this.state.paperBalanceUSDT = next;
    }
    
    if (this.onBalanceChange) {
      try {
        this.onBalanceChange(next);
      } catch (e) {
        console.error('[PaperTrader onBalanceChange Error]', e);
      }
    }
  }

  public refundCapital(amount: number) {
    const cur = this.getEffectiveBalance();
    const next = parseFloat((cur + amount).toFixed(4));
    if (this.externalBalanceUpdater) {
      this.externalBalanceUpdater(next);
    } else {
      this.state.paperBalanceUSDT = next;
    }
    
    if (this.onBalanceChange) {
      try {
        this.onBalanceChange(next);
      } catch (e) {
        console.error('[PaperTrader onBalanceChange Error]', e);
      }
    }
  }

  public enforceMaxOnePositionPerCoin(): boolean {
    if (!this.state?.positions) return false;
    const openPositions = this.state.positions.filter(p => p.status === 'OPEN');
    const seenSymbols = new Set<string>();
    const duplicates: PaperPosition[] = [];
    const uniqueOpen: PaperPosition[] = [];

    for (const pos of openPositions) {
      if (!seenSymbols.has(pos.symbol)) {
        seenSymbols.add(pos.symbol);
        uniqueOpen.push(pos);
      } else {
        duplicates.push(pos);
      }
    }

    if (duplicates.length === 0) return false;

    let refundTotal = 0;
    const now = Date.now();
    for (const dup of duplicates) {
      dup.status = 'CLOSED';
      dup.exitTimestamp = now;
      dup.exitPrice = dup.entryPrice;
      dup.exitReason = 'ENFORCE_MAX_1_POSITION_PER_COIN';
      dup.realizedPnL = 0;
      dup.realizedPnLPct = 0;

      const refund = (dup.sizeUSDT || 0) + (dup.feePaid || 0);
      refundTotal += refund;
      if (this.state.totalFeesPaid && dup.feePaid) {
        this.state.totalFeesPaid = Math.max(0, this.state.totalFeesPaid - dup.feePaid);
      }
    }

    if (refundTotal > 0) {
      this.refundCapital(refundTotal);
    }

    this.state.positions = uniqueOpen;
    const existingHistoryIds = new Set((this.state.history || []).map(h => h.id));
    const toAdd = duplicates.filter(d => !existingHistoryIds.has(d.id));
    this.state.history = this.deduplicateHistory([...toAdd, ...(this.state.history || [])]);

    this.log(`[REGULĂ MAX 1 TRANZACȚIE/MONEDĂ 🛡️] S-au închis ${duplicates.length} duplicate. S-au restituit $${refundTotal.toFixed(2)} USDT în balanță.`);
    this.saveState();
    return true;
  }

  public getState(): PaperState {
    this.enforceMaxOnePositionPerCoin();
    if (this.state.history) {
      this.state.history = this.deduplicateHistory(this.state.history);
    }
    return this.state;
  }

  public resetState(newBalance = 1000) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.hourTimer) {
      clearInterval(this.hourTimer);
      this.hourTimer = null;
    }
    if (this.positionTimer) {
      clearInterval(this.positionTimer);
      this.positionTimer = null;
    }

    const minScore = this.state.minMomentumScore ?? 50;
    const interval = this.state.intervalMinutes ?? 15;
    const trailingAct = this.state.trailingActivationPct ?? 3.0;
    const trailingDist = this.state.trailingDistancePct ?? 0.5;
    const hardSL = this.state.hardStopLossPct ?? 5.0;
    const maxHold = this.state.maxHoldMinutes ?? 1440;
    const tp = this.state.takeProfitPct ?? null;
    const posAlloc = this.state.positionAllocationPct ?? 10;

    this.state = {
      active: false,
      paperBalanceUSDT: newBalance,
      startingBalanceUSDT: newBalance,
      minMomentumScore: minScore,
      intervalMinutes: interval,
      trailingActivationPct: trailingAct,
      trailingDistancePct: trailingDist,
      hardStopLossPct: hardSL,
      maxHoldMinutes: maxHold,
      takeProfitPct: tp,
      positionAllocationPct: posAlloc,
      hardStopTriggered: null,
      totalFeesPaid: 0,
      positions: [],
      history: [],
      lastRunTimestamp: 0,
      logs: []
    };
    this.saveState();
    if (this.onBalanceChange) {
      try {
        this.onBalanceChange(newBalance);
      } catch (e) {
        console.error('[PaperTrader onBalanceChange Error]', e);
      }
    }
    this.log(`Simulatorul a fost resetat la $${newBalance} cu pozițiile închise și regulile de Hard Stop (-50% / +100%) rearmate.`);
  }

  public setConfig(options: {
    minMomentumScore?: number;
    intervalMinutes?: number;
    trailingActivationPct?: number;
    trailingDistancePct?: number;
    hardStopLossPct?: number;
    maxHoldMinutes?: number;
    takeProfitPct?: number | null;
    positionAllocationPct?: number;
  } | number, legacyInterval?: number) {
    // Support legacy signature (minMomentumScore, intervalMinutes)
    if (typeof options === 'number') {
      this.config.minMomentumScore = options;
      this.state.minMomentumScore = options;
      if (legacyInterval !== undefined) {
        this.state.intervalMinutes = legacyInterval;
      }
    } else if (options && typeof options === 'object') {
      if (options.minMomentumScore !== undefined) {
        this.config.minMomentumScore = options.minMomentumScore;
        this.state.minMomentumScore = options.minMomentumScore;
      }
      if (options.intervalMinutes !== undefined) {
        this.state.intervalMinutes = options.intervalMinutes;
      }
      if (options.trailingActivationPct !== undefined) {
        this.config.trailingActivationPct = options.trailingActivationPct;
        this.state.trailingActivationPct = options.trailingActivationPct;
      }
      if (options.trailingDistancePct !== undefined) {
        this.config.trailingDistancePct = options.trailingDistancePct;
        this.state.trailingDistancePct = options.trailingDistancePct;
      }
      if (options.hardStopLossPct !== undefined) {
        this.config.hardStopLossPct = options.hardStopLossPct;
        this.state.hardStopLossPct = options.hardStopLossPct;
      }
      if (options.maxHoldMinutes !== undefined) {
        this.config.maxHoldMinutes = options.maxHoldMinutes;
        this.state.maxHoldMinutes = options.maxHoldMinutes;
      }
      if (options.takeProfitPct !== undefined) {
        this.config.takeProfitPct = options.takeProfitPct;
        this.state.takeProfitPct = options.takeProfitPct;
      }
      if (options.positionAllocationPct !== undefined) {
        this.config.positionAllocationPct = options.positionAllocationPct;
        this.state.positionAllocationPct = options.positionAllocationPct;
      }
    }

    this.saveState();
    this.log(`Motor parametri actualizat: Alocare = ${this.state.positionAllocationPct}%, Trailing Act = ${this.state.trailingActivationPct}%, Trailing Dist = ${this.state.trailingDistancePct}%, Hard SL = -${this.state.hardStopLossPct}%, Max Hold = ${this.state.maxHoldMinutes}m, TP = ${this.state.takeProfitPct !== null ? `${this.state.takeProfitPct}%` : 'Dezactivat'}, Scor Min = ${this.state.minMomentumScore}`);

    if (this.state.active && this.state.intervalMinutes !== undefined) {
      this.start(this.state.intervalMinutes);
    }
  }

  /**
   * Evaluates Hard Stop rules on total equity (-50% loss or +100% gain).
   * Returns true if a hard stop condition was triggered.
   */
  public checkHardStopCircuitBreaker(): boolean {
    const openPositionsValue = this.state.positions.reduce((sum, p) => {
      const curPrice = p.currentPrice || p.entryPrice;
      const curVal = (curPrice / p.entryPrice) * p.sizeUSDT;
      return sum + curVal;
    }, 0);
    const totalEquity = this.getEffectiveBalance() + openPositionsValue;
    const startBal = this.externalStartingBalanceProvider ? this.externalStartingBalanceProvider() : (this.state.startingBalanceUSDT || 10000);

    // 1. Hard Stop at -50% from initial balance
    if (totalEquity <= startBal * 0.50) {
      if (this.state.hardStopTriggered !== 'DRAWDOWN_50') {
        this.state.hardStopTriggered = 'DRAWDOWN_50';
        this.state.active = false;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this.hourTimer) { clearInterval(this.hourTimer); this.hourTimer = null; }
        if (this.positionTimer) { clearInterval(this.positionTimer); this.positionTimer = null; }
        this.log(`[HARD STOP CIRCUIT BREAKER 🛑] Balanța totală ($${totalEquity.toFixed(2)}) a scăzut la -50% din capitalul inițial ($${startBal.toFixed(2)}). Tranzacționarea a fost OPRITĂ automat.`);
        this.saveState();
      }
      return true;
    }

    // 2. Hard Stop at +100% from initial balance (target doubled)
    if (totalEquity >= startBal * 2.00) {
      if (this.state.hardStopTriggered !== 'PROFIT_100') {
        this.state.hardStopTriggered = 'PROFIT_100';
        this.state.active = false;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this.hourTimer) { clearInterval(this.hourTimer); this.hourTimer = null; }
        if (this.positionTimer) { clearInterval(this.positionTimer); this.positionTimer = null; }
        this.log(`[TARGET PROFIT REACHED 🏆] Țintă atinsă! Balanța totală ($${totalEquity.toFixed(2)}) a crescut cu +100% față de capitalul inițial ($${startBal.toFixed(2)}). Tranzacționarea a fost OPRITĂ cu succes.`);
        this.saveState();
      }
      return true;
    }

    return false;
  }

  public start(intervalMinutes: number = 15) {
    if (this.state.hardStopTriggered) {
      this.log(`[ATENȚIE ⚠️] Simulatorul este în stare de Hard Stop (${this.state.hardStopTriggered}). Resetați simulatorul sau ajustați parametrii pentru a reporni.`);
      this.state.active = false;
      this.saveState();
      return;
    }

    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.hourTimer) {
      clearInterval(this.hourTimer);
    }
    if (this.positionTimer) {
      clearInterval(this.positionTimer);
    }

    this.state.active = true;
    this.state.intervalMinutes = intervalMinutes;
    this.log(`Paper trading started with interval ${intervalMinutes}m (min score: ${this.config.minMomentumScore}, Trailing: +${this.state.trailingActivationPct}% / -${this.state.trailingDistancePct}%, SL: -${this.state.hardStopLossPct}%, MaxHold: ${this.state.maxHoldMinutes}m).`);
    this.saveState();

    try {
      db.logEvent('ENGINE_STARTED', {
        strategy: 'MomentumBreakout',
        intervalMinutes,
        minMomentumScore: this.config.minMomentumScore,
        trailingActivationPct: this.state.trailingActivationPct,
        trailingDistancePct: this.state.trailingDistancePct,
        hardStopLossPct: this.state.hardStopLossPct,
        maxHoldMinutes: this.state.maxHoldMinutes
      }, undefined, 'MomentumBreakout', 'START').catch(() => {});
    } catch (e) {}

    // Run main signal scan cycle immediately once, then schedule
    this.runCycle();
    this.timer = setInterval(() => {
      this.runCycle();
    }, intervalMinutes * 60 * 1000);

    // 1-hour monitoring loop for active positions (hour-by-hour snapshots & event logging)
    this.runHourMonitoring();
    this.hourTimer = setInterval(() => {
      this.runHourMonitoring();
    }, 60 * 60 * 1000); // Every 1 hour

    // Fast price ticker update loop (15 seconds)
    this.updatePositionsFast();
    this.positionTimer = setInterval(() => {
      this.updatePositionsFast();
    }, 15000);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.hourTimer) {
      clearInterval(this.hourTimer);
      this.hourTimer = null;
    }
    if (this.positionTimer) {
      clearInterval(this.positionTimer);
      this.positionTimer = null;
    }
    this.state.active = false;
    this.log('Paper trading stopped.');
    this.saveState();

    try {
      db.logEvent('ENGINE_STOPPED', {
        strategy: 'MomentumBreakout',
        reason: 'Operator stopped or circuit breaker triggered'
      }, undefined, 'MomentumBreakout', 'STOP').catch(() => {});
    } catch (e) {}
  }

  /**
   * Evaluates exit conditions based on dynamic parameter engine:
   * 1. Trailing Stop (Activation & Distance)
   * 2. Hard SL (0-5% below entry)
   * 3. Max Hold (0-1440 min)
   * 4. Take Profit (if configured)
   */
  private evaluatePositionExit(pos: PaperPosition, currentPrice: number, now: number): { shouldExit: boolean; exitPrice: number; exitReason: 'SL' | 'TRAILING' | 'TIMEOUT' | 'TP' } | null {
    const elapsedMinutes = Math.floor((now - pos.entryTimestamp) / (60 * 1000));
    const trailingActivation = this.state.trailingActivationPct ?? this.config.trailingActivationPct ?? 3.0;
    const trailingDistance = this.state.trailingDistancePct ?? this.config.trailingDistancePct ?? 0.5;
    const hardSL = this.state.hardStopLossPct ?? this.config.hardStopLossPct ?? 5.0;
    const maxHold = this.state.maxHoldMinutes ?? this.config.maxHoldMinutes ?? 1440;
    const tp = this.state.takeProfitPct ?? this.config.takeProfitPct ?? null;

    // Highest price tracking
    if (!pos.highestPrice || currentPrice > pos.highestPrice) {
      pos.highestPrice = Math.max(pos.highestPrice || pos.entryPrice, currentPrice);
    }

    // 0. Take Profit evaluation (if enabled)
    if (tp !== null && tp > 0) {
      const tpPrice = pos.entryPrice * (1 + tp / 100);
      if (currentPrice >= tpPrice) {
        const exitPrice = currentPrice * (1 - this.config.exitSlippagePct / 100);
        return {
          shouldExit: true,
          exitPrice,
          exitReason: 'TP'
        };
      }
    }

    // 1. Trailing Stop evaluation (Activation threshold)
    const activationPrice = pos.entryPrice * (1 + trailingActivation / 100);
    if (!pos.trailingActive && (currentPrice >= activationPrice || pos.highestPrice >= activationPrice || pos.maxFavorableExcursion >= trailingActivation)) {
      pos.trailingActive = true;
      const initialTrailingStop = (pos.highestPrice || currentPrice) * (1 - trailingDistance / 100);
      pos.trailingStopPrice = initialTrailingStop;
      this.log(`[TRAILING ACTIVE 🎯] ${pos.symbol} a atins pragul de activare (+${trailingActivation.toFixed(1)}%). Trailing Stop fixat la $${initialTrailingStop.toFixed(4)} (-${trailingDistance.toFixed(1)}% față de vârf $${(pos.highestPrice || currentPrice).toFixed(4)}).`);

      try {
        db.logEvent('MOMENTUM_TRAILING_ACTIVATED', {
          symbol: pos.symbol,
          activationPct: trailingActivation,
          trailingDistancePct: trailingDistance,
          peakPrice: pos.highestPrice || currentPrice,
          trailingStopPrice: initialTrailingStop
        }, pos.symbol, 'MomentumBreakout', 'UPDATE').catch(() => {});
      } catch (e) {}
    }

    // Update trailing stop level if price moves higher while trailing is active
    if (pos.trailingActive) {
      const candidateTrailingStop = (pos.highestPrice || currentPrice) * (1 - trailingDistance / 100);
      if (!pos.trailingStopPrice || candidateTrailingStop > pos.trailingStopPrice) {
        pos.trailingStopPrice = candidateTrailingStop;
      }

      // Check if price fell to or below trailing stop
      if (currentPrice <= pos.trailingStopPrice) {
        const rawExit = pos.trailingStopPrice;
        const exitPrice = rawExit * (1 - this.config.exitSlippagePct / 100);
        return {
          shouldExit: true,
          exitPrice,
          exitReason: 'TRAILING'
        };
      }
    }

    // 2. Hard Stop Loss evaluation (hardSL% below entry, e.g. 5.0% below entry)
    if (hardSL > 0) {
      const slPrice = pos.entryPrice * (1 - hardSL / 100);
      if (currentPrice <= slPrice) {
        const exitPrice = currentPrice * (1 - this.config.exitSlippagePct / 100);
        return {
          shouldExit: true,
          exitPrice,
          exitReason: 'SL'
        };
      }
    }

    // 3. Max Hold Timeout (e.g. 1440 min = 24h)
    if (maxHold > 0 && elapsedMinutes >= maxHold) {
      const exitPrice = currentPrice * (1 - this.config.exitSlippagePct / 100);
      return {
        shouldExit: true,
        exitPrice,
        exitReason: 'TIMEOUT'
      };
    }

    return null;
  }

  private closePosition(pos: PaperPosition, exitPrice: number, exitReason: 'SL' | 'TRAILING' | 'TIMEOUT' | 'TP' | string, now: number) {
    const elapsedMinutes = Math.floor((now - pos.entryTimestamp) / (60 * 1000));
    const grossPnlUsdt = ((exitPrice / pos.entryPrice) - 1) * pos.sizeUSDT;
    const entryFee = pos.feePaid; // Paid at entry
    const exitFee = (pos.sizeUSDT + grossPnlUsdt) * (this.config.exitFeePct / 100);
    const totalFees = entryFee + exitFee;
    const netPnL = grossPnlUsdt - totalFees;

    pos.status = 'CLOSED';
    pos.exitTimestamp = now;
    pos.exitPrice = exitPrice;
    pos.exitReason = exitReason;
    pos.realizedPnL = netPnL;
    pos.realizedPnLPct = (netPnL / pos.sizeUSDT) * 100;
    pos.grossPnL = grossPnlUsdt;
    pos.feePaid += exitFee;
    pos.durationMinutes = elapsedMinutes;

    // Track total cumulative fees accurately
    this.state.totalFeesPaid = (this.state.totalFeesPaid || 0) + exitFee;

    // Exact Cash Accounting: At entry we deducted (sizeUSDT + entryFee).
    // Now returned cash is (sizeUSDT + grossPnlUsdt - exitFee).
    // Net balance change = returnedCash - (sizeUSDT + entryFee) = grossPnlUsdt - entryFee - exitFee = netPnL!
    const returnedCash = pos.sizeUSDT + grossPnlUsdt - exitFee;
    this.refundCapital(returnedCash);

    const reasonLabel = exitReason === 'TRAILING' ? 'TRAILING PROFIT 🎯' : exitReason === 'SL' ? `STOP LOSS -${this.state.hardStopLossPct}% 🛑` : exitReason === 'TP' ? 'TAKE PROFIT 💰' : exitReason === 'MANUAL' ? 'ÎNCHIDERE MANUALĂ 🖐️' : `TIMEOUT ${this.state.maxHoldMinutes}m ⏳`;
    this.log(`[EXIT ${reasonLabel}] Închidere poziție ${pos.symbol} (${exitReason}). Preț intrare: $${pos.entryPrice.toFixed(4)} → Preț ieșire: $${exitPrice.toFixed(4)}, PnL Net: $${netPnL.toFixed(2)} (${pos.realizedPnLPct.toFixed(2)}%), Taxe: $${totalFees.toFixed(3)}, Max MFE: +${pos.maxFavorableExcursion.toFixed(2)}%, Max MAE: ${pos.maxAdverseExcursion.toFixed(2)}%, Timp: ${(elapsedMinutes / 60).toFixed(1)}h`);

    // Check Hard Stop Circuit Breakers
    this.checkHardStopCircuitBreaker();

    try {
      journalService.addJournalEntry({
        symbol: pos.symbol,
        action: 'SELL',
        price: exitPrice,
        amount: pos.sizeUSDT / pos.entryPrice,
        fee: exitFee,
        pnl: netPnL,
        pnlPercent: pos.realizedPnLPct || 0,
        mlProbability: pos.scoreAtEntry || 75,
        modelName: 'Momentum Breakout',
        entryReason: reasonLabel,
        mode: 'paper',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('[PaperTrader] Failed to log sell journal entry:', err);
    }

    try {
      db.logEvent('POSITION_CLOSED', {
        positionId: pos.id,
        symbol: pos.symbol,
        side: 'SELL',
        entryPrice: pos.entryPrice,
        exitPrice: exitPrice,
        sizeUSDT: pos.sizeUSDT,
        grossPnL: grossPnlUsdt,
        realizedPnL: netPnL,
        realizedPnLPct: pos.realizedPnLPct,
        totalFees: totalFees,
        exitReason: reasonLabel,
        durationMinutes: elapsedMinutes,
        mfe: pos.maxFavorableExcursion,
        mae: pos.maxAdverseExcursion
      }, pos.symbol, 'MomentumBreakout', 'SELL').catch(() => {});
    } catch (err) {
      console.error('[PaperTrader] Failed to log audit POSITION_CLOSED:', err);
    }
    this.notifyPositionChange();
  }

  private async updatePositionsFast() {
    if (!this.state.active || this.state.positions.length === 0) return;
    this.enforceMaxOnePositionPerCoin();
    const now = Date.now();
    try {
      const tickers = await fetchActiveTickers();
      const priceMap = new Map<string, number>();
      if (Array.isArray(tickers)) {
        for (const t of tickers) {
          if (t && t.symbol && t.price) {
            priceMap.set(t.symbol, t.price);
          }
        }
      } else {
        console.warn('[PaperTrader] updatePositionsFast: tickers is not an array:', tickers);
      }
      
      let stateChanged = false;
      for (const pos of this.state.positions) {
        if (pos.status === 'OPEN') {
           const currentPrice = priceMap.get(pos.symbol);
           if (currentPrice) {
             const pctMove = ((currentPrice / pos.entryPrice) - 1) * 100;
             pos.currentPrice = currentPrice;
             pos.currentPnLPct = pctMove;
             
             const oldMfe = pos.maxFavorableExcursion;
             const oldMae = pos.maxAdverseExcursion;
             pos.maxFavorableExcursion = Math.max(pos.maxFavorableExcursion, pctMove);
             pos.maxAdverseExcursion = Math.min(pos.maxAdverseExcursion, pctMove);

             if (pos.maxFavorableExcursion > oldMfe && pos.maxFavorableExcursion > 0.5) {
               this.log(`[MFE RECORD 🚀] ${pos.symbol} nou MFE record: +${pos.maxFavorableExcursion.toFixed(2)}% (Preț: $${currentPrice})`);
             }
             if (pos.maxAdverseExcursion < oldMae && pos.maxAdverseExcursion < -0.5) {
               this.log(`[MAE RECORD ⚠️] ${pos.symbol} nou MAE record: ${pos.maxAdverseExcursion.toFixed(2)}% (Preț: $${currentPrice})`);
             }

             // Apex Exit Check
             const exitDecision = this.evaluatePositionExit(pos, currentPrice, now);
             if (exitDecision && exitDecision.shouldExit) {
               this.closePosition(pos, exitDecision.exitPrice, exitDecision.exitReason, now);
             }

             stateChanged = true;
           }
        }
      }

      // Move newly closed positions to history
      const openPositions = this.state.positions.filter(p => p.status === 'OPEN');
      const newlyClosed = this.state.positions.filter(p => p.status === 'CLOSED');
      if (newlyClosed.length > 0) {
        const existingHistoryIds = new Set((this.state.history || []).map(h => h.id));
        const toAdd = newlyClosed.filter(c => !existingHistoryIds.has(c.id));
        if (toAdd.length > 0) {
          this.state.history = this.deduplicateHistory([...toAdd, ...(this.state.history || [])]);
        }
        this.state.positions = openPositions;
        stateChanged = true;
      }

      if (stateChanged) this.saveState();
    } catch (err) {
      this.log('Eroare la actualizarea rapidă a prețurilor: ' + String(err));
    }
  }

  private async runHourMonitoring() {
    if (!this.state.active || this.state.positions.length === 0) return;
    const now = Date.now();

    try {
      for (const pos of this.state.positions) {
        if (pos.status !== 'OPEN') continue;

        // Fetch klines for indicator snapshot
        const k15m = await fetchHistoricalKlinesForMomentum(pos.symbol, '15m', 30);
        const k1h = await fetchHistoricalKlinesForMomentum(pos.symbol, '1h', 20);
        const k4h = await fetchHistoricalKlinesForMomentum(pos.symbol, '4h', 15);

        if (k15m.length === 0) continue;
        const currentPrice = k15m[k15m.length - 1].close;
        const pnlPct = ((currentPrice / pos.entryPrice) - 1) * 100;

        // Update MFE / MAE
        pos.maxFavorableExcursion = Math.max(pos.maxFavorableExcursion, pnlPct);
        pos.maxAdverseExcursion = Math.min(pos.maxAdverseExcursion, pnlPct);

        const elapsedMinutes = Math.floor((now - pos.entryTimestamp) / (60 * 1000));

        // Calculate scores & indicators
        let mom15 = 0, mom1h = 0, mom4h = 0, rvol = 1, atrExp = 1, breakoutStr = 0;
        if (k15m.length >= 2 && k1h.length >= 2 && k4h.length >= 2) {
          const scores = calculateMomentumScore(k15m, k1h, k4h);
          mom15 = scores.momentum_15m;
          mom1h = scores.momentum_1h;
          mom4h = scores.momentum_4h;
          rvol = scores.rvol_current;
          atrExp = scores.atrExpansion;
          breakoutStr = scores.breakoutStrength;
        }

        // Current Regime Determination
        let regime = 'CONSOLIDATION';
        if (mom15 > 0.5 && rvol > 1.2 && atrExp > 1.1) {
          regime = 'BREAKOUT_EXPANSION';
        } else if (mom15 > 0 && mom1h > 0) {
          regime = 'BULLISH_TREND';
        } else if (pnlPct < -1.0) {
          regime = 'PULLBACK_DRAWDOWN';
        }
        pos.currentRegime = regime;

        // Build snapshot
        const snapshot: PositionSnapshot = {
          timestamp: now,
          symbol: pos.symbol,
          entryPrice: pos.entryPrice,
          currentPrice,
          pnlPct,
          mfe: pos.maxFavorableExcursion,
          mae: pos.maxAdverseExcursion,
          elapsedMinutes,
          entryScore: pos.scoreAtEntry || 50,
          momentum_15m: mom15,
          momentum_1h: mom1h,
          momentum_4h: mom4h,
          rvol,
          atrExpansion: atrExp,
          breakoutStrength: breakoutStr,
          trailingStop: pos.trailingStopPrice,
          breakEvenActive: false,
          currentRegime: regime
        };

        if (!pos.snapshots) {
          pos.snapshots = [];
        }
        pos.snapshots.push(snapshot);
        this.saveHourSnapshot(snapshot);

        // Check Apex exit rules during hour monitoring as well
        const exitDecision = this.evaluatePositionExit(pos, currentPrice, now);
        if (exitDecision && exitDecision.shouldExit) {
          this.closePosition(pos, exitDecision.exitPrice, exitDecision.exitReason, now);
        }
      }

      // Move closed positions to history
      const openPositions = this.state.positions.filter(p => p.status === 'OPEN');
      const newlyClosed = this.state.positions.filter(p => p.status === 'CLOSED');
      if (newlyClosed.length > 0) {
        const existingHistoryIds = new Set((this.state.history || []).map(h => h.id));
        const toAdd = newlyClosed.filter(c => !existingHistoryIds.has(c.id));
        if (toAdd.length > 0) {
          this.state.history = this.deduplicateHistory([...toAdd, ...(this.state.history || [])]);
        }
        this.state.positions = openPositions;
      }

      this.saveState();
    } catch (err: any) {
      this.log(`Eroare în bucla de monitorizare orară: ${err?.message || err}`);
    }
  }

  public async runCycle() {
    if (!this.state.active) return;
    if (this.checkHardStopCircuitBreaker()) return;

    const currentEngine = this.executionEngineChecker ? this.executionEngineChecker() : 'both';
    if (currentEngine === 'scalping' || currentEngine === 'none') {
      this.log(`[Momentum Breakout] Modul de execuție activ este ${currentEngine === 'none' ? 'OPRIT (NONE)' : 'DOAR SCALPING ML'}. Sărit deschiderea de poziții noi.`);
      return;
    }

    if (this.isScanning) {
      this.log('Un ciclu de scanare este deja în desfășurare. Se evită execuția concurentă.');
      return;
    }
    this.isScanning = true;

    this.enforceMaxOnePositionPerCoin();
    this.log('Running paper trading cycle...');
    this.state.lastRunTimestamp = Date.now();

    try {
      const tickers = await fetchActiveTickers();
      
      const liquidSymbols = Array.isArray(tickers) ? tickers
        .filter(t => 
          t && t.symbol &&
          t.symbol.endsWith('USDT') && 
          !['UPUSDT', 'DOWNUSDT', 'BULLUSDT', 'BEARUSDT'].some(e => t.symbol.includes(e)) &&
          (t.quoteVolume || 0) >= this.config.minLiquidity24h
        )
        .map(t => t.symbol) : [];

      if (!Array.isArray(tickers)) {
        console.warn('[PaperTrader] runCycle: tickers is not an array:', tickers);
      }

      const subset = liquidSymbols;
      this.log(`Univers de tranzacționare evaluat: ${liquidSymbols.length} simboluri îndeplinesc pragul de lichiditate 24h (min $${(this.config.minLiquidity24h/1e6).toFixed(1)}M).`);

      const now = Date.now();

      // 1. Scan for new signals if balance permits and we don't already have open position on symbol
      const activeSymbols = new Set(this.state.positions.filter(p => p.status === 'OPEN').map(p => p.symbol));
      const scannedResults: { symbol: string; score: number }[] = [];

      for (const symbol of subset) {
        if (this.checkHardStopCircuitBreaker()) break;

        // Invariantă P0: Maxim 1 tranzacție per monedă (intern sau pe alt modul al botului)
        const alreadyOpenInPaper = activeSymbols.has(symbol) || this.state.positions.some(p => p.symbol === symbol && p.status === 'OPEN');
        const alreadyOpenInBot = this.externalPositionChecker ? this.externalPositionChecker(symbol) : false;
        if (alreadyOpenInPaper || alreadyOpenInBot) continue;

        const k15m = await fetchHistoricalKlinesForMomentum(symbol, '15m', 100);
        const k1h = await fetchHistoricalKlinesForMomentum(symbol, '1h', 50);
        const k4h = await fetchHistoricalKlinesForMomentum(symbol, '4h', 30);

        if (k15m.length < 10 || k1h.length < 10 || k4h.length < 10) continue;

        const snap = buildSynchronizedSnapshot(now, k15m, k1h, k4h);
        if (snap.kline15m.length < 2) continue;

        const scores = calculateMomentumScore(snap.kline15m, snap.kline1h, snap.kline4h);
        scannedResults.push({ symbol, score: scores.momentumScore });

        // Check if we should open position: strict 1 position per coin
        if (activeSymbols.has(symbol)) continue;
        if (this.state.positions.some(p => p.symbol === symbol && p.status === 'OPEN')) continue;
        if (this.externalPositionChecker && this.externalPositionChecker(symbol)) continue;
        const availableBal = this.getEffectiveBalance();
        if (availableBal < 5) continue; // Not enough balance for minimum trade

        if (scores.momentumScore >= this.config.minMomentumScore) {
          // Double check right before execution - STRICT MAX 1 PER COIN RULE
          if (this.state.positions.some(p => p.symbol === symbol && p.status === 'OPEN') || (this.externalPositionChecker && this.externalPositionChecker(symbol))) {
            this.log(`[MAX 1 TRANZACȚIE PER MONEDĂ 🛑] Poziție deja activă pentru ${symbol}. Se blochează deschiderea suplimentară.`);
            continue;
          }

          // Fetch fresh price to avoid stale kline data
          const freshPriceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
          const freshPriceData = await freshPriceRes.json();
          const entryPriceRaw = parseFloat(freshPriceData.price);
          
          const entryPrice = entryPriceRaw * (1 + this.config.entrySlippagePct / 100);
          const allocPct = this.state.positionAllocationPct ?? this.config.positionAllocationPct ?? 10;
          const baseCapital = this.state.startingBalanceUSDT || this.state.paperBalanceUSDT || 1000;
          const targetSizeUSDT = (baseCapital * (allocPct / 100));
          const maxAvailableUSDT = availableBal / (1 + this.config.entryFeePct / 100);
          const sizeUSDT = Math.min(targetSizeUSDT, maxAvailableUSDT);
          
          if (sizeUSDT < 5) continue; // Below minimum trade size

          const feePaid = sizeUSDT * (this.config.entryFeePct / 100);

          this.deductCapital(sizeUSDT + feePaid);
          this.state.totalFeesPaid = (this.state.totalFeesPaid || 0) + feePaid;

          const newPos: PaperPosition = {
            id: `paper_${Date.now()}_${symbol}`,
            symbol,
            entryTimestamp: now,
            entryPrice,
            sizeUSDT,
            feePaid,
            status: 'OPEN',
            maxFavorableExcursion: 0,
            maxAdverseExcursion: 0,
            scoreAtEntry: scores.momentumScore,
            scoreBreakdown: {
              momentum_15m: scores.momentum_15m,
              momentum_1h: scores.momentum_1h,
              momentum_4h: scores.momentum_4h,
              rvol: scores.rvol_current,
              volumeAcceleration: scores.volumeAcceleration,
              breakoutStrength: scores.breakoutStrength,
              atrExpansion: scores.atrExpansion,
              pullbackQuality: scores.pullbackQuality
            },
            snapshots: []
          };

          this.state.positions.push(newPos);
          activeSymbols.add(symbol);
          this.log(`[ENTRY 🟢] Deschis poziție paper pe ${symbol} la $${entryPrice.toFixed(4)} cu Scor Momentum ${scores.momentumScore.toFixed(1)} (RVOL: ${scores.rvol_current.toFixed(2)}, ATR Exp: ${scores.atrExpansion.toFixed(2)})`);

          try {
            journalService.addJournalEntry({
              symbol: symbol,
              action: 'BUY',
              price: entryPrice,
              amount: sizeUSDT / entryPrice,
              fee: feePaid,
              pnl: 0,
              pnlPercent: 0,
              mlProbability: scores.momentumScore,
              modelName: 'Momentum Breakout',
              entryReason: `Momentum: ${scores.momentumScore.toFixed(1)}/100`,
              mode: 'paper',
              timestamp: new Date().toISOString()
            });
          } catch (err) {
            console.error('[PaperTrader] Failed to log buy journal entry:', err);
          }

          try {
            db.logEvent('POSITION_OPENED', {
              orderId: newPos.id,
              symbol: newPos.symbol,
              side: 'BUY',
              entryPrice: newPos.entryPrice,
              sizeUSDT: newPos.sizeUSDT,
              amount: newPos.sizeUSDT / newPos.entryPrice,
              feePaid: newPos.feePaid,
              scoreAtEntry: scores.momentumScore,
              trailingActivationPct: this.state.trailingActivationPct,
              trailingDistancePct: this.state.trailingDistancePct,
              hardStopLossPct: this.state.hardStopLossPct,
              entryReason: `Scor Momentum: ${scores.momentumScore.toFixed(1)}/100 (RVOL: ${scores.rvol_current.toFixed(2)}, ATR: ${scores.atrExpansion.toFixed(2)})`
            }, newPos.symbol, 'MomentumBreakout', 'BUY').catch(() => {});
          } catch (err) {
            console.error('[PaperTrader] Failed to log audit POSITION_OPENED:', err);
          }
          this.notifyPositionChange();

          // Immediate initial hour snapshot
          const initialSnapshot: PositionSnapshot = {
            timestamp: now,
            symbol,
            entryPrice,
            currentPrice: entryPrice,
            pnlPct: 0,
            mfe: 0,
            mae: 0,
            elapsedMinutes: 0,
            entryScore: scores.momentumScore,
            momentum_15m: scores.momentum_15m,
            momentum_1h: scores.momentum_1h,
            momentum_4h: scores.momentum_4h,
            rvol: scores.rvol_current,
            atrExpansion: scores.atrExpansion,
            breakoutStrength: scores.breakoutStrength,
            breakEvenActive: false,
            currentRegime: 'BREAKOUT_EXPANSION'
          };
          newPos.snapshots?.push(initialSnapshot);
          this.saveHourSnapshot(initialSnapshot);
        }
      }

      scannedResults.sort((a, b) => b.score - a.score);
      const top5 = scannedResults.slice(0, 5).map(item => `${item.symbol} (${item.score.toFixed(1)})`).join(', ');

      this.saveState();
      this.log(`Scan finalizat: ${scannedResults.length} simboluri evaluate. Top 5 scoruri: [ ${top5 || 'N/A'} ]`);
      this.log('Paper trading cycle completed successfully.');
    } catch (err: any) {
      this.log(`Error in paper cycle: ${err.message}`);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Closes an open position manually (override by operator).
   */
  public async closePositionManual(symbolOrId: string): Promise<PaperPosition | null> {
    const pos = this.state.positions.find(p => p.symbol === symbolOrId || p.id === symbolOrId);
    if (!pos || pos.status !== 'OPEN') return null;

    let exitPrice = pos.currentPrice || pos.entryPrice;
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pos.symbol}`);
      const data = await res.json();
      if (data && data.price) {
        exitPrice = parseFloat(data.price);
      }
    } catch {
      // fallback to current price
    }

    const now = Date.now();
    this.closePosition(pos, exitPrice, 'MANUAL', now);
    this.state.positions = this.state.positions.filter(p => p.id !== pos.id);
    const existingHistoryIds = new Set((this.state.history || []).map(h => h.id));
    if (!existingHistoryIds.has(pos.id)) {
      this.state.history.unshift(pos);
    }
    this.saveState();
    return pos;
  }

  /**
   * Closes all open paper positions immediately (e.g. for Risk Engine / Equity Trailing Protection).
   */
  public async closeAllPositions(reason: string = 'PROTECTION'): Promise<number> {
    const openPositions = [...this.state.positions.filter(p => p.status === 'OPEN')];
    let closedCount = 0;
    for (const pos of openPositions) {
      try {
        await this.closePositionManual(pos.id);
        closedCount++;
      } catch (err: any) {
        console.error(`[PaperTrader] Eroare la închiderea de protecție a poziției ${pos.symbol}:`, err?.message || err);
      }
    }
    this.log(`[PROTECTION 🛡️] Au fost închise toate cele ${closedCount} poziții deschise (${reason}).`);
    try {
      db.logEvent('EMERGENCY_CLOSE_ALL', {
        reason: reason || 'Risk Engine triggered',
        closedCount
      }, undefined, 'RiskEngine', 'EMERGENCY').catch(() => {});
    } catch (e) {}
    this.notifyPositionChange();
    return closedCount;
  }
}

// Singleton instance with default baseline config
export const paperTrader = new PaperTrader({
  minLiquidity24h: 10000000,
  entryFeePct: 0.075,
  exitFeePct: 0.075,
  entrySlippagePct: 0.1,
  exitSlippagePct: 0.1,
  minMomentumScore: 50,
  trailingActivationPct: 3.0,
  trailingDistancePct: 0.5,
  hardStopLossPct: 5.0,
  maxHoldMinutes: 1440,
  takeProfitPct: null,
  positionAllocationPct: 10
});
