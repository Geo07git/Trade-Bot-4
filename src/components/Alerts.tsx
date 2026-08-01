import React, { useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { requestNotificationPermission, sendWebPush, sendNotificationMessage } from '../services/notifications';
import { useTradingStore } from '../store';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function Alerts() {
  const { discordWebhookUrl, telegramBotToken, telegramChatId, reportConfig, setReportConfig, balance, positions, timezone, setTimezone } = useTradingStore();
  const equity = balance + positions.reduce((acc, pos) => acc + (pos.amount * (pos.currentPrice || pos.entryPrice)), 0);
  const [macroStatus, setMacroStatus] = useState<'idle' | 'triggered'>('idle');

  const handleTestAlerts = async () => {
    const granted = await requestNotificationPermission();
    if (granted && reportConfig?.channels?.browser) {
      sendWebPush('Test Notificare AI', 'Sistemul de notificări desktop & Android este activat.');
    }
    
    if (reportConfig?.channels?.telegram) {
      await sendNotificationMessage(
        'telegram',
        discordWebhookUrl,
        telegramBotToken,
        telegramChatId,
        '🔔 **Test Notificare AI.TRADE**\nSistemul de notificări Telegram funcționează corect.'
      );
    }
  };

  const handleTriggerReport = async () => {
    const message = `🤖 *AI.TRADE Bot - Test Report*\n\n📅 Data: ${new Date().toLocaleDateString('ro-RO')}\n💼 Valoare portofoliu: $${Number(equity || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    
    if (reportConfig?.channels?.telegram) await sendNotificationMessage('telegram', discordWebhookUrl, telegramBotToken, telegramChatId, message);
    if (reportConfig?.channels?.browser) sendWebPush('Raport Trimis', 'Raportul a fost trimis cu succes!');
  };

  const handleMacroEvent = async () => {
    setMacroStatus('triggered');
    const message = `⚠️ **Macro Event Volatility Spike**\nCuvânt cheie detectat: "CPI"\nSistemul recomandă prudență.`;
    await sendNotificationMessage('telegram', discordWebhookUrl, telegramBotToken, telegramChatId, message);
    sendWebPush('Alertă Volatilitate', 'News API detectat. Prudență!');
    setTimeout(() => setMacroStatus('idle'), 5000);
  };

  return (
    <div className="flex flex-col h-full bg-black">
      <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-zinc-900/10 backdrop-blur-md shrink-0 flex-wrap gap-2">
        <div>
          <h1 className="font-serif text-xl text-white">Notificări & Alerte</h1>
          <p className="text-[10px] uppercase text-zinc-500 tracking-wider mt-0.5">Semnale trimise prin Web Push (Desktop & Android Push) și Telegram</p>
        </div>
        <button 
          onClick={handleTestAlerts}
          className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium rounded-full transition-colors text-sm border border-emerald-500/20 shadow-sm cursor-pointer whitespace-nowrap">
          Testează Alertele (Push & Telegram)
        </button>
      </header>

      <div className="p-8 overflow-y-auto flex-1 pb-32">
        <div className="max-w-4xl space-y-4">
          
          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-white/10 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 relative z-10">
               <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                 <h3 className="font-serif text-lg text-white">Semnal de Tranzacționare</h3>
               </div>
               <div className="flex flex-wrap items-center gap-2">
                 <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded text-[10px] font-bold tracking-wider">TELEGRAM</span>
                 <span className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 rounded text-[10px] font-bold tracking-wider">DESKTOP & ANDROID PUSH</span>
               </div>
            </div>
            <div className="flex items-center gap-4 text-sm font-mono text-zinc-300 flex-wrap relative z-10">
               <span className="px-3 py-1.5 bg-[#0a0a0a] rounded-lg border border-white/5 shadow-inner">Dacă Probabilitate BUY/SELL</span>
               <span className="text-zinc-500">&gt;=</span>
               <span className="px-3 py-1.5 bg-[#0a0a0a] rounded-lg border border-white/5 text-emerald-400 shadow-inner">60%</span>
               <span className="text-zinc-500">ATUNCI</span>
               <span className="px-3 py-1.5 bg-[#0a0a0a] rounded-lg border border-white/5 text-emerald-400 shadow-inner">Notifică</span>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-white/10 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 relative z-10">
               <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_blue]"></div>
                 <h3 className="font-serif text-lg text-white">Rapoarte Periodice (Paper Trading)</h3>
               </div>
               <div className="flex flex-wrap items-center gap-2">
                 <button onClick={handleTriggerReport} className="mr-2 px-3 py-1 bg-white/5 hover:bg-white/10 text-white rounded text-[11px] font-medium border border-white/10 cursor-pointer transition-colors">Trimite Test Acum</button>
               </div>
            </div>

            <div className="relative z-10 space-y-6">
              {/* Timezone */}
              <div>
                <p className="text-[10px] uppercase text-zinc-500 tracking-wider mb-3">Fus Orar (Timezone)</p>
                <div className="flex items-center gap-2">
                  <select value={timezone || 'Europe/Bucharest'} onChange={(e) => setTimezone(e.target.value)} className="bg-black border border-white/10 rounded px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/30">
                    <option value="Europe/Bucharest">Europe/Bucharest (EET/EEST)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

              {/* Channels */}
              <div>
                <p className="text-[10px] uppercase text-zinc-500 tracking-wider mb-3">Canale de Distribuție</p>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 cursor-pointer group/chk">
                    <input type="checkbox" checked={reportConfig?.channels?.telegram} onChange={(e) => setReportConfig({ channels: { ...reportConfig.channels, telegram: e.target.checked } })} className="accent-blue-500 w-4 h-4 rounded border-white/10 bg-black" />
                    <span className="text-sm text-zinc-300 group-hover/chk:text-white transition-colors">Telegram</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group/chk">
                    <input type="checkbox" checked={reportConfig?.channels?.browser} onChange={(e) => setReportConfig({ channels: { ...reportConfig.channels, browser: e.target.checked } })} className="accent-emerald-500 w-4 h-4 rounded border-white/10 bg-black" />
                    <span className="text-sm text-zinc-300 group-hover/chk:text-white transition-colors">Desktop & Android Push (PWA)</span>
                  </label>
                </div>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

              {/* Daily Report */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <label className="flex items-center gap-3 cursor-pointer group/chk">
                  <input type="checkbox" checked={reportConfig?.daily?.enabled} onChange={(e) => setReportConfig({ daily: { ...reportConfig.daily, enabled: e.target.checked } })} className="accent-emerald-500 w-4 h-4 rounded border-white/10 bg-black" />
                  <div>
                    <span className="text-sm text-zinc-200 group-hover/chk:text-white transition-colors block">Daily Report</span>
                    <span className="text-[10px] text-zinc-500">Raport complet pentru ziua curentă</span>
                  </div>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Ora locală:</span>
                  <input type="time" value={reportConfig?.daily?.time || '21:00'} onChange={(e) => setReportConfig({ daily: { ...reportConfig.daily, time: e.target.value } })} className="bg-black border border-white/10 rounded px-2 py-1 text-sm text-zinc-300 focus:outline-none focus:border-white/30" />
                </div>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

              {/* Weekly Report */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <label className="flex items-center gap-3 cursor-pointer group/chk">
                  <input type="checkbox" checked={reportConfig?.weekly?.enabled} onChange={(e) => setReportConfig({ weekly: { ...reportConfig.weekly, enabled: e.target.checked } })} className="accent-emerald-500 w-4 h-4 rounded border-white/10 bg-black" />
                  <div>
                    <span className="text-sm text-zinc-200 group-hover/chk:text-white transition-colors block">Weekly Report</span>
                    <span className="text-[10px] text-zinc-500">Sumar săptămânal și statistici</span>
                  </div>
                </label>
                <div className="flex items-center gap-3">
                  <select value={reportConfig?.weekly?.day || 0} onChange={(e) => setReportConfig({ weekly: { ...reportConfig.weekly, day: parseInt(e.target.value) } })} className="bg-black border border-white/10 rounded px-2 py-1 text-sm text-zinc-300 focus:outline-none focus:border-white/30">
                    <option value={1}>Luni</option>
                    <option value={2}>Marți</option>
                    <option value={3}>Miercuri</option>
                    <option value={4}>Joi</option>
                    <option value={5}>Vineri</option>
                    <option value={6}>Sâmbătă</option>
                    <option value={0}>Duminică</option>
                  </select>
                  <input type="time" value={reportConfig?.weekly?.time || '21:00'} onChange={(e) => setReportConfig({ weekly: { ...reportConfig.weekly, time: e.target.value } })} className="bg-black border border-white/10 rounded px-2 py-1 text-sm text-zinc-300 focus:outline-none focus:border-white/30" />
                </div>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

              {/* Monthly Report */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <label className="flex items-center gap-3 cursor-pointer group/chk">
                  <input type="checkbox" checked={reportConfig?.monthly?.enabled} onChange={(e) => setReportConfig({ monthly: { ...reportConfig.monthly, enabled: e.target.checked } })} className="accent-emerald-500 w-4 h-4 rounded border-white/10 bg-black" />
                  <div>
                    <span className="text-sm text-zinc-200 group-hover/chk:text-white transition-colors block">Monthly Report</span>
                    <span className="text-[10px] text-zinc-500">Ultima zi din lună (la ora setată zilnic)</span>
                  </div>
                </label>
              </div>

            </div>
          </div>

           <div className={cn("bg-zinc-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden group transition-colors", macroStatus === 'triggered' ? 'border-amber-500/30' : 'hover:border-white/10')}>
            <div className={cn("absolute inset-0 bg-gradient-to-br transition-opacity", macroStatus === 'triggered' ? 'from-amber-500/10 to-transparent opacity-100' : 'from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100')}></div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 relative z-10">
               <div className="flex items-center gap-3">
                 <div className={cn("w-2 h-2 rounded-full", macroStatus === 'triggered' ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_orange]' : 'bg-amber-500')}></div>
                 <h3 className="font-serif text-lg text-white">Macro Event Volatility Spike</h3>
               </div>
               <div className="flex flex-wrap items-center gap-2">
                 <button onClick={handleMacroEvent} className="mr-2 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded text-[11px] font-medium border border-amber-500/20 cursor-pointer transition-colors">Simulează Spike</button>
                 <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded text-[10px] font-bold tracking-wider">TELEGRAM</span>
                 <span className="px-2 py-1 bg-white/10 border border-white/20 text-white rounded text-[10px] font-bold tracking-wider">WEB PUSH</span>
               </div>
            </div>
             <div className="flex items-center gap-4 text-sm font-mono text-zinc-300 flex-wrap relative z-10">
               <span className="px-3 py-1.5 bg-[#0a0a0a] rounded-lg border border-white/5 shadow-inner">IF News API Keyword</span>
               <span className="text-zinc-500">MATCHES</span>
               <span className="px-3 py-1.5 bg-[#0a0a0a] rounded-lg border border-white/5 text-amber-400 shadow-inner">"Fed Rate", "CPI"</span>
               <span className="text-zinc-500">THEN</span>
               <span className="px-3 py-1.5 bg-[#0a0a0a] rounded-lg border border-white/5 text-emerald-400 shadow-inner">Pause Auto-Trading & Notify</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

