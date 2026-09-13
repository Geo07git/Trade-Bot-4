const fs = require('fs');
let code = fs.readFileSync('server/services/momentum/PaperTrader.ts', 'utf8');

const target = "const feePaid = sizeUSDT * (this.config.entryFeePct / 100);\\n          this.deductCapital(sizeUSDT + feePaid);\\n          this.state.totalFeesPaid = (this.state.totalFeesPaid || 0) + feePaid;\\n\\n          const newPos: PaperPosition = {";

const targetRegex = /const feePaid = sizeUSDT \[\^\]\*newPos: PaperPosition = \{/; // Regex is safer

// Better string replace
const splitStr = "if (sizeUSDT < 5) continue; // Below minimum trade size";

if (code.includes(splitStr)) {
  const parts = code.split(splitStr);
  const part2 = parts[1];
  
  const inject = `
          if (this.externalSignalCallback) {
             const executed = await this.externalSignalCallback(symbol, 'BUY', scores.momentumScore, {
                momentum_15m: scores.momentum_15m,
                momentum_1h: scores.momentum_1h,
                momentum_4h: scores.momentum_4h,
                rvol: scores.rvol_current,
                volumeAcceleration: scores.volumeAcceleration,
                breakoutStrength: scores.breakoutStrength,
                atrExpansion: scores.atrExpansion,
                pullbackQuality: scores.pullbackQuality
             });
             if (executed) {
                 this.log(\`[ENTRY LIVE 🟢] Semnal trimis spre Bot Engine pentru \${symbol} cu Scor Momentum \${scores.momentumScore.toFixed(1)}\`);
             }
             continue; 
          }
`;

  code = parts[0] + splitStr + inject + part2;
  fs.writeFileSync('server/services/momentum/PaperTrader.ts', code);
  console.log("Patched correctly");
}
