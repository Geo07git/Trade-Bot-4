const fs = require('fs');
let code = fs.readFileSync('src/components/MomentumPaperView.tsx', 'utf8');

// Add types
code = code.replace(`  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  scoreAtEntry?: number;`, `  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  scoreAtEntry?: number;
  currentPrice?: number;
  currentPnLPct?: number;`);

// Add table header
code = code.replace(`<th className="py-2.5 px-3">Preț Intrare</th>`, `<th className="py-2.5 px-3">Preț Intrare</th>
                  <th className="py-2.5 px-3">Preț Curent (PnL)</th>`);

// Add table cell
code = code.replace(`<td className="py-3 px-3">\${pos.entryPrice.toFixed(4)}</td>`, `<td className="py-3 px-3">\${pos.entryPrice.toFixed(4)}</td>
                      <td className="py-3 px-3 font-mono">
                        {pos.currentPrice ? (
                          <div className="flex flex-col">
                            <span>\${pos.currentPrice.toFixed(4)}</span>
                            <span className={pos.currentPnLPct && pos.currentPnLPct >= 0 ? 'text-emerald-400 text-[11px]' : 'text-rose-400 text-[11px]'}>
                              {pos.currentPnLPct && pos.currentPnLPct > 0 ? '+' : ''}{pos.currentPnLPct?.toFixed(2)}%
                            </span>
                          </div>
                        ) : '...'}
                      </td>`);

fs.writeFileSync('src/components/MomentumPaperView.tsx', code);
