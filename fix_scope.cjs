const fs = require('fs');
let code = fs.readFileSync('server/bot.ts', 'utf8');

code = code.replace(`      const regime = mlRes?.marketRegime?.regime || 'RANGING';
      const rangeProb = mlRes?.marketRegime?.rangeProbability ?? 50;
      
      if (regime === 'RANGING' || regime === 'LATERAL') {
         const stepPercent = this.state.scalpingConfig?.trailingStopActivation || 1.5;
         const allocatedCapitalPct = this.state.scalpingConfig?.positionSizePercent || 10.0;
         const minRequired = this.state.binanceMode === 'paper' ? 0.1 : 5.0;
         const gridConfidence = signal.prob;
         const regimeBadge = regime;
         const sellLevels = [currentPrice * (1 + (stepPercent / 100))];`, 
`      const regime = mlRes?.marketRegime?.regime || 'RANGING';
      const rangeProb = mlRes?.marketRegime?.rangeProbability ?? 50;
      const stepPercent = this.state.scalpingConfig?.trailingStopActivation || 1.5;
      const allocatedCapitalPct = this.state.scalpingConfig?.positionSizePercent || 10.0;
      const minRequired = this.state.binanceMode === 'paper' ? 0.1 : 5.0;
      const gridConfidence = signal.prob || 50;
      const regimeBadge = regime;
      const regimeExplanation = mlRes?.marketRegime?.regimeDescription || '';
      const buyLevels = [currentPrice * (1 - (stepPercent / 100))];
      const sellLevels = [currentPrice * (1 + (stepPercent / 100))];
      const gridActive = regime === 'RANGING' || regime === 'LATERAL';
      const gridAnchorPrice = currentPrice;
      const lowerPrice = currentPrice * 0.95;
      const upperPrice = currentPrice * 1.05;
      const trendProb = mlRes?.marketRegime?.trendProbability ?? 50;
      const breakoutProb = mlRes?.marketRegime?.breakoutProbability ?? 50;
      const expectedDailyProfitPct = 1.0;
      const expectedDailyProfitMargin = 10;
      const maxDrawdownEstPct = -5.0;
      const choppinessIndex = 50;
      const bollingerWidthPct = oppInfo?.bbWidthPct || 0;
      const hurstExponent = 0.5;
      const adx = oppInfo?.adx || 20;
      const atrPercent = oppInfo?.atrPercent || 1.0;
      const supportPrice = currentPrice * 0.98;
      const resistancePrice = currentPrice * 1.02;
      const shockScore = 0;
      const shockLevel = 'NONE';
      const shockUntilMs = 0;
      
      if (gridActive) {`);

code = code.replace(`    let executedGridTrades = 0;
    let gridProfit = 0;
    let lastAction = '';`, `    let executedGridTrades = 0;
    let gridProfit = 0;
    let lastAction = '';
    const newStatuses: any[] = [];`);

fs.writeFileSync('server/bot.ts', code);
