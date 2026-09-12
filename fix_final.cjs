const fs = require('fs');
let c = fs.readFileSync('server.ts', 'utf8');

c = c.replace(/    res\.json\(\{\n      success: true,\n      status: tradingEngine\.getFullStatus\(\)\n    \}\);\n  \/\/ Security helpers for Bot API/g, '    res.json({\n      success: true,\n      status: tradingEngine.getFullStatus()\n    });\n  });\n\n  // Security helpers for Bot API');

fs.writeFileSync('server.ts', c);
