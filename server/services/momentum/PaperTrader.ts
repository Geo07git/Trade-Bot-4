import fs from 'fs';
import path from 'path';
import { getBinanceUniverse, filterCandidatesByLiquidity } from './Universe';
import { fetchHistoricalKlinesForMomentum, buildSynchronizedSnapshot } from './DataFetcher';
import { calculateMomentumScore } from './Scorer';
import { MomentumConfig } from './types';

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
  realizedPnL?: number;
  realizedPnLPct?: number;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
}

export interface PaperState {
  active: boolean;
  paperBalanceUSDT: number;
  startingBalanceUSDT: number;
  positions: PaperPosition[];
  history: PaperPosition[];
  lastRunTimestamp: number;
  logs: { timestamp: number; message: string }[];
}

const STATE_FILE = path.join(process.cwd(), 'server', 'data', 'momentum_paper_state.json');

export class PaperTrader {
  private config: MomentumConfig;
  private state: PaperState;
  private timer: NodeJS.Timeout | null = null;

  constructor(config: MomentumConfig) {
    this.config = config;
    this.state = this.loadState();
    
    if (this.state.active) {
      this.log('Reactivating paper trading from state...');
      this.start();
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

  private log(message: string) {
    const entry = { timestamp: Date.now(), message };
    console.log(`[PaperTrader] ${message}`);
    this.state.logs.unshift(entry);
    if (this.state.logs.length > 100) {
      this.state.logs.pop();
    }
  }

  public getState(): PaperState {
    return this.state;
  }

  public start(intervalMinutes: number = 15) {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.state.active = true;
    this.log(`Paper trading started with interval ${intervalMinutes}m.`);
    this.saveState();

    // Run immediately once, then schedule
    this.runCycle();
    this.timer = setInterval(() => {
      this.runCycle();
    }, intervalMinutes * 60 * 1000);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state.active = false;
    this.log('Paper trading stopped.');
    this.saveState();
  }

  public async runCycle() {
    if (!this.state.active) return;
    this.log('Running paper trading cycle...');
    this.state.lastRunTimestamp = Date.now();

    try {
      // Fetch 24h tickers for all symbols in 1 request to filter by liquidity across the entire Binance universe
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
      this.log(`Lista simboluri: ${liquidSymbols.join(', ')}`);

      const now = Date.now();

      // 1. Update existing open positions (check MFE/MAE and 24h expiration)
      for (const pos of this.state.positions) {
        if (pos.status === 'OPEN') {
          const klines = await fetchHistoricalKlinesForMomentum(pos.symbol, '15m', 50);
          if (klines.length > 0) {
            const currentPrice = klines[klines.length - 1].close;
            
            // Update MFE / MAE
            const pctMove = ((currentPrice / pos.entryPrice) - 1) * 100;
            pos.maxFavorableExcursion = Math.max(pos.maxFavorableExcursion, pctMove);
            pos.maxAdverseExcursion = Math.min(pos.maxAdverseExcursion, pctMove);

            // Check if 24 hours passed
            const elapsedHours = (now - pos.entryTimestamp) / (1000 * 60 * 60);
            if (elapsedHours >= 24) {
              // Close position
              const exitRaw = currentPrice;
              const exitPrice = exitRaw * (1 - this.config.exitSlippagePct / 100);
              const pnlRaw = (exitPrice / pos.entryPrice) - 1;
              const netPnL = (pnlRaw * (1 - this.config.entryFeePct / 100 - this.config.exitFeePct / 100)) * pos.sizeUSDT;

              pos.status = 'CLOSED';
              pos.exitTimestamp = now;
              pos.exitPrice = exitPrice;
              pos.realizedPnL = netPnL;
              pos.realizedPnLPct = (netPnL / pos.sizeUSDT) * 100;

              this.state.paperBalanceUSDT += pos.sizeUSDT + netPnL;
              this.log(`Closed paper position on ${pos.symbol} after 24h. PnL: ${pos.realizedPnLPct.toFixed(2)}%`);
            }
          }
        }
      }

      // Move closed positions to history
      const openPositions = this.state.positions.filter(p => p.status === 'OPEN');
      const newlyClosed = this.state.positions.filter(p => p.status === 'CLOSED');
      this.state.history.unshift(...newlyClosed);
      this.state.positions = openPositions;

      // 2. Scan for new signals if balance permits and we don't already have open position on symbol
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
          // Open paper position
          const entryPriceRaw = k15m[k15m.length - 1].close; // Simulated at latest closed candle close / next open
          const entryPrice = entryPriceRaw * (1 + this.config.entrySlippagePct / 100);
          const sizeUSDT = Math.min(this.state.paperBalanceUSDT * 0.1, 1000); // Allocate 10% of balance or max $1000
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
            maxAdverseExcursion: 0
          };

          this.state.positions.push(newPos);
          this.log(`Opened paper position on ${symbol} at $${entryPrice.toFixed(4)} with Score ${scores.momentumScore.toFixed(1)}`);
        }
      }

      // Sort scanned results descending by score for top summary
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
