import { Router } from 'express';
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

// Start paper trading loop
router.post('/start', (req, res) => {
  try {
    const { intervalMinutes } = req.body;
    paperTrader.start(intervalMinutes ? Number(intervalMinutes) : 15);
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

export default router;
