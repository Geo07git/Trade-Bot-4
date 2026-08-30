import express from 'express';
import fs from 'fs';
import path from 'path';
import { runBacktest } from '../services/momentum/BacktestEngine';
import { getBinanceUniverse } from '../services/momentum/Universe';
import { requireAdminAuth } from '../utils/auth';

const router = express.Router();

router.get('/list', requireAdminAuth, (req, res) => {
  try {
    const backtestDir = path.join(process.cwd(), 'server', 'data', 'backtests');
    if (!fs.existsSync(backtestDir)) {
      return res.json({ success: true, files: [] });
    }
    
    const files = fs.readdirSync(backtestDir).filter(f => f.endsWith('.json'));
    const filesWithStats = files.map(f => {
      const stat = fs.statSync(path.join(backtestDir, f));
      return { 
        filename: f, 
        createdAt: stat.mtimeMs,
        sizeMB: (stat.size / (1024 * 1024)).toFixed(2)
      };
    });
    
    filesWithStats.sort((a, b) => b.createdAt - a.createdAt);
    res.json({ success: true, files: filesWithStats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:filename', requireAdminAuth, (req, res) => {
  try {
    const { filename } = req.params;
    // basic sanitization to prevent directory traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'server', 'data', 'backtests', safeFilename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    // We stream it directly or read it synchronously depending on size. 
    // Synchronous is fine for now but streaming is better for huge JSONs.
    // For simplicity, we send the file using express helper.
    res.sendFile(filePath);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:filename', requireAdminAuth, (req, res) => {
  try {
    const { filename } = req.params;
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'server', 'data', 'backtests', safeFilename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return res.json({ success: true, message: 'File deleted successfully' });
    }
    res.status(404).json({ success: false, error: 'File not found' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/run-backtest', requireAdminAuth, async (req, res) => {
  try {
    const { startTime, endTime, config, includePath, symbolLimit, singleSymbol } = req.body;
    const { tradingUniverse } = await getBinanceUniverse();
    
    let subset: string[];
    if (singleSymbol && singleSymbol.trim()) {
      subset = [singleSymbol.trim().toUpperCase()];
    } else {
      subset = symbolLimit ? tradingUniverse.slice(0, symbolLimit) : tradingUniverse; 
    } 
    
    // Job Async in background
    runBacktest(subset, config, startTime, endTime).then(results => {
      const backtestDir = path.join(process.cwd(), 'server', 'data', 'backtests');
      if (!fs.existsSync(backtestDir)) {
        fs.mkdirSync(backtestDir, { recursive: true });
      }
      
      const filename = `backtest_${Date.now()}.json`;
      fs.writeFileSync(
        path.join(backtestDir, filename),
        JSON.stringify(results)
      );
      console.log(`[Backtest] Saved results to ${filename}`);
    }).catch(err => {
      console.error('[Backtest] Background error:', err);
    });
    
    // Răspuns Imediat
    res.json({ success: true, message: 'Backtest running in background. Please check the "Saved Runs" tab later.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
