import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { botEngine } from './server/bot';
import { tradingEngine, db } from './server/engine';
import { getAccountInfo, getMyTrades, getOpenOrders } from './server/services/BinanceService';
import { journalService } from './server/services/JournalService';
import momentumBacktestRouter from './server/api/momentum-backtest';
import momentumPaperRouter from './server/api/momentum-paper';
import { paperTrader } from './server/services/momentum/PaperTrader';
import { requireAdminAuth } from './server/utils/auth';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Strict Rule: Maximum 1 position / transaction per coin across all engines
  botEngine.setExternalPositionChecker((symbol: string) => {
    return paperTrader.getState().positions.some(p => p.symbol === symbol && p.status === 'OPEN');
  });

  paperTrader.setExternalPositionChecker((symbol: string) => {
    return (botEngine.state.positions || []).some(p => p.symbol === symbol && p.amount > 0);
  });

  // Strict Capital Accounting: Momentum trades deduct from & refund to the shared bot capital
  paperTrader.setExternalBalanceHandler({
    getBalance: () => botEngine.state.balance,
    deduct: (amount: number) => {
      botEngine.state.balance = Math.max(0, parseFloat((botEngine.state.balance - amount).toFixed(4)));
      botEngine.savePersistedState(true);
    },
    refund: (amount: number) => {
      botEngine.state.balance = parseFloat((botEngine.state.balance + amount).toFixed(4));
      botEngine.savePersistedState(true);
    }
  });

  // Reconcile existing open momentum positions into botEngine.state.balance if legacy state hadn't deducted them
  try {
    const openPaperPositions = paperTrader.getState().positions?.filter(p => p.status === 'OPEN') || [];
    const totalOpenMomentumCost = openPaperPositions.reduce((acc, p) => acc + (p.sizeUSDT || 0) + (p.feePaid || 0), 0);
    const botPositionsMargin = (botEngine.state.positions || []).reduce((acc, p) => {
      if (!p.amount) return acc;
      const lev = p.leverage || 1;
      return acc + (p.margin || ((p.entryPrice * p.amount) / lev));
    }, 0);

    // If bot balance plus bot margin is approximately the initial balance, it means momentum positions were never deducted
    if (totalOpenMomentumCost > 0 && (botEngine.state.balance + botPositionsMargin) > (botEngine.state.initialBalance - 15)) {
      console.log(`[Reconcile Capital] Deducting ${totalOpenMomentumCost.toFixed(2)} USDT of existing open momentum positions from bot capital.`);
      botEngine.state.balance = Math.max(0, parseFloat((botEngine.state.balance - totalOpenMomentumCost).toFixed(4)));
      botEngine.savePersistedState(true);
    }
  } catch (err) {
    console.error('[Reconcile Capital Error]', err);
  }

  botEngine.setExternalPositionsValueProvider(() => {
    const paperPositions = paperTrader.getState().positions || [];
    return paperPositions
      .filter(p => p.status === 'OPEN')
      .reduce((acc, p) => {
        const curPrice = p.currentPrice || p.entryPrice;
        const pnl = p.entryPrice > 0 ? ((curPrice - p.entryPrice) / p.entryPrice) * p.sizeUSDT : 0;
        return acc + (p.sizeUSDT + pnl);
      }, 0);
  });

  // Momentum Routers (Backtest & Paper Trading)
  app.use('/api/momentum-paper', momentumPaperRouter);
  app.use('/api/momentum/paper', momentumPaperRouter);
  app.use('/api/momentum-backtest', momentumBacktestRouter);
  app.use('/api/momentum/backtest', momentumBacktestRouter);

  // Trading Engine & Audit Trail Endpoints
  app.get('/api/engine/status', (req, res) => {
    res.json({
      success: true,
      ...tradingEngine.getFullStatus(),
      botAutoTrading: botEngine.state.autoTradingActive,
      botBalance: botEngine.state.balance,
      botPositionsCount: botEngine.state.positions?.length || 0
    });
  });

  app.get('/api/engine/audit-events', (req, res) => {
    const { eventType, symbol, strategy, search, limit, offset, from, to } = req.query;
    const filter = {
      eventType: eventType ? String(eventType) : undefined,
      symbol: symbol ? String(symbol) : undefined,
      strategy: strategy ? String(strategy) : undefined,
      search: search ? String(search) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 100,
      offset: offset ? parseInt(String(offset), 10) : 0,
      fromTimestamp: from ? parseInt(String(from), 10) : undefined,
      toTimestamp: to ? parseInt(String(to), 10) : undefined
    };
    const result = db.getAuditEvents(filter);
    res.json({
      success: true,
      ...result,
      stats: db.getAuditStats()
    });
  });

  app.post('/api/engine/audit-events/clear', (req, res) => {
    db.clearAuditEvents();
    res.json({ success: true, message: 'Audit events cleared' });
  });

  app.post('/api/engine/reconcile', async (req, res) => {
    try {
      const syncResult = await botEngine.syncBinanceBalance();
      const reconStatus = tradingEngine.getFullStatus().reconciliation;
      res.json({
        success: true,
        reconciliation: reconStatus,
        syncResult,
        engineState: tradingEngine.getFullStatus().state
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  app.post('/api/engine/unlock-desync', (req, res) => {
    const { reason } = req.body || {};
    tradingEngine.unlockDesync(reason || 'Manual operator unlock via UI');
    res.json({
      success: true,
      status: tradingEngine.getFullStatus()
    });
  });

  app.post('/api/engine/kill-switch', async (req, res) => {
    const { reason } = req.body || {};
    botEngine.state.autoTradingActive = false;
    await tradingEngine.emergencyStop(reason || 'Kill switch triggered from TradeBot terminal');
    res.json({
      success: true,
      status: tradingEngine.getFullStatus()
    });
  });

  app.post('/api/engine/resume', async (req, res) => {
    const { reason } = req.body || {};
    botEngine.state.autoTradingActive = true;
    await tradingEngine.resumeTrading(reason || 'Trading resumed from TradeBot terminal');
    res.json({
      success: true,
      status: tradingEngine.getFullStatus()
    });
  });

  // Security helpers for Bot API
  function getSanitizedBotState() {
    const state = botEngine.state;

    // Get open positions from Momentum PaperTrader
    const paperPositions = paperTrader.getState().positions || [];
    const openMomentumPositions = paperPositions
      .filter(p => p.status === 'OPEN')
      .map(p => {
        const amt = (p.sizeUSDT && p.entryPrice) ? p.sizeUSDT / p.entryPrice : 0;
        const curPrice = p.currentPrice || p.entryPrice;
        const pnl = (curPrice - p.entryPrice) * amt;
        const pnlPct = p.entryPrice > 0 ? ((curPrice - p.entryPrice) / p.entryPrice) * 100 : 0;
        return {
          id: p.id,
          symbol: p.symbol,
          amount: amt,
          entryPrice: p.entryPrice,
          currentPrice: curPrice,
          highestPrice: p.highestPrice || curPrice,
          lowestPrice: p.entryPrice * (1 + (p.maxAdverseExcursion || 0) / 100),
          maxFavorableExcursion: p.maxFavorableExcursion || 0,
          maxAdverseExcursion: p.maxAdverseExcursion || 0,
          mfePct: p.maxFavorableExcursion || 0,
          maePct: p.maxAdverseExcursion || 0,
          trailingActive: p.trailingActive || false,
          trailingStopPrice: p.trailingStopPrice,
          stopLossPercent: 5.0,
          takeProfitPercent: undefined,
          scoreAtEntry: p.scoreAtEntry || 75,
          openedAt: p.entryTimestamp,
          shares: amt,
          pnl: pnl,
          pnlPercent: pnlPct,
          strategy: 'momentum' as const,
          entryPatternName: 'Momentum Breakout',
          leverage: 1,
          margin: p.sizeUSDT,
          status: 'OPEN'
        };
      });

    const botPositions = (state.positions || []).map(p => ({
      ...p,
      strategy: p.strategy || ((p as any)?.entryReason?.includes('Momentum') ? 'momentum' : ((p as any)?.entryReason?.includes('Manual') ? 'manual' : 'scalping'))
    }));

    // Invariantă P0: Maxim 1 tranzacție per monedă afișată și monitorizată
    const seenSymbols = new Set<string>();
    const uniqueBotPositions: any[] = [];
    for (const p of botPositions) {
      if (p.amount > 0 && !seenSymbols.has(p.symbol)) {
        seenSymbols.add(p.symbol);
        uniqueBotPositions.push(p);
      }
    }

    const uniqueMomentumPositions: any[] = [];
    for (const p of openMomentumPositions) {
      if (!seenSymbols.has(p.symbol)) {
        seenSymbols.add(p.symbol);
        uniqueMomentumPositions.push(p);
      }
    }

    const combinedPositions = [
      ...uniqueBotPositions,
      ...uniqueMomentumPositions
    ];

    // Correctly calculate total equity across all services
    const getPositionsValue = (positions: any[]) => {
      return positions.reduce((acc, pos) => {
        const lev = pos.leverage || 1;
        const margin = pos.margin || ((pos.entryPrice * (pos.amount || 0)) / lev);
        const curPrice = pos.currentPrice || pos.entryPrice;
        const pnl = (curPrice - pos.entryPrice) * (pos.amount || 0);
        return acc + (margin + pnl);
      }, 0);
    };

    // state.balance is the unified portfolio capital (debited when positions open, credited when closed)
    const totalPositionsValue = getPositionsValue(combinedPositions);
    const calculatedEquity = parseFloat(((state.balance || 0) + totalPositionsValue).toFixed(2));

    return {
      ...state,
      positions: combinedPositions,
      apiKey: state.apiKey ? '••••••••' : '',
      apiSecret: state.apiSecret ? '••••••••' : '',
      testnetApiKey: state.testnetApiKey ? '••••••••' : '',
      testnetApiSecret: state.testnetApiSecret ? '••••••••' : '',
      telegramBotToken: state.telegramBotToken ? '••••••••' : '',
      discordWebhookUrl: state.discordWebhookUrl ? '••••••••' : '',
      calculatedEquity
    };
  }


  // Background 24/7 Bot API Endpoints
  app.get('/api/bot/state', (req, res) => {
    res.json(getSanitizedBotState());
  });

  app.get('/api/bot/opportunities', (req, res) => {
    res.json({
      marketOpportunities: botEngine.state.marketOpportunities || [],
      symbolStats: botEngine.state.symbolStats || {},
      dynamicWatchlistSize: botEngine.state.dynamicWatchlistSize || 20,
      lastScanAt: botEngine.state.lastScanAt || null
    });
  });

  app.post('/api/bot/scan-opportunities', async (req, res) => {
    try {
      const opportunities = await botEngine.scanMarketOpportunities();
      res.json({
        success: true,
        marketOpportunities: opportunities,
        symbolStats: botEngine.state.symbolStats || {},
        lastScanAt: botEngine.state.lastScanAt
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error scanning market opportunities' });
    }
  });

  app.post('/api/bot/config', requireAdminAuth, (req, res) => {
    botEngine.updateConfig(req.body);
    res.json({ success: true, state: getSanitizedBotState() });
  });

  app.post('/api/bot/reset', requireAdminAuth, (req, res) => {
    const { balance } = req.body;
    const newBalance = balance || 10000;
    botEngine.resetPortfolio(newBalance);
    paperTrader.resetState(newBalance);
    res.json({ success: true, state: getSanitizedBotState() });
  });

  app.post('/api/bot/add-funds', requireAdminAuth, (req, res) => {
    const { amount } = req.body;
    const added = parseFloat(amount);
    if (!isNaN(added) && added > 0) {
      botEngine.addFunds(added);
    }
    res.json({ success: true, state: getSanitizedBotState(), calculatedEquity: botEngine.calculateEquity() });
  });

  app.post('/api/bot/clear-logs', requireAdminAuth, (req, res) => {
    botEngine.clearLogs();
    res.json({ success: true, state: getSanitizedBotState() });
  });

  app.post('/api/bot/clear-signal-journal', requireAdminAuth, (req, res) => {
    botEngine.clearSignalJournal();
    res.json({ success: true, state: getSanitizedBotState() });
  });

  app.post('/api/bot/reset-circuit-breaker', requireAdminAuth, (req, res) => {
    botEngine.resetCircuitBreaker();
    res.json({ success: true, state: getSanitizedBotState() });
  });

  app.all('/api/bot/pulse', (req, res) => {
    const pulseData = botEngine.triggerPulseCheck();
    res.json({ success: true, ...pulseData, state: getSanitizedBotState() });
  });

  app.post('/api/bot/send-telegram-guide', requireAdminAuth, async (req, res) => {
    const { chatId, botToken } = req.body || {};
    if (botToken) {
      botEngine.updateConfig({ telegramBotToken: botToken, telegramChatId: chatId });
    }
    const result = await botEngine.sendTelegramCommandGuide(chatId, true);
    res.json(result);
  });

  app.post('/api/bot/sync-binance', requireAdminAuth, async (req, res) => {
    const result = await botEngine.syncBinanceBalance();
    res.json({ ...result, state: getSanitizedBotState(), calculatedEquity: botEngine.calculateEquity() });
  });

  app.post('/api/bot/consolidate-accumulation', requireAdminAuth, (req, res) => {
    const result = botEngine.consolidateAccumulation();
    res.json({ ...result, state: getSanitizedBotState(), calculatedEquity: botEngine.calculateEquity() });
  });

  app.post('/api/bot/reset-accumulation', requireAdminAuth, (req, res) => {
    const result = botEngine.resetAccumulationVault();
    res.json({ ...result, state: getSanitizedBotState(), calculatedEquity: botEngine.calculateEquity() });
  });

  app.post('/api/bot/trade', requireAdminAuth, async (req, res) => {
    try {
      const { symbol, action, price, amount } = req.body;
      if (symbol && action && price !== undefined && amount !== undefined) {
        await botEngine.executeTrade(symbol, action, Number(price), Number(amount));
        return res.json({ success: true, state: getSanitizedBotState(), calculatedEquity: botEngine.calculateEquity() });
      }
      res.status(400).json({ success: false, error: 'Missing required parameters (symbol, action, price, amount)' });
    } catch (err: any) {
      console.error('[API /api/bot/trade Error]', err?.message || err);
      res.status(500).json({ success: false, error: err?.message || 'Trade execution failed' });
    }
  });

  app.post('/api/bot/close-position', requireAdminAuth, async (req, res) => {
    try {
      const { symbol } = req.body || {};
      if (!symbol) {
        return res.status(400).json({ success: false, error: 'Symbol is required' });
      }

      let closedSomething = false;

      // 1. Try closing in Momentum PaperTrader
      try {
        const paperResult = await paperTrader.closePositionManual(symbol);
        if (paperResult) {
          closedSomething = true;
        }
      } catch (e) {
        console.warn(`[API /api/bot/close-position] Paper trader close warning for ${symbol}:`, e);
      }

      // 2. Try closing in BotEngine
      const pos = botEngine.state.positions.find(p => p.symbol === symbol);
      if (pos && pos.amount > 0) {
        let livePrice = pos.currentPrice || pos.entryPrice;
        try {
          const pRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
          const pData = await pRes.json();
          if (pData && pData.price) livePrice = parseFloat(pData.price);
        } catch {}

        await botEngine.executeTrade(symbol, 'SELL', livePrice, pos.amount, {
          entryReason: 'Manual Operator Close [MANUAL CLOSE]',
          notes: `Position closed manually by operator | Strategy was ${pos.strategy || 'scalping'}`,
          strategy: 'manual'
        });
        closedSomething = true;
      }

      if (!closedSomething) {
        return res.status(404).json({ success: false, error: `No open position found for ${symbol}` });
      }

      res.json({
        success: true,
        message: `Position for ${symbol} successfully closed manually.`,
        state: getSanitizedBotState(),
        calculatedEquity: botEngine.calculateEquity()
      });
    } catch (err: any) {
      console.error('[API /api/bot/close-position Error]', err?.message || err);
      res.status(500).json({ success: false, error: err?.message || 'Manual close failed' });
    }
  });

  // Dedicated Binance Service Routes (Account Info & Trade History & 24hr Ticker)
  app.get('/api/binance/ticker24hr', async (req, res) => {
    const endpoints = [
      'https://api.binance.com/api/v3/ticker/24hr',
      'https://data-api.binance.vision/api/v3/ticker/24hr',
      'https://api1.binance.com/api/v3/ticker/24hr',
      'https://api3.binance.com/api/v3/ticker/24hr'
    ];
    for (const url of endpoints) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            return res.json({ success: true, tickers: data });
          }
        }
      } catch {
        // try next endpoint
      }
    }
    res.status(500).json({ success: false, error: 'Failed to fetch 24hr ticker data' });
  });

  app.get('/api/binance/account', async (req, res) => {
    try {
      const mode = botEngine.state.binanceMode;
      const apiKey = (mode === 'testnet' ? (botEngine.state.testnetApiKey || botEngine.state.apiKey) : botEngine.state.apiKey)?.trim();
      const apiSecret = (mode === 'testnet' ? (botEngine.state.testnetApiSecret || botEngine.state.apiSecret) : botEngine.state.apiSecret)?.trim();

      if (!apiKey || !apiSecret) {
        return res.status(400).json({ success: false, error: 'Cheile API Binance nu sunt configurate în setări.' });
      }

      const info = await getAccountInfo({ apiKey, apiSecret, mode });
      res.json({ success: true, mode, account: info });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la preluarea contului Binance' });
    }
  });

  app.get('/api/binance/trades', async (req, res) => {
    try {
      const symbol = (req.query.symbol as string) || 'BTCUSDT';
      const mode = botEngine.state.binanceMode;
      const apiKey = (mode === 'testnet' ? (botEngine.state.testnetApiKey || botEngine.state.apiKey) : botEngine.state.apiKey)?.trim();
      const apiSecret = (mode === 'testnet' ? (botEngine.state.testnetApiSecret || botEngine.state.apiSecret) : botEngine.state.apiSecret)?.trim();

      if (!apiKey || !apiSecret) {
        return res.status(400).json({ success: false, error: 'Cheile API Binance nu sunt configurate în setări.' });
      }

      const trades = await getMyTrades(symbol, { apiKey, apiSecret, mode });
      res.json({ success: true, mode, symbol, trades });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la preluarea istoricului de tranzacții Binance' });
    }
  });

  // Trading Journal API Endpoints
  app.get('/api/journal/entries', (req, res) => {
    try {
      const { symbol, modelName, date, action, mode } = req.query;
      const entries = journalService.getEntries({
        symbol: symbol as string,
        modelName: modelName as string,
        date: date as string,
        action: action as any,
        mode: mode as string
      });
      res.json({ success: true, count: entries.length, entries });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la preluarea jurnalului de tranzacționare' });
    }
  });

  app.post('/api/journal/entry', (req, res) => {
    try {
      const entry = journalService.addJournalEntry(req.body);
      res.json({ success: true, entry });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la salvarea tranzacției în jurnal' });
    }
  });

  app.get('/api/journal/daily-snapshots', (req, res) => {
    try {
      const snapshots = journalService.getSnapshots();
      res.json({ success: true, snapshots });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la preluarea snapshot-urilor zilnice' });
    }
  });

  app.post('/api/journal/clear-snapshots', (req, res) => {
    try {
      journalService.clearSnapshots();
      res.json({ success: true, message: 'Rapoartele zilnice și istoricul equity au fost șterse cu succes.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la ștergerea rapoartelor zilnice' });
    }
  });

  app.post('/api/journal/clear-entries', (req, res) => {
    try {
      journalService.clearAllEntries();
      botEngine.state.tradeHistory = [];
      botEngine.savePersistedState(true);
      res.json({ success: true, message: 'Jurnalul de tranzacții a fost șters cu succes.', state: botEngine.state });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la ștergerea jurnalului' });
    }
  });

  app.post('/api/journal/delete-entry', (req, res) => {
    try {
      const { id, symbol, timestamp } = req.body || {};
      if (id) {
        journalService.deleteEntry(id);
      }
      if (botEngine?.state?.tradeHistory) {
        botEngine.state.tradeHistory = botEngine.state.tradeHistory.filter((t: any, idx: number) => {
          const tId = `store_trade_${idx}_${t.symbol}`;
          if (id && (tId === id || t.id === id)) return false;
          if (symbol && timestamp && t.symbol === symbol && t.timestamp === timestamp) return false;
          return true;
        });
        botEngine.savePersistedState(true);
      }
      res.json({ success: true, message: 'Tranzacția a fost ștearsă cu succes.', state: botEngine.state });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la ștergerea tranzacției' });
    }
  });

  app.get('/api/journal/analytics', (req, res) => {
    try {
      const analytics = journalService.getAnalytics();
      res.json({ success: true, analytics });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la calcularea metricilor jurnalului' });
    }
  });

  // Smart AI Grid Bot API Routes
  app.use('/api/momentum', momentumBacktestRouter);
  app.use('/api/momentum/paper', momentumPaperRouter);

  app.post('/api/grid-bot/config', (req, res) => {
    try {
      const { 
        gridLevels, rangePercent, highVolMultiplier, capitalPerGridPercent, 
        autoRegimeSwitch, active, gridMode, dynamicCapital, rangeThresholdProb,
        enableCapitalRotation, minRotationHoldMinutes, minOppScoreDiff, stagnantProfitMaxPct
      } = req.body || {};
      
      if (!botEngine.state.gridConfig) {
        botEngine.state.gridConfig = {
          active: true,
          autoRegimeSwitch: true,
          gridMode: 'dynamic_atr',
          gridLevels: 6,
          rangePercent: 2.5,
          highVolMultiplier: 1.8,
          capitalPerGridPercent: 15,
          dynamicCapital: true,
          rangeThresholdProb: 75,
          enableCapitalRotation: true,
          minRotationHoldMinutes: 90,
          minOppScoreDiff: 15,
          stagnantProfitMaxPct: 0.30
        };
      }

      if (gridLevels !== undefined) botEngine.state.gridConfig.gridLevels = Number(gridLevels);
      if (rangePercent !== undefined) botEngine.state.gridConfig.rangePercent = Number(rangePercent);
      if (highVolMultiplier !== undefined) botEngine.state.gridConfig.highVolMultiplier = Number(highVolMultiplier);
      if (capitalPerGridPercent !== undefined) botEngine.state.gridConfig.capitalPerGridPercent = Number(capitalPerGridPercent);
      if (autoRegimeSwitch !== undefined) botEngine.state.gridConfig.autoRegimeSwitch = !!autoRegimeSwitch;
      if (gridMode !== undefined) botEngine.state.gridConfig.gridMode = gridMode;
      if (dynamicCapital !== undefined) botEngine.state.gridConfig.dynamicCapital = !!dynamicCapital;
      if (rangeThresholdProb !== undefined) botEngine.state.gridConfig.rangeThresholdProb = Number(rangeThresholdProb);
      if (enableCapitalRotation !== undefined) botEngine.state.gridConfig.enableCapitalRotation = !!enableCapitalRotation;
      if (minRotationHoldMinutes !== undefined) botEngine.state.gridConfig.minRotationHoldMinutes = Number(minRotationHoldMinutes);
      if (minOppScoreDiff !== undefined) botEngine.state.gridConfig.minOppScoreDiff = Number(minOppScoreDiff);
      if (stagnantProfitMaxPct !== undefined) botEngine.state.gridConfig.stagnantProfitMaxPct = Number(stagnantProfitMaxPct);

      if (active !== undefined) {
        botEngine.state.gridConfig.active = !!active;
        botEngine.state.smartGridActive = !!active;
      }

      botEngine.addLog(`[Smart AI Grid Configuration] Parametrii Grid-ului au fost actualizați (Mode: ${botEngine.state.gridConfig.gridMode}, Levels: ${botEngine.state.gridConfig.gridLevels}, Rotation Engine: ${botEngine.state.gridConfig.enableCapitalRotation ? 'ACTIV' : 'INACTIV'}).`, 'info');
      botEngine.savePersistedState(true);

      res.json({ success: true, gridConfig: botEngine.state.gridConfig, smartGridActive: botEngine.state.smartGridActive });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la salvarea configurației Grid' });
    }
  });

  app.post('/api/grid-bot/toggle', (req, res) => {
    try {
      const { active } = req.body || {};
      const newActive = active !== undefined ? !!active : !botEngine.state.smartGridActive;
      botEngine.state.smartGridActive = newActive;
      if (botEngine.state.gridConfig) {
        botEngine.state.gridConfig.active = newActive;
      }
      botEngine.addLog(`[Smart AI Grid Bot] Sistemul Smart Grid este acum ${newActive ? 'ACTIVAT 🟢' : 'DEZACTIVAT 🔴'}.`, newActive ? 'success' : 'warning');
      botEngine.savePersistedState(true);

      res.json({ success: true, smartGridActive: newActive, state: botEngine.state });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la comutarea stării Smart Grid' });
    }
  });

  app.post('/api/grid-bot/reset', (req, res) => {
    try {
      botEngine.state.gridHistory = [];
      if (botEngine.state.smartGridStatus) {
        botEngine.state.smartGridStatus.forEach(s => {
          s.executedGridTrades = 0;
          s.gridProfit = 0;
          s.lastAction = 'Resetat Manual';
        });
      }
      botEngine.addLog(`[Smart AI Grid Bot] Istoricul și statisticile Grid au fost resetate.`, 'info');
      botEngine.savePersistedState(true);

      res.json({ success: true, message: 'Grid-ul a fost resetat.', state: botEngine.state });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la resetarea istoricului Grid' });
    }
  });

  // Scalping AI Engine API Routes
  app.post('/api/scalping-bot/config', (req, res) => {
    try {
      if (!botEngine.state.scalpingConfig) {
        botEngine.state.scalpingConfig = {
          active: true,
          timeframe: '1m',
          minRfProb: 90,
          minMetaScore: 80,
          stopLossPercent: 5.0,
          targetTakeProfit: 0,
          trailingStopActivation: 3.0,
          trailingStopDistance: 0.5,
          breakEvenActivation: 2.0,
          positionSizePercent: 5.0,
          maxHoldMinutes: 120,
          maxNegativeHoldMinutes: 0.0,
          enableMaxNegativeHold: false,
          minOpportunityScore: 50,
          cooldownMinutes: 5,
          enableDynamicSizing: false,
          minVolumeGrowth: 0.8,
          enableStagnationFilter: false,
          minAtrPctThreshold: 0.12,
          minRange20pThreshold: 0.38,
          leverage: 1,
          activePreset: 'Free'
        };
      }

      const body = req.body || {};
      
      // Merge all provided parameters into scalpingConfig
      for (const [key, val] of Object.entries(body)) {
        if (val !== undefined) {
          (botEngine.state.scalpingConfig as any)[key] = val;
        }
      }

      // Sync top-level mirror fields if present
      if (body.stopLossPercent !== undefined) {
        botEngine.state.stopLossPercent = Number(body.stopLossPercent);
        botEngine.state.scalpingConfig.stopLossPercent = Number(body.stopLossPercent);
      }
      if (body.maxHoldMinutes !== undefined) {
        botEngine.state.maxHoldMinutes = Number(body.maxHoldMinutes);
        botEngine.state.scalpingConfig.maxHoldMinutes = Number(body.maxHoldMinutes);
      }
      if (body.positionSizePercent !== undefined) {
        botEngine.state.positionSizePercent = Number(body.positionSizePercent);
        botEngine.state.scalpingConfig.positionSizePercent = Number(body.positionSizePercent);
      }
      if (body.leverage !== undefined) {
        botEngine.state.scalpingConfig.leverage = Math.max(1, Math.min(50, Number(body.leverage)));
      }

      botEngine.addLog(
        `[Motor Scalping Configuration] Parametrii actualizați: TF ${botEngine.state.scalpingConfig.timeframe}, RF Min ${botEngine.state.scalpingConfig.minRfProb}%, SL ${botEngine.state.scalpingConfig.stopLossPercent}%, TP ${botEngine.state.scalpingConfig.targetTakeProfit}%, Levier ${botEngine.state.scalpingConfig.leverage || 1}x.`,
        'info'
      );
      botEngine.savePersistedState(true);

      res.json({ success: true, scalpingConfig: botEngine.state.scalpingConfig });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la salvarea configurației Scalping' });
    }
  });

  app.post('/api/scalping-bot/toggle', (req, res) => {
    try {
      const { active } = req.body || {};
      if (!botEngine.state.scalpingConfig) {
        botEngine.state.scalpingConfig = {
          active: true,
          minRfProb: 50,
          minMetaScore: 50,
          stopLossPercent: 2.0,
          targetTakeProfit: 1.2,
          trailingStopActivation: 1.2,
          trailingStopDistance: 0.5,
          breakEvenActivation: 1.0,
          positionSizePercent: 5.0,
          maxHoldMinutes: 15,
          minOpportunityScore: 55,
          cooldownMinutes: 8,
          enableDynamicSizing: true,
          minVolumeGrowth: 0.8, timeframe: "1m", minAtrPctThreshold: 0.05, minRange20pThreshold: 0.20, leverage: 1
        };
      }

      const newActive = active !== undefined ? !!active : !botEngine.state.scalpingConfig.active;
      botEngine.state.scalpingConfig.active = newActive;

      botEngine.addLog(`[Motor Scalping] Modulul de Scalping ML este acum ${newActive ? 'ACTIVAT 🟢' : 'DEZACTIVAT 🔴'}.`, newActive ? 'success' : 'warning');
      botEngine.savePersistedState(true);

      res.json({ success: true, scalpingActive: newActive, scalpingConfig: botEngine.state.scalpingConfig, state: botEngine.state });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la comutarea stării Scalping' });
    }
  });

  app.post('/api/scalping-bot/reset', (req, res) => {
    try {
      botEngine.addLog(`[Motor Scalping] Parametrii și istoricul scalping au fost resetate la valorile implicite.`, 'info');
      botEngine.state.scalpingConfig = {
        active: true,
        minRfProb: 50,
        minMetaScore: 50,
        stopLossPercent: 2.0,
        targetTakeProfit: 1.2,
        trailingStopActivation: 1.2,
        trailingStopDistance: 0.5,
        breakEvenActivation: 1.0,
        positionSizePercent: 5.0,
        maxHoldMinutes: 15,
        minOpportunityScore: 55,
        cooldownMinutes: 8,
        enableDynamicSizing: true,
        minVolumeGrowth: 0.8, timeframe: "1m", minAtrPctThreshold: 0.05, minRange20pThreshold: 0.20, leverage: 1
      };
      botEngine.savePersistedState(true);

      res.json({ success: true, message: 'Motorul de scalping a fost resetat.', scalpingConfig: botEngine.state.scalpingConfig, state: botEngine.state });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la resetarea motorului de scalping' });
    }
  });

  // Live Multi-Source Crypto & Binance News API Route (Disabled to save API & CPU resources)
  app.get('/api/news', (req, res) => {
    res.json({ success: true, articles: [] });
  });

  // API Route for AI Analysis
  app.post('/api/analyze', async (req, res) => {
    try {
      const { prompt, context, geminiApiKey } = req.body;
      const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: 'Missing API key. Configure it in Settings.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: `You are an AI trading analyst system. Analyze the following market context and answer the user's prompt.  
If the user is asking for analysis on a specific asset or a trading signal, you MUST reply in the following EXACT Markdown format, replacing the bracketed values with your calculated data:

[Asset Symbol]

Recommendation:
[BUY / SELL / HOLD]

Confidence:
[e.g., 89%]

Probability of upward movement:
[e.g., 81%]

Current Price:
[$ Value]

Target:
[$ Value]

Stop Loss:
[$ Value]

Risk/Reward:
[Value]

Trend:
[Bullish / Bearish / Neutral]

Indicators

[Indicator 1 Name] ✔
[Indicator 2 Name] ✔
[Indicator 3 Name] ✖
[Indicator 4 Name] ✔
[Indicator 5 Name] ✔

Suggested Allocation

[Value]% of available capital

Reason

[1-2 sentences explaining the reasoning, referencing the indicators and market context.]

AI Confidence Engine

XGBoost      [BUY/SELL]   [XX]%
LightGBM     [BUY/SELL]   [XX]%
RandomForest [BUY/SELL]   [XX]%
Average      [XX]%

If the user is NOT asking for an asset analysis (e.g. asking a general question), just answer succinctly and professionally in a direct tone.

Context:
${context}

User prompt:
${prompt}`,
      });

      const inputTokens = response.usageMetadata?.promptTokenCount || 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;

      console.log(`Live Usage -> Input: ${inputTokens} | Output: ${outputTokens}`);

      botEngine.recordAiUsage(inputTokens, outputTokens);

      res.json({
        result: response.text,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens
        }
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const candidatePaths = [
      __dirname,
      path.join(__dirname, 'dist'),
      path.join(process.cwd(), 'dist')
    ];
    const distPath = candidatePaths.find(p => fs.existsSync(path.join(p, 'index.html'))) || path.join(process.cwd(), 'dist');
    console.log(`[Server] Serving static frontend files from: ${distPath}`);

    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Transition trading engine to TRADING on server startup
  await tradingEngine.resumeTrading('Server startup active');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
