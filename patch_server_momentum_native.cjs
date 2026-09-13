const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `  // Route Momentum signals directly to the live BotEngine
  momentumExecutor.setExternalSignalCallback(async (symbol, side, score, meta) => {
    try {
      // Bypass strict autonomous trading check for paper signals if user wants live execution
      // Allow execution regardless of engine mode filter if user triggers momentum signals
      const currentEngine = botEngine.state.executionEngine || 'both';
      
      const currentPriceRes = await fetch(\`https://api.binance.com/api/v3/ticker/price?symbol=\${symbol}\`);
      const currentPriceData = await currentPriceRes.json();
      const currentPrice = parseFloat(currentPriceData.price);
      const allocPct = botEngine.state.momentumConfig?.positionAllocationPct ?? 10;
      const baseCapital = botEngine.state.initialBalance || 250;
      const amountToBuyUSDT = baseCapital * (allocPct / 100);
      const amountToBuy = parseFloat((amountToBuyUSDT / currentPrice).toFixed(4));
      
      if (amountToBuyUSDT < 5) {
          console.warn(\`[server] Not enough allocation for Momentum signal on \${symbol}\`);
          return false;
      }
      await botEngine.executeTrade(symbol, 'BUY', currentPrice, amountToBuy, {
        strategy: 'momentum',
        modelName: 'Momentum Breakout ML',
        entryReason: \`Momentum Breakout | Score: \${score.toFixed(1)} | RVOL: \${meta.rvol?.toFixed(2) || 0}\`,
        metaTradeScore: score
      });
      
      return true;
    } catch (err) {
      console.error('[server] Error passing signal from momentumExecutor to botEngine:', err);
      return false;
    }
  });`;

const replacement = `  // Momentum signals are handled natively by MomentumExecutor simulator`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
console.log('server.ts external callback route removed in favor of native momentumExecutor');
