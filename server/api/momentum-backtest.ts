import express from 'express';
import { runBacktest } from '../services/momentum/BacktestEngine';
import { getBinanceUniverse } from '../services/momentum/Universe';

const router = express.Router();

router.post('/run-backtest', async (req, res) => {
  try {
    const { startTime, endTime, config } = req.body;
    const { tradingUniverse } = await getBinanceUniverse();
    
    // Limităm universul pentru test
    const subset = tradingUniverse.slice(0, 5); 
    
    const results = await runBacktest(subset, config, startTime, endTime);
    
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
