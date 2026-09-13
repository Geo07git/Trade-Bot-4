const fs = require('fs');
let code = fs.readFileSync('server/services/momentum/MomentumExecutor.ts', 'utf8');

const target = `  public start(intervalMinutes: number = 15) {
    if (this.state.hardStopTriggered) {
      this.log(\`[ATENȚIE ⚠️] Simulatorul este în stare de Hard Stop (\${this.state.hardStopTriggered}). Resetați simulatorul sau ajustați parametrii pentru a reporni.\`);
      this.state.active = false;
      this.saveState();
      return;
    }`;

const replacement = `  public start(intervalMinutes: number = 15) {
    // Clear any previous hard stop on manual start
    this.state.hardStopTriggered = null;`;

code = code.replace(target, replacement);
fs.writeFileSync('server/services/momentum/MomentumExecutor.ts', code);
console.log('MomentumExecutor.ts patched successfully');
