const fs = require('fs');
let code = fs.readFileSync('server/services/momentum/MomentumExecutor.ts', 'utf8');

const target = `          if (this.externalSignalCallback) { 
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
           }`;

const replacement = `          // Execute BOTH natively in MomentumExecutor AND forward to BotEngine if configured
          if (this.externalSignalCallback) {
             try {
               await this.externalSignalCallback(symbol, 'BUY', scores.momentumScore, {
                  momentum_15m: scores.momentum_15m,
                  momentum_1h: scores.momentum_1h,
                  momentum_4h: scores.momentum_4h,
                  rvol: scores.rvol_current,
                  volumeAcceleration: scores.volumeAcceleration,
                  breakoutStrength: scores.breakoutStrength,
                  atrExpansion: scores.atrExpansion,
                  pullbackQuality: scores.pullbackQuality
               });
               this.log(\`[ENTRY LIVE 🟢] Semnal trimis spre Bot Engine pentru \${symbol} cu Scor Momentum \${scores.momentumScore.toFixed(1)}\`);
             } catch (e) {
               console.error('[MomentumExecutor] External callback error:', e);
             }
          }`;

code = code.replace(target, replacement);
fs.writeFileSync('server/services/momentum/MomentumExecutor.ts', code);
console.log('MomentumExecutor.ts patched to execute both natively and externally');
