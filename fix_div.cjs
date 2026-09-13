const fs = require('fs');
let code = fs.readFileSync('src/components/BloombergTerminal.tsx', 'utf8');

const target = `        {/* Function Keys Quick Chips */}      
      {/* 2. REAL-TIME TICKER TAPE (INFINITE SCROLL) */}`;

const replacement = `        {/* Function Keys Quick Chips */}      
      </div>
      {/* 2. REAL-TIME TICKER TAPE (INFINITE SCROLL) */}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/BloombergTerminal.tsx', code);
console.log('Fixed div');
