const fs = require('fs');
let lines = fs.readFileSync('server.ts', 'utf8').split('\n');

// Remove line 261 (which contains the extra `  });`)
// Note: 1-indexed line 262 is index 261
let i1 = lines.findIndex(l => l.includes('// Background 24/7 Bot API Endpoints'));
if (i1 !== -1) {
  if (lines[i1+1].trim() === '});') {
    lines.splice(i1+1, 1);
  }
}

// Check end of file for extra closing brace
if (lines[lines.length-1] === '}' || lines[lines.length-2] === '}') {
   // Wait, let's just use the brace counting logic to remove the first brace<0
}

fs.writeFileSync('server.ts', lines.join('\n'));
