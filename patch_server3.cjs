const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Replace duplicate block closures that were orphaned when deleting endpoints
content = content.replace(/    res\.json\(\{ success: true, state: getSanitizedBotState\(\) \}\);\n  \}\);\n  \}\);\n/g, '    res.json({ success: true, state: getSanitizedBotState() });\n  });\n');
content = content.replace(/    res\.json\(\{ \.\.\.result, state: getSanitizedBotState\(\), calculatedEquity: botEngine\.calculateEquity\(\) \}\);\n  \}\);\n  \}\);\n/g, '    res.json({ ...result, state: getSanitizedBotState(), calculatedEquity: botEngine.calculateEquity() });\n  });\n');

fs.writeFileSync('server.ts', content);
