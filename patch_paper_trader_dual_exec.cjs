const fs = require('fs');
let code = fs.readFileSync('server/services/momentum/MomentumExecutor.ts', 'utf8');

const target = `          if (this.externalSignalCallback) {
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

const replacement = `          // Execute BOTH externally in BotEngine AND natively in MomentumExecutor so positions show up everywhere
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
          }

          // Also execute natively so MomentumExecutor state tracker lists the open position
          const feePaid = sizeUSDT * (this.config.entryFeePct / 100);
          this.deductCapital(sizeUSDT + feePaid);
          this.state.totalFeesPaid = (this.state.totalFeesPaid || 0) + feePaid;
          const newPos: PaperPosition = {
            id: \`paper_\${Date.now()}_\${symbol}\`,
            symbol,
            entryTimestamp: now,
            entryPrice,
            sizeUSDT,
            feePaid,
            status: 'OPEN',
            maxFavorableExcursion: 0,
            maxAdverseExcursion: 0,
            scoreAtEntry: scores.momentumScore,
            scoreBreakdown: {
              momentum_15m: scores.momentum_15m,
              momentum_1h: scores.momentum_1h,
              momentum_4h: scores.momentum_4h,
              rvol: scores.rvol_current,
              volumeAcceleration: scores.volumeAcceleration,
              breakoutStrength: scores.breakoutStrength,
              atrExpansion: scores.atrExpansion,
              pullbackQuality: scores.pullbackQuality
            },
            snapshots: []
          };
          this.state.positions.push(newPos);
          activeSymbols.add(symbol);
          this.log(\`[ENTRY 🟢] Deschis poziție paper pe \${symbol} la $\${entryPrice.toFixed(4)} cu Scor Momentum \${scores.momentumScore.toFixed(1)}\`);`;

code = code.replace(target, replacement);
fs.writeFileSync('server/services/momentum/MomentumExecutor.ts', code);
console.log('MomentumExecutor.ts patched for dual native + external position creation');
