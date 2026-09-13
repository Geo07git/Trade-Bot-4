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
      // Bypass botEngine internal checks (like scalping engine requirements) by inserting directly into botEngine positions or executing force trade
      const targetAlloc = amountToBuyUSDT;
      const fee = targetAlloc * 0.001;
      botEngine.state.balance = Math.max(0, botEngine.state.balance - (targetAlloc + fee));
      const newPos = {
        id: \`bot_\${Date.now()}_\${symbol}\`,
        symbol,
        entryPrice: currentPrice,
        amount: amountToBuy,
        sizeUSDT: targetAlloc,
        currentPrice: currentPrice,
        leverage: 1,
        strategy: 'momentum',
        modelName: 'Momentum Breakout ML',
        entryReason: \`Momentum Breakout | Score: \${score.toFixed(1)} | RVOL: \${meta.rvol?.toFixed(2) || 0}\`,
        entryTimestamp: Date.now()
      };
      botEngine.state.positions.push(newPos);
      botEngine.savePersistedState(true);
      
      console.log(\`[Momentum Live Executed] Opened position on \${symbol} at \${currentPrice} for \${targetAlloc.toFixed(2)} USDT\`);
      
      return true;
    } catch (err) {
      console.error('[server] Error passing signal from momentumExecutor to botEngine:', err);
      return false;
    }
  });`;

const replacement = `  // Momentum signals are handled natively by MomentumExecutor simulator, so we do not need external injection into botEngine positions
  // This ensures positions stay visible in MomentumExecutor Active Positions panel as requested by the user.
  momentumExecutor.setExternalSignalCallback(async (symbol, side, score, meta) => {
    return true;
  });`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
console.log('server.ts patched to keep momentum positions native in MomentumExecutor');
