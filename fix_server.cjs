const fs = require('fs');
const lines = fs.readFileSync('server.ts', 'utf8').split('\n');

let newLines = [];
let b = 0; let p = 0;

for(let i=0; i<lines.length; i++) {
  let l = lines[i];
  
  if (l.trim().startsWith('app.get(') || l.trim().startsWith('app.post(') || l.trim().startsWith('app.all(') || l.trim().startsWith('app.use(')) {
    if (b > 1) { // 1 because function startServer() {
      // Need to close previous endpoint
      newLines.push('  });');
      b--; p--;
    }
  }

  for(let c of l) {
    if (c==='{') b++; if (c==='}') b--;
    if (c==='(') p++; if (c===')') p--;
  }

  newLines.push(l);
}

// Ensure the final block closes properly
if (b > 0) {
  for(let i = 0; i < b; i++) {
     newLines.push('}');
  }
}

fs.writeFileSync('server.ts', newLines.join('\n'));
