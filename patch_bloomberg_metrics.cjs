const fs = require('fs');
let content = fs.readFileSync('src/components/BloombergTerminal.tsx', 'utf8');

const targetEquity = `  const equity = useMemo(() => {
    const positionsValue = positions.reduce((acc, pos) => {
      const ticker = ticker24hMap[pos.symbol];
      const opp = marketOpportunities.find(o => o.symbol === pos.symbol);
      const watch = watchlist.find(w => w.symbol === pos.symbol);
      const price = ticker?.price || opp?.price || watch?.price || pos.currentPrice || pos.entryPrice;
      return acc + (pos.amount * price);
    }, 0);
    return balance + positionsValue;
  }, [balance, positions, marketOpportunities, watchlist, ticker24hMap]);`;

const replaceEquity = `  const { investedCapital, unrealizedPnL } = useMemo(() => {
    let inv = 0;
    let pnl = 0;
    positions.forEach(pos => {
      const ticker = ticker24hMap[pos.symbol];
      const opp = marketOpportunities.find(o => o.symbol === pos.symbol);
      const watch = watchlist.find(w => w.symbol === pos.symbol);
      const price = ticker?.price || opp?.price || watch?.price || pos.currentPrice || pos.entryPrice;
      
      const lev = pos.leverage || 1;
      const margin = pos.margin || ((pos.entryPrice * pos.amount) / lev);
      inv += margin;
      pnl += (price - pos.entryPrice) * pos.amount;
    });
    return { investedCapital: inv, unrealizedPnL: pnl };
  }, [positions, marketOpportunities, watchlist, ticker24hMap]);

  const equity = balance + investedCapital + unrealizedPnL;`;

if (content.includes(targetEquity)) {
  content = content.replace(targetEquity, replaceEquity);
  
  const targetPnl = `  const unrealizedPnL = useMemo(() => {
    return positions.reduce((acc, pos) => {
      const ticker = ticker24hMap[pos.symbol];
      const opp = marketOpportunities.find(o => o.symbol === pos.symbol);
      const watch = watchlist.find(w => w.symbol === pos.symbol);
      const price = ticker?.price || opp?.price || watch?.price || pos.currentPrice || pos.entryPrice;
      return acc + ((price - pos.entryPrice) * pos.amount);
    }, 0);
  }, [positions, marketOpportunities, watchlist, ticker24hMap]);`;
  content = content.replace(targetPnl, ''); // removed because we calculate it together
  
  fs.writeFileSync('src/components/BloombergTerminal.tsx', content);
  console.log('Patched Bloomberg calculations');
} else {
  console.log('Failed to patch Bloomberg calculations');
}
