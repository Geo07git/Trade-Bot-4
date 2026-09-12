const fs = require('fs');
let content = fs.readFileSync('src/components/BloombergTerminal.tsx', 'utf8');

const targetRibbon = `          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-1 shrink-0">
            <div className="bg-[#0d1017] border border-amber-500/20 p-2 rounded flex flex-col">
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">{t.totalBalance}</span>
              <span className="text-sm font-bold text-amber-400 font-mono mt-0.5">\${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-[#0d1017] border border-amber-500/20 p-2 rounded flex flex-col">
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">Total Equity</span>
              <span className="text-sm font-bold text-white font-mono mt-0.5">\${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-[#0d1017] border border-amber-500/20 p-2 rounded flex flex-col">
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">{language === 'ro' ? 'Profit Total' : 'Total Profit'}</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={cn("text-sm font-bold font-mono", totalProfit >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {totalProfit >= 0 ? '+' : ''}\${totalProfit.toFixed(2)}
                </span>
                <span className={cn("text-[10px] font-bold", totalProfit >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  ({totalProfitPct.toFixed(2)}%)
                </span>
              </div>
            </div>
            <div className="bg-[#0d1017] border border-amber-500/20 p-2 rounded flex flex-col">
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">{t.unrealizedPnl}</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={cn("text-sm font-bold font-mono", unrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {unrealizedPnL >= 0 ? '+' : ''}\${unrealizedPnL.toFixed(2)}
                </span>
                <span className={cn("text-[10px] font-bold", unrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  ({unrealizedPnLPct.toFixed(2)}%)
                </span>
              </div>
            </div>`;

const newRibbon = `          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1 shrink-0">
            <div className="bg-[#0d1017] border border-amber-500/20 p-2 rounded flex flex-col">
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">Free Balance</span>
              <span className="text-sm font-bold text-amber-400 font-mono mt-0.5">\${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-[#0d1017] border border-amber-500/20 p-2 rounded flex flex-col">
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">Margin (Invested)</span>
              <span className="text-sm font-bold text-amber-200 font-mono mt-0.5">\${investedCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-[#0d1017] border border-emerald-500/30 p-2 rounded flex flex-col">
              <span className="text-[10px] text-emerald-400 uppercase font-semibold">Total Equity</span>
              <span className="text-sm font-bold text-white font-mono mt-0.5">\${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-[#0d1017] border border-amber-500/20 p-2 rounded flex flex-col">
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">{t.unrealizedPnl}</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={cn("text-sm font-bold font-mono", unrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {unrealizedPnL >= 0 ? '+' : ''}\${unrealizedPnL.toFixed(2)}
                </span>
                <span className={cn("text-[10px] font-bold", unrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  ({unrealizedPnLPct.toFixed(2)}%)
                </span>
              </div>
            </div>
            <div className="bg-[#0d1017] border border-amber-500/20 p-2 rounded flex flex-col">
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">{language === 'ro' ? 'Profit Total' : 'Total Profit'}</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={cn("text-sm font-bold font-mono", totalProfit >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {totalProfit >= 0 ? '+' : ''}\${totalProfit.toFixed(2)}
                </span>
                <span className={cn("text-[10px] font-bold", totalProfit >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  ({totalProfitPct.toFixed(2)}%)
                </span>
              </div>
            </div>`;

if (content.includes(targetRibbon)) {
  content = content.replace(targetRibbon, newRibbon);
  fs.writeFileSync('src/components/BloombergTerminal.tsx', content);
  console.log('Patched ribbon layout');
} else {
  console.log('Ribbon target not found');
}
