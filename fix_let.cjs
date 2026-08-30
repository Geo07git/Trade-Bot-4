const fs = require('fs');
let code = fs.readFileSync('server/bot.ts', 'utf8');

code = code.replace(`      const buyLevels = [currentPrice * (1 - (stepPercent / 100))];
      const sellLevels = [currentPrice * (1 + (stepPercent / 100))];
      const gridActive = regime === 'RANGING' || regime === 'LATERAL';
      const gridAnchorPrice = currentPrice;
      const lowerPrice = currentPrice * 0.95;
      const upperPrice = currentPrice * 1.05;`, 
`      let buyLevels = [currentPrice * (1 - (stepPercent / 100))];
      let sellLevels = [currentPrice * (1 + (stepPercent / 100))];
      let gridActive = regime === 'RANGING' || regime === 'LATERAL';
      let gridAnchorPrice = currentPrice;
      let lowerPrice = currentPrice * 0.95;
      let upperPrice = currentPrice * 1.05;`);

fs.writeFileSync('server/bot.ts', code);
