const fs = require('fs');
let code = fs.readFileSync('server/services/momentum/MomentumExecutor.ts', 'utf8');

if (!code.includes('externalSignalCallback')) {
  // Add property
  code = code.replace(
    'private executionEngineChecker?: () => string;',
    `private executionEngineChecker?: () => string;\n  private externalSignalCallback?: (symbol: string, side: 'BUY' | 'SELL', score: number, meta: any) => Promise<boolean>;`
  );

  // Add setter
  code = code.replace(
    'public setExecutionEngineChecker(checker: () => string) {',
    `public setExternalSignalCallback(cb: (symbol: string, side: 'BUY' | 'SELL', score: number, meta: any) => Promise<boolean>) {\n    this.externalSignalCallback = cb;\n  }\n\n  public setExecutionEngineChecker(checker: () => string) {`
  );

  const entryLogicTarget = `const feePaid = sizeUSDT * (this.config.entryFeePct / 100);
          this.deductCapital(sizeUSDT + feePaid);
          this.state.totalFeesPaid = (this.state.totalFeesPaid || 0) + feePaid;

          const newPos: PaperPosition = {`;
          
  const entryLogicReplacement = `
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
             continue; // Skip the internal paper simulation if we sent it to the live flow
          }

          const feePaid = sizeUSDT * (this.config.entryFeePct / 100);
          this.deductCapital(sizeUSDT + feePaid);
          this.state.totalFeesPaid = (this.state.totalFeesPaid || 0) + feePaid;

          const newPos: PaperPosition = {`;
          
  code = code.replace(entryLogicTarget, entryLogicReplacement);
  
  fs.writeFileSync('server/services/momentum/MomentumExecutor.ts', code);
  console.log('MomentumExecutor patched');
}
