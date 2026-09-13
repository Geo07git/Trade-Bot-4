const fs = require('fs');
let code = fs.readFileSync('src/components/BloombergTerminal.tsx', 'utf8');

const replacement = `            </button>
          </form>
        </div>
      </div>
      {/* 2. REAL-TIME TICKER TAPE (INFINITE SCROLL) */}`;

code = code.replace(/<\/button>\s*<\/form>\s*<\/div>\s*{\/\* Function Keys Quick Chips \*\/}\s*{\/\* 2\. REAL-TIME TICKER TAPE \(INFINITE SCROLL\) \*\/}/m, replacement);
fs.writeFileSync('src/components/BloombergTerminal.tsx', code);
console.log('Regex fixed div');
