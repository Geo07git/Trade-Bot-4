import fs from 'fs';
import path from 'path';
import { getBinanceUniverse, filterCandidatesByLiquidity } from './Universe';
import { fetchHistoricalKlinesForMomentum, buildSynchronizedSnapshot } from './DataFetcher';
import { calculateMomentumScore } from './Scorer';
import { MomentumConfig } from './types';

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
  exitReason?: string;
  realizedPnL?: number;
  realizedPnLPct?: number;
  grossPnL?: number;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
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

  constructor(config: MomentumConfig) {
    this.config = config;
    this.state = this.loadState();
    
    if (this.state.minMomentumScore !== undefined) {
      this.config.minMomentumScore = this.state.minMomentumScore;
    } else {
      this.state.minMomentumScore = config.minMomentumScore;
    }

    if (this.state.intervalMinutes === undefined) {
      this.state.intervalMinutes = 15;
    }
    
    if (this.state.active) {
      this.log('Reactivating paper trading from state...');
      this.start(this.state.intervalMinutes);
    }
  }

  private loadState(): PaperState {
    try {
      const dir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[PaperTrader] Failed to load state:', err);
    }

    return {
      active: false,
      paperBalanceUSDT: 10000,
      startingBalanceUSDT: 10000,
      minMomentumScore: 50,
      intervalMinutes: 15,
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

  public getState(): PaperState {
    return this.state;
  }

  public setConfig(minMomentumScore: number, intervalMinutes?: number) {
    this.config.minMomentumScore = minMomentumScore;
    this.state.minMomentumScore = minMomentumScore;
    if (intervalMinutes !== undefined) {
      this.state.intervalMinutes = intervalMinutes;
    }
    this.saveState();
    this.log(`Configurație actualizată: Scor Minim = ${minMomentumScore}${intervalMinutes !== undefined ? `, Interval = ${intervalMinutes}m` : ''}`);

    if (this.state.active && intervalMinutes !== undefined) {
      this.start(intervalMinutes);
    }
  }

  public start(intervalMinutes: number = 15) {
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
    this.log(`Paper trading started with interval ${intervalMinutes}m (min score: ${this.config.minMomentumScore}).`);
    this.saveState();

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
  }

  private async updatePositionsFast() {
    if (!this.state.active || this.state.positions.length === 0) return;
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price');
      const tickers = await res.json();
      const priceMap = new Map<string, number>();
      for (const t of tickers) {
        priceMap.set(t.symbol, parseFloat(t.price));
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

             stateChanged = true;
           }
        }
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
          breakEvenActive: false,
          currentRegime: regime
        };

        if (!pos.snapshots) {
          pos.snapshots = [];
        }
        pos.snapshots.push(snapshot);
        this.saveHourSnapshot(snapshot);

        // Check 24h timeout (MAX_HOLD = 24h)
        const elapsedHours = elapsedMinutes / 60;
        if (elapsedHours >= 24) {
          const exitPrice = currentPrice * (1 - this.config.exitSlippagePct / 100);
          const grossPnlUsdt = ((exitPrice / pos.entryPrice) - 1) * pos.sizeUSDT;
          const entryFee = pos.sizeUSDT * (this.config.entryFeePct / 100);
          const exitFee = (pos.sizeUSDT + grossPnlUsdt) * (this.config.exitFeePct / 100);
          const totalFees = entryFee + exitFee;
          const netPnL = grossPnlUsdt - totalFees;

          pos.status = 'CLOSED';
          pos.exitTimestamp = now;
          pos.exitPrice = exitPrice;
          pos.exitReason = 'TIMEOUT_24H';
          pos.realizedPnL = netPnL;
          pos.realizedPnLPct = (netPnL / pos.sizeUSDT) * 100;
          pos.grossPnL = grossPnlUsdt;
          pos.feePaid += exitFee;
          pos.durationMinutes = elapsedMinutes;

          this.state.paperBalanceUSDT += pos.sizeUSDT + netPnL;
          this.log(`[EXIT 🛑] Închidere poziție ${pos.symbol} după 24h (TIMEOUT_24H). Preț ieșire: $${exitPrice.toFixed(4)}, PnL Net: $${netPnL.toFixed(2)} (${pos.realizedPnLPct.toFixed(2)}%), Max MFE: +${pos.maxFavorableExcursion.toFixed(2)}%, Max MAE: ${pos.maxAdverseExcursion.toFixed(2)}%`);
        }
      }

      // Move closed positions to history
      const openPositions = this.state.positions.filter(p => p.status === 'OPEN');
      const newlyClosed = this.state.positions.filter(p => p.status === 'CLOSED');
      if (newlyClosed.length > 0) {
        this.state.history.unshift(...newlyClosed);
        this.state.positions = openPositions;
      }

      this.saveState();
    } catch (err: any) {
      this.log(`Eroare în bucla de monitorizare orară: ${err?.message || err}`);
    }
  }

  public async runCycle() {
    if (!this.state.active) return;
    this.log('Running paper trading cycle...');
    this.state.lastRunTimestamp = Date.now();

    try {
      const tickerRes = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      const tickers: any[] = await tickerRes.json();
      
      const liquidSymbols = tickers
        .filter(t => 
          t.symbol.endsWith('USDT') && 
          !['UPUSDT', 'DOWNUSDT', 'BULLUSDT', 'BEARUSDT'].some(e => t.symbol.includes(e)) &&
          parseFloat(t.quoteVolume || '0') >= this.config.minLiquidity24h
        )
        .map(t => t.symbol);

      const subset = liquidSymbols;
      this.log(`Univers Binance evaluat: ${liquidSymbols.length} simboluri îndeplinesc pragul de lichiditate 24h (min $${(this.config.minLiquidity24h/1e6).toFixed(1)}M).`);

      const now = Date.now();

      // 1. Scan for new signals if balance permits and we don't already have open position on symbol
      const activeSymbols = new Set(this.state.positions.map(p => p.symbol));
      const scannedResults: { symbol: string; score: number }[] = [];

      for (const symbol of subset) {
        const k15m = await fetchHistoricalKlinesForMomentum(symbol, '15m', 100);
        const k1h = await fetchHistoricalKlinesForMomentum(symbol, '1h', 50);
        const k4h = await fetchHistoricalKlinesForMomentum(symbol, '4h', 30);

        if (k15m.length < 10 || k1h.length < 10 || k4h.length < 10) continue;

        const snap = buildSynchronizedSnapshot(now, k15m, k1h, k4h);
        if (snap.kline15m.length < 2) continue;

        const scores = calculateMomentumScore(snap.kline15m, snap.kline1h, snap.kline4h);
        scannedResults.push({ symbol, score: scores.momentumScore });

        // Check if we should open position
        if (activeSymbols.has(symbol)) continue;
        if (this.state.paperBalanceUSDT < 100) continue; // Not enough balance

        if (scores.momentumScore >= this.config.minMomentumScore) {
          const entryPriceRaw = k15m[k15m.length - 1].close;
          const entryPrice = entryPriceRaw * (1 + this.config.entrySlippagePct / 100);
          const sizeUSDT = Math.min(this.state.paperBalanceUSDT * 0.1, 1000);
          const feePaid = sizeUSDT * (this.config.entryFeePct / 100);

          this.state.paperBalanceUSDT -= (sizeUSDT + feePaid);

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
          this.log(`[ENTRY 🟢] Deschis poziție paper pe ${symbol} la $${entryPrice.toFixed(4)} cu Scor Momentum ${scores.momentumScore.toFixed(1)} (RVOL: ${scores.rvol_current.toFixed(2)}, ATR Exp: ${scores.atrExpansion.toFixed(2)})`);
          
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
    }
  }
}

// Singleton instance with default baseline config
export const paperTrader = new PaperTrader({
  minLiquidity24h: 10000000,
  entryFeePct: 0.075,
  exitFeePct: 0.075,
  entrySlippagePct: 0.1,
  exitSlippagePct: 0.1,
  minMomentumScore: 50
});
