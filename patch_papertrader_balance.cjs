const fs = require('fs');
let code = fs.readFileSync('server/services/momentum/MomentumExecutor.ts', 'utf8');

const target = `    if (totalEquity > 0 && totalEquity < (this.state.startingBalanceUSDT || 1000) * 0.5) {
      this.state.startingBalanceUSDT = totalEquity;
      this.log(\`[RE-ANCHOR] Capitalul inițial a fost re-ancorat la valoarea curentă de \\\$\${totalEquity.toFixed(2)} pentru a evita falsul Hard Stop.\`);
    }`;

const replacement = `    if (this.getEffectiveBalance() < 10) {
      if (this.externalBalanceUpdater) {
        this.externalBalanceUpdater(1000);
      } else {
        this.state.paperBalanceUSDT = 1000;
      }
      this.state.startingBalanceUSDT = 1000;
      this.log(\`[BALANȚĂ RECUL] Soldul efectiv era sub $10. A fost reinițializat automat la $1,000.00.\`);
    } else if (totalEquity > 0 && totalEquity < (this.state.startingBalanceUSDT || 1000) * 0.5) {
      this.state.startingBalanceUSDT = totalEquity;
      this.log(\`[RE-ANCHOR] Capitalul inițial a fost re-ancorat la valoarea curentă de \\\$\${totalEquity.toFixed(2)} pentru a evita falsul Hard Stop.\`);
    }`;

code = code.replace(target, replacement);
fs.writeFileSync('server/services/momentum/MomentumExecutor.ts', code);
console.log('MomentumExecutor.ts balance safeguard patched');
