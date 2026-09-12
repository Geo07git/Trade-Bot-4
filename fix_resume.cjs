const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/    res\.json\(\{\n      success: true,\n      status: tradingEngine\.getFullStatus\(\)\n    \}\);\n  \/\/ Security helpers for Bot API/g, '    res.json({\n      success: true,\n      status: tradingEngine.getFullStatus()\n    });\n  });\n\n  // Security helpers for Bot API');

fs.writeFileSync('server.ts', content);
