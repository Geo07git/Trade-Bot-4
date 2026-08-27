import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { botEngine } from './server/bot';
import { getAccountInfo, getMyTrades, getOpenOrders } from './server/services/BinanceService';
import { journalService } from './server/services/JournalService';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Background 24/7 Bot API Endpoints
  app.get('/api/bot/state', (req, res) => {
    res.json({
      ...botEngine.state,
      calculatedEquity: botEngine.calculateEquity()
    });
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

  app.post('/api/bot/config', (req, res) => {
    botEngine.updateConfig(req.body);
    res.json({ success: true, state: botEngine.state });
  });

  app.post('/api/bot/reset', (req, res) => {
    const { balance } = req.body;
    botEngine.resetPortfolio(balance || 10000);
    res.json({ success: true, state: botEngine.state });
  });

  app.post('/api/bot/add-funds', (req, res) => {
    const { amount } = req.body;
    const added = parseFloat(amount);
    if (!isNaN(added) && added > 0) {
      botEngine.addFunds(added);
    }
    res.json({ success: true, state: botEngine.state, calculatedEquity: botEngine.calculateEquity() });
  });

  app.post('/api/bot/clear-logs', (req, res) => {
    botEngine.clearLogs();
    res.json({ success: true, state: botEngine.state });
  });

  app.post('/api/bot/clear-signal-journal', (req, res) => {
    botEngine.clearSignalJournal();
    res.json({ success: true, state: botEngine.state });
  });

  app.post('/api/bot/reset-circuit-breaker', (req, res) => {
    botEngine.resetCircuitBreaker();
    res.json({ success: true, state: botEngine.state });
  });

  app.all('/api/bot/pulse', (req, res) => {
    const pulseData = botEngine.triggerPulseCheck();
    res.json({ success: true, ...pulseData, state: botEngine.state });
  });

  app.post('/api/bot/send-telegram-guide', async (req, res) => {
    const { chatId, botToken } = req.body || {};
    if (botToken) {
      botEngine.updateConfig({ telegramBotToken: botToken, telegramChatId: chatId });
    }
    const result = await botEngine.sendTelegramCommandGuide(chatId, true);
    res.json(result);
  });

  app.post('/api/bot/sync-binance', async (req, res) => {
    const result = await botEngine.syncBinanceBalance();
    res.json({ ...result, state: botEngine.state, calculatedEquity: botEngine.calculateEquity() });
  });

  app.post('/api/bot/consolidate-accumulation', (req, res) => {
    const result = botEngine.consolidateAccumulation();
    res.json({ ...result, state: botEngine.state, calculatedEquity: botEngine.calculateEquity() });
  });

  app.post('/api/bot/reset-accumulation', (req, res) => {
    const result = botEngine.resetAccumulationVault();
    res.json({ ...result, state: botEngine.state, calculatedEquity: botEngine.calculateEquity() });
  });

  app.post('/api/bot/trade', async (req, res) => {
    try {
      const { symbol, action, price, amount } = req.body;
      if (symbol && action && price !== undefined && amount !== undefined) {
        await botEngine.executeTrade(symbol, action, Number(price), Number(amount));
        return res.json({ success: true, state: botEngine.state, calculatedEquity: botEngine.calculateEquity() });
      }
      res.status(400).json({ success: false, error: 'Missing required parameters (symbol, action, price, amount)' });
    } catch (err: any) {
      console.error('[API /api/bot/trade Error]', err?.message || err);
      res.status(500).json({ success: false, error: err?.message || 'Trade execution failed' });
    }
  });

  // Dedicated Binance Service Routes (Account Info & Trade History)
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
      const {
        active,
        minRfProb,
        minMetaScore,
        stopLossPercent,
        targetTakeProfit,
        trailingStopActivation,
        trailingStopDistance,
        breakEvenActivation,
        positionSizePercent,
        maxHoldMinutes,
        maxNegativeHoldMinutes,
        enableMaxNegativeHold,
        minOpportunityScore,
        cooldownMinutes,
        enableDynamicSizing,
        minVolumeGrowth,
        leverage
      } = req.body || {};

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

      if (active !== undefined) botEngine.state.scalpingConfig.active = !!active;
      if (minRfProb !== undefined) botEngine.state.scalpingConfig.minRfProb = Number(minRfProb);
      if (minMetaScore !== undefined) botEngine.state.scalpingConfig.minMetaScore = Number(minMetaScore);
      if (stopLossPercent !== undefined) {
        botEngine.state.scalpingConfig.stopLossPercent = Number(stopLossPercent);
        botEngine.state.stopLossPercent = Number(stopLossPercent);
      }
      if (targetTakeProfit !== undefined) botEngine.state.scalpingConfig.targetTakeProfit = Number(targetTakeProfit);
      if (trailingStopActivation !== undefined) botEngine.state.scalpingConfig.trailingStopActivation = Number(trailingStopActivation);
      if (trailingStopDistance !== undefined) botEngine.state.scalpingConfig.trailingStopDistance = Number(trailingStopDistance);
      if (breakEvenActivation !== undefined) botEngine.state.scalpingConfig.breakEvenActivation = Number(breakEvenActivation);
      if (positionSizePercent !== undefined) {
        botEngine.state.scalpingConfig.positionSizePercent = Number(positionSizePercent);
        botEngine.state.positionSizePercent = Number(positionSizePercent);
      }
      if (maxHoldMinutes !== undefined) {
        botEngine.state.scalpingConfig.maxHoldMinutes = Number(maxHoldMinutes);
        botEngine.state.maxHoldMinutes = Number(maxHoldMinutes);
      }
      if (maxNegativeHoldMinutes !== undefined) {
        botEngine.state.scalpingConfig.maxNegativeHoldMinutes = Number(maxNegativeHoldMinutes);
      }
      if (enableMaxNegativeHold !== undefined) {
        botEngine.state.scalpingConfig.enableMaxNegativeHold = !!enableMaxNegativeHold;
      }
      if (minOpportunityScore !== undefined) botEngine.state.scalpingConfig.minOpportunityScore = Number(minOpportunityScore);
      if (cooldownMinutes !== undefined) botEngine.state.scalpingConfig.cooldownMinutes = Number(cooldownMinutes);
      if (enableDynamicSizing !== undefined) botEngine.state.scalpingConfig.enableDynamicSizing = !!enableDynamicSizing;
      if (minVolumeGrowth !== undefined) botEngine.state.scalpingConfig.minVolumeGrowth = Number(minVolumeGrowth);
      if (leverage !== undefined) botEngine.state.scalpingConfig.leverage = Math.max(1, Math.min(50, Number(leverage)));

      botEngine.addLog(
        `[Motor Scalping Configuration] Parametrii au fost actualizați: RF Min ${botEngine.state.scalpingConfig.minRfProb}%, MetaScore Min ${botEngine.state.scalpingConfig.minMetaScore}, SL ${botEngine.state.scalpingConfig.stopLossPercent}%, TP ${botEngine.state.scalpingConfig.targetTakeProfit}%, Trail Activation ${botEngine.state.scalpingConfig.trailingStopActivation}%, Trail Dist ${botEngine.state.scalpingConfig.trailingStopDistance}%, Hold Max ${botEngine.state.scalpingConfig.maxHoldMinutes}m, Size ${botEngine.state.scalpingConfig.positionSizePercent}%.`,
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
