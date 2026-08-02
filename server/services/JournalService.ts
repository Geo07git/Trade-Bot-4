import fs from 'fs';
import path from 'path';

export interface JournalEntry {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  price: number;
  amount: number;
  fee: number;
  pnl: number;
  pnlPercent: number;
  mlProbability: number;
  modelName: string;
  entryReason: string;
  mode: 'paper' | 'testnet' | 'live';
  timestamp: string;
  date: string; // YYYY-MM-DD
  notes?: string;
  tradeGrade?: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  tradeQualityScore?: number;
  stars?: number;
  oppScore?: number;
}

export interface DailySnapshot {
  date: string; // YYYY-MM-DD
  equity: number;
  realizedPnL: number;
  unrealizedPnL: number;
  winRate: number;
  totalTrades: number;
  bestModel: string;
  bestStrategy: string;
  timestamp: string;
}

class JournalService {
  private journalFilePath: string;
  private snapshotsFilePath: string;
  private entries: JournalEntry[] = [];
  private snapshots: DailySnapshot[] = [];

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        console.error('Error creating data directory:', err);
      }
    }

    this.journalFilePath = path.join(dataDir, 'trading_journal.json');
    this.snapshotsFilePath = path.join(dataDir, 'daily_snapshots.json');

    this.loadData();
  }

  private loadData() {
    try {
      if (fs.existsSync(this.journalFilePath)) {
        const raw = fs.readFileSync(this.journalFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        // Clean out any legacy demo seed entries
        this.entries = Array.isArray(parsed) ? parsed.filter((e: JournalEntry) => !e.id?.startsWith('seed_')) : [];
        this.saveEntries();
      } else {
        this.entries = [];
        this.saveEntries();
      }

      if (fs.existsSync(this.snapshotsFilePath)) {
        const raw = fs.readFileSync(this.snapshotsFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.snapshots = Array.isArray(parsed) ? parsed : [];
      } else {
        this.snapshots = [];
        this.saveSnapshots();
      }
    } catch (err) {
      console.error('Error loading Journal data:', err);
      this.entries = [];
      this.snapshots = [];
      this.saveEntries();
      this.saveSnapshots();
    }
  }

  public clearSnapshots() {
    this.snapshots = [];
    this.saveSnapshots();
  }

  public clearAllEntries() {
    this.entries = [];
    this.saveEntries();
  }

  public deleteEntry(id: string): boolean {
    const prevLen = this.entries.length;
    this.entries = this.entries.filter((e) => e.id !== id);
    if (this.entries.length !== prevLen) {
      this.saveEntries();
      return true;
    }
    return false;
  }

  private saveEntries() {
    try {
      fs.writeFileSync(this.journalFilePath, JSON.stringify(this.entries, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving journal entries:', err);
    }
  }

  private saveSnapshots() {
    try {
      fs.writeFileSync(this.snapshotsFilePath, JSON.stringify(this.snapshots, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving daily snapshots:', err);
    }
  }

  public addJournalEntry(data: Omit<JournalEntry, 'id' | 'date'> & { id?: string; date?: string; symbol?: string }): JournalEntry {
    const now = new Date();
    const timestamp = data.timestamp || now.toISOString();
    const date = data.date || timestamp.split('T')[0];
    const id = data.id || `trd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const symbolStr = (data.symbol || 'USDT').toUpperCase().trim();

    const priceNum = typeof data.price === 'number' ? data.price : parseFloat(data.price || '0') || 0;
    const amountNum = typeof data.amount === 'number' ? data.amount : parseFloat(data.amount || '0') || 0;
    const feeNum = typeof data.fee === 'number' ? data.fee : parseFloat(data.fee || '0') || parseFloat((priceNum * amountNum * 0.00075).toFixed(4));
    const pnlNum = typeof data.pnl === 'number' ? data.pnl : parseFloat(data.pnl || '0') || 0;
    const pnlPercentNum = typeof data.pnlPercent === 'number' ? data.pnlPercent : parseFloat(data.pnlPercent || '0') || 0;
    const mlProb = typeof data.mlProbability === 'number' ? data.mlProbability : parseInt(data.mlProbability || '75', 10) || 75;

    const entry: JournalEntry = {
      id,
      symbol: symbolStr,
      action: data.action === 'SELL' ? 'SELL' : 'BUY',
      price: priceNum,
      amount: amountNum,
      fee: feeNum,
      pnl: pnlNum,
      pnlPercent: pnlPercentNum,
      mlProbability: mlProb,
      modelName: data.modelName || 'Random Forest Ensemble 2.0',
      entryReason: data.entryReason || 'Semnal AI Scalping',
      mode: data.mode || 'paper',
      timestamp,
      date,
      notes: data.notes || '',
      tradeGrade: data.tradeGrade || (pnlPercentNum > 0 ? 'A' : pnlPercentNum < -2 ? 'C' : 'B'),
      tradeQualityScore: data.tradeQualityScore || 80,
      stars: data.stars || 4,
      oppScore: data.oppScore || 75
    };

    this.entries.unshift(entry); // newest first
    this.saveEntries();
    return entry;
  }

  public getEntries(filters?: { symbol?: string; modelName?: string; date?: string; action?: 'BUY' | 'SELL'; mode?: string }): JournalEntry[] {
    let result = [...this.entries];

    if (filters) {
      if (filters.symbol && filters.symbol !== 'ALL') {
        result = result.filter(e => e.symbol === filters.symbol?.toUpperCase());
      }
      if (filters.modelName && filters.modelName !== 'ALL') {
        result = result.filter(e => e.modelName.toLowerCase().includes(filters.modelName!.toLowerCase()));
      }
      if (filters.action && filters.action !== ('ALL' as any)) {
        result = result.filter(e => e.action === filters.action);
      }
      if (filters.date) {
        result = result.filter(e => e.date === filters.date);
      }
      if (filters.mode && filters.mode !== 'ALL') {
        result = result.filter(e => e.mode === filters.mode);
      }
    }

    return result;
  }

  public getSnapshots(): DailySnapshot[] {
    return [...this.snapshots].sort((a, b) => b.date.localeCompare(a.date));
  }

  public recordDailySnapshot(equity: number, openPositionsPnL: number = 0): DailySnapshot {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayEntries = this.entries.filter(e => e.date === todayStr);

    const closedTrades = todayEntries.filter(e => e.action === 'SELL');
    const winTrades = closedTrades.filter(e => e.pnl > 0);
    const winRate = closedTrades.length > 0 ? parseFloat(((winTrades.length / closedTrades.length) * 100).toFixed(1)) : 0;
    const realizedPnL = closedTrades.reduce((acc, t) => acc + t.pnl, 0);

    const analytics = this.getAnalytics();

    const snapshot: DailySnapshot = {
      date: todayStr,
      equity: parseFloat(equity.toFixed(2)),
      realizedPnL: parseFloat(realizedPnL.toFixed(2)),
      unrealizedPnL: parseFloat(openPositionsPnL.toFixed(2)),
      winRate,
      totalTrades: todayEntries.length,
      bestModel: analytics.bestModel,
      bestStrategy: analytics.bestStrategy,
      timestamp: new Date().toISOString()
    };

    // Update existing or add new
    const existingIdx = this.snapshots.findIndex(s => s.date === todayStr);
    if (existingIdx !== -1) {
      this.snapshots[existingIdx] = snapshot;
    } else {
      this.snapshots.push(snapshot);
    }

    this.saveSnapshots();
    return snapshot;
  }

  public getAnalytics() {
    const totalTrades = this.entries.length;
    const closedTrades = this.entries.filter(e => e.action === 'SELL');
    const winningTrades = closedTrades.filter(e => e.pnl > 0);
    const winRate = closedTrades.length > 0 ? parseFloat(((winningTrades.length / closedTrades.length) * 100).toFixed(1)) : 0;

    const totalPnL = parseFloat(closedTrades.reduce((acc, t) => acc + t.pnl, 0).toFixed(2));
    const totalFees = parseFloat(this.entries.reduce((acc, t) => acc + t.fee, 0).toFixed(2));

    // Performance by ML Model
    const modelStats: Record<string, { total: number; closed: number; wins: number; pnl: number; probSum: number }> = {};
    const strategyStats: Record<string, { total: number; closed: number; wins: number; pnl: number }> = {};

    for (const e of this.entries) {
      // Model stats
      if (!modelStats[e.modelName]) {
        modelStats[e.modelName] = { total: 0, closed: 0, wins: 0, pnl: 0, probSum: 0 };
      }
      modelStats[e.modelName].total += 1;
      modelStats[e.modelName].probSum += e.mlProbability;

      if (e.action === 'SELL') {
        modelStats[e.modelName].closed += 1;
        if (e.pnl > 0) modelStats[e.modelName].wins += 1;
        modelStats[e.modelName].pnl += e.pnl;
      }

      // Strategy stats
      const reasonKey = e.entryReason.split(':')[0] || e.entryReason;
      if (!strategyStats[reasonKey]) {
        strategyStats[reasonKey] = { total: 0, closed: 0, wins: 0, pnl: 0 };
      }
      strategyStats[reasonKey].total += 1;
      if (e.action === 'SELL') {
        strategyStats[reasonKey].closed += 1;
        if (e.pnl > 0) strategyStats[reasonKey].wins += 1;
        strategyStats[reasonKey].pnl += e.pnl;
      }
    }

    const performanceByModel = Object.entries(modelStats).map(([model, s]) => ({
      model,
      totalTrades: s.total,
      closedTrades: s.closed,
      winRate: s.closed > 0 ? parseFloat(((s.wins / s.closed) * 100).toFixed(1)) : 0,
      totalPnL: parseFloat(s.pnl.toFixed(2)),
      avgProbability: s.total > 0 ? Math.round(s.probSum / s.total) : 0
    })).sort((a, b) => b.totalPnL - a.totalPnL);

    const performanceByStrategy = Object.entries(strategyStats).map(([strategy, s]) => ({
      strategy,
      totalTrades: s.total,
      closedTrades: s.closed,
      winRate: s.closed > 0 ? parseFloat(((s.wins / s.closed) * 100).toFixed(1)) : 0,
      totalPnL: parseFloat(s.pnl.toFixed(2))
    })).sort((a, b) => b.totalPnL - a.totalPnL);

    const bestModel = performanceByModel.length > 0 ? performanceByModel[0].model : 'XGBoost Classifier';
    const bestStrategy = performanceByStrategy.length > 0 ? performanceByStrategy[0].strategy : 'RSI Oversold + Momentum';

    return {
      totalTrades,
      closedTrades: closedTrades.length,
      winRate,
      totalPnL,
      totalFees,
      bestModel,
      bestStrategy,
      performanceByModel,
      performanceByStrategy
    };
  }

}

export const journalService = new JournalService();
