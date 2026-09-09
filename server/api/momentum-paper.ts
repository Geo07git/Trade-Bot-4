import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { paperTrader } from '../services/momentum/PaperTrader';

const router = Router();

// Reset paper trading state
router.post('/reset', (req, res) => {
  const { balance } = req.body;
  console.log('[API] Resetting momentum paper state...');
  try {
    paperTrader.resetState(balance || 1000);
    res.json({ success: true, message: 'Simulator reset successfully', state: paperTrader.getState() });
  } catch (err: any) {
    console.error('[API] Reset error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get paper trading state & stats
router.get('/status', (req, res) => {
  try {
    const state = paperTrader.getState();
    res.json({
      success: true,
      state
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update paper trading config (parameters engine)
router.post('/config', (req, res) => {
  try {
    const { 
      minMomentumScore, 
      intervalMinutes,
      trailingActivationPct,
      trailingDistancePct,
      hardStopLossPct,
      maxHoldMinutes,
      takeProfitPct,
      positionAllocationPct
    } = req.body;

    paperTrader.setConfig({
      minMomentumScore: minMomentumScore !== undefined ? Number(minMomentumScore) : undefined,
      intervalMinutes: intervalMinutes !== undefined ? Number(intervalMinutes) : undefined,
      trailingActivationPct: trailingActivationPct !== undefined ? Number(trailingActivationPct) : undefined,
      trailingDistancePct: trailingDistancePct !== undefined ? Number(trailingDistancePct) : undefined,
      hardStopLossPct: hardStopLossPct !== undefined ? Number(hardStopLossPct) : undefined,
      maxHoldMinutes: maxHoldMinutes !== undefined ? Number(maxHoldMinutes) : undefined,
      takeProfitPct: takeProfitPct !== undefined ? (takeProfitPct === null ? null : Number(takeProfitPct)) : undefined,
      positionAllocationPct: positionAllocationPct !== undefined ? Number(positionAllocationPct) : undefined
    });

    res.json({ success: true, message: 'Configuration updated', state: paperTrader.getState() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start paper trading loop
router.post('/start', (req, res) => {
  try {
    const { 
      intervalMinutes, 
      minMomentumScore,
      trailingActivationPct,
      trailingDistancePct,
      hardStopLossPct,
      maxHoldMinutes,
      takeProfitPct,
      positionAllocationPct
    } = req.body;

    paperTrader.setConfig({
      minMomentumScore: minMomentumScore !== undefined ? Number(minMomentumScore) : undefined,
      intervalMinutes: intervalMinutes !== undefined ? Number(intervalMinutes) : undefined,
      trailingActivationPct: trailingActivationPct !== undefined ? Number(trailingActivationPct) : undefined,
      trailingDistancePct: trailingDistancePct !== undefined ? Number(trailingDistancePct) : undefined,
      hardStopLossPct: hardStopLossPct !== undefined ? Number(hardStopLossPct) : undefined,
      maxHoldMinutes: maxHoldMinutes !== undefined ? Number(maxHoldMinutes) : undefined,
      takeProfitPct: takeProfitPct !== undefined ? (takeProfitPct === null ? null : Number(takeProfitPct)) : undefined,
      positionAllocationPct: positionAllocationPct !== undefined ? Number(positionAllocationPct) : undefined
    });

    paperTrader.start(intervalMinutes ? Number(intervalMinutes) : (paperTrader.getState().intervalMinutes || 15));
    res.json({ success: true, message: 'Paper trading started', state: paperTrader.getState() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Stop paper trading loop
router.post('/stop', (req, res) => {
  try {
    paperTrader.stop();
    res.json({ success: true, message: 'Paper trading stopped', state: paperTrader.getState() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Force manual cycle trigger
router.post('/run-cycle', async (req, res) => {
  try {
    await paperTrader.runCycle();
    res.json({ success: true, message: 'Paper cycle executed successfully', state: paperTrader.getState() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Close a position manually
router.post('/close-position', async (req, res) => {
  try {
    const { symbol, id } = req.body || {};
    const target = id || symbol;
    if (!target) {
      return res.status(400).json({ success: false, error: 'Symbol or ID is required' });
    }
    const closed = await paperTrader.closePositionManual(target);
    if (!closed) {
      return res.status(404).json({ success: false, error: `Open position not found for ${target}` });
    }
    res.json({
      success: true,
      message: `Position for ${target} closed manually`,
      position: closed,
      state: paperTrader.getState()
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download hourly snapshots JSON
router.get('/download-snapshots', (req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'server', 'data', 'momentum_hour_snapshots.json');
    if (fs.existsSync(filePath)) {
      res.download(filePath, 'momentum_hour_snapshots.json');
    } else {
      res.status(404).json({ success: false, error: 'Snapshot file not found yet.' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download paper trading state & history JSON
router.get('/download-state', (req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'server', 'data', 'momentum_paper_state.json');
    if (fs.existsSync(filePath)) {
      res.download(filePath, 'momentum_paper_state.json');
    } else {
      res.status(404).json({ success: false, error: 'State file not found yet.' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
