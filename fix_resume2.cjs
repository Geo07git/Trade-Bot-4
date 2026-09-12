const fs = require('fs');
let lines = fs.readFileSync('server.ts', 'utf8').split('\n');

for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('// Security helpers for Bot API')) {
    // we need to insert '  });' before this line if it's not there
    if (lines[i-1].trim() !== '});') {
      lines.splice(i, 0, '  });');
    }
    break;
  }
}

fs.writeFileSync('server.ts', lines.join('\n'));
