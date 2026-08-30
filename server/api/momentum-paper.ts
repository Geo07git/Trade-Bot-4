import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { paperTrader } from '../services/momentum/PaperTrader';

const router = Router();

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

// Update paper trading config (minMomentumScore, intervalMinutes)
router.post('/config', (req, res) => {
  try {
    const { minMomentumScore, intervalMinutes } = req.body;
    if (minMomentumScore !== undefined) {
      paperTrader.setConfig(Number(minMomentumScore), intervalMinutes !== undefined ? Number(intervalMinutes) : undefined);
    }
    res.json({ success: true, message: 'Configuration updated', state: paperTrader.getState() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start paper trading loop
router.post('/start', (req, res) => {
  try {
    const { intervalMinutes, minMomentumScore } = req.body;
    if (minMomentumScore !== undefined) {
      paperTrader.setConfig(Number(minMomentumScore), intervalMinutes !== undefined ? Number(intervalMinutes) : 15);
    }
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
