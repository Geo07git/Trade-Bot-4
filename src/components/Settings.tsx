import React, { useState, useEffect } from 'react';
import { useTradingStore } from '../store';
import { requestNotificationPermission } from '../services/notifications';
import { NotificationDiagnostic } from './NotificationDiagnostic';
import { RefreshCw, CheckCircle2, AlertCircle, Activity, Clock, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function Settings() {
  const [syncStatus, setSyncStatus] = useState<{ loading: boolean; message: string | null; error: boolean }>(
    { loading: false, message: null, error: false }
  );
  const [binanceInspectorLoading, setBinanceInspectorLoading] = useState(false);
  const [binanceInspectorSymbol, setBinanceInspectorSymbol] = useState('BTCUSDT');
  const [binanceInspectorResult, setBinanceInspectorResult] = useState<any>(null);
  const [telegramGuideLoading, setTelegramGuideLoading] = useState(false);
  const [telegramGuideStatus, setTelegramGuideStatus] = useState<{ message: string; error: boolean } | null>(null);
  const [customPaperBalance, setCustomPaperBalance] = useState('100');
  const [addTopupAmount, setAddTopupAmount] = useState('10');
  const [topupSuccessMsg, setTopupSuccessMsg] = useState<string | null>(null);

  // Pulse & Circuit State
  const [secondsSinceCheck, setSecondsSinceCheck] = useState<number>(0);
  const [isCheckingPulse, setIsCheckingPulse] = useState(false);
  const [pulseBannerMessage, setPulseBannerMessage] = useState<string | null>(null);

  const [mlEngineStarted, setMlEngineStarted] = useState<boolean>(() => {
    return localStorage.getItem('mlEngineStarted') === 'true';
  });
  const [aiStrategyLabStarted, setAiStrategyLabStarted] = useState<boolean>(() => {
    return localStorage.getItem('aiStrategyLabStarted') === 'true';
  });

  const handleStartMl = () => {
    setMlEngineStarted(true);
    localStorage.setItem('mlEngineStarted', 'true');
  };

  const handleStartAiLab = () => {
    setAiStrategyLabStarted(true);
    localStorage.setItem('aiStrategyLabStarted', 'true');
  };

  const { 
    dataInterval, 
    analysisInterval, 
    setDataInterval, 
    setAnalysisInterval, 
    autoTradingActive, 
    setAutoTradingActive, 
    setBalance,
    addFunds,
    balance,
    apiKey,
    apiSecret,
    setApiKey,
    setApiSecret,
    testnetApiKey,
    testnetApiSecret,
    setTestnetApiKey,
    setTestnetApiSecret,
    syncBinanceBalance,
    geminiApiKey,
    setGeminiApiKey,
    notificationProvider,
    setNotificationProvider,
    discordWebhookUrl,
    setDiscordWebhookUrl,
    telegramBotToken,
    setTelegramBotToken,
    telegramChatId,
    setTelegramChatId,
    binanceMode,
    setBinanceMode,
    positionSizePercent,
    setPositionSizePercent,
    stopLossPercent,
    setStopLossPercent,
    maxHoldMinutes,
    setMaxHoldMinutes,
    positions,
    maxLogs,
    setMaxLogs,
    clearLogs,
    lastCheckAt,
    checkEnginePulse,
    watchlist
  } = useTradingStore();

  useEffect(() => {
    const updateTicker = () => {
      if (!lastCheckAt) {
        setSecondsSinceCheck(0);
        return;
      }
      const diff = Math.max(0, Math.floor((Date.now() - new Date(lastCheckAt).getTime()) / 1000));
      setSecondsSinceCheck(diff);
    };

    updateTicker();
    const timer = setInterval(updateTicker, 1000);
    return () => clearInterval(timer);
  }, [lastCheckAt]);

  const handleCheckPulse = async () => {
    setIsCheckingPulse(true);
    const result = await checkEnginePulse();
    setIsCheckingPulse(false);
    if (result && result.message) {
      setPulseBannerMessage(result.message);
      setTimeout(() => setPulseBannerMessage(null), 8000);
    }
  };

  const handleEnablePush = async () => {
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        alert("Notificările sunt acum activate!");
      } else {
        alert("Nu s-a putut obține permisiunea pentru notificări.\n\nNOTĂ: Dacă te afli în preview-ul integrat, browserele blochează deseori ferestrele pop-up pentru notificări din iframe-uri.\n\nTe rog să deschizi aplicația într-un tab nou (folosind butonul de 'Open in new tab' din dreapta sus) și să încerci din nou.");
      }
    } catch (err) {
      alert("Eroare la solicitarea notificărilor. Te rog deschide aplicația într-un tab nou și încearcă din nou.");
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto max-w-2xl mx-auto pb-32">
      <div className="mb-10">
        <h2 className="text-2xl font-serif text-white tracking-tight">Setări Platformă</h2>
        <p className="text-zinc-400 mt-2 text-sm">Configurare parametri aplicație și intervale de timp.</p>
      </div>

      <div className="max-w-2xl space-y-8">
        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-serif text-zinc-200">Automatizare Calcul (Auto-Trading AI)</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">{autoTradingActive ? `Activ` : 'Oprit'}</span>
              <button 
                onClick={() => setAutoTradingActive(!autoTradingActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${autoTradingActive ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoTradingActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          
          <p className="text-sm text-zinc-400 mb-6">
            Sistemul rulează modelele de AI pentru a genera semnale și a efectua tranzacții automate pentru activele marcate ca <strong>"Activ"</strong>.
          </p>
        </div>

        {/* Engine Exit & Risk:Reward Management Card */}
        <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/40 to-emerald-950/20 border border-emerald-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-serif text-white">Motor Ieșire Dinamică & Risk:Reward (AI 2.0)</h3>
              <p className="text-xs text-emerald-400/90">Optimare asimetrică: Profit Mediu ~ +4.0% vs. Pierdere Medie ~ -2.0% (Raport 2:1)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-zinc-300 mb-4">
            <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-white/5 space-y-1.5">
              <div className="font-semibold text-emerald-300 flex items-center justify-between">
                <span>🚀 Lăsare Câștigători să Alerge</span>
                <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-400">ScorIeșire &lt; 55</span>
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Profitul nu se mai închide la +1.5%! Dacă semnalul AI & OppScore rămân puternice, poziția este lăsată să urce spre +4%, +6%+!
              </p>
            </div>

            <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-white/5 space-y-1.5">
              <div className="font-semibold text-rose-300 flex items-center justify-between">
                <span>✂️ Tăiere Agresivă Pierderi</span>
                <span className="text-[10px] bg-rose-500/20 px-2 py-0.5 rounded text-rose-400">Smart Cut at -2%</span>
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Dacă probabilitatea AI scade sau trendul devine bearish, pierderea se taie imediat la -1.8% ~ -2.0%, fără a aștepta SL de -3.8%!
              </p>
            </div>

            <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-white/5 space-y-1.5">
              <div className="font-semibold text-amber-300 flex items-center justify-between">
                <span>🛡️ Protecție Break-Even</span>
                <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-400">Vârf &ge; +1.5%</span>
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Când PnL atinge +1.5%, Stop Loss-ul urcă automat la +0.3% net pentru acoperirea comisioanelor Binance.
              </p>
            </div>

            <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-white/5 space-y-1.5">
              <div className="font-semibold text-sky-300 flex items-center justify-between">
                <span>🛑 Protecție Cooldown Anti-Whipsaw</span>
                <span className="text-[10px] bg-sky-500/20 px-2 py-0.5 rounded text-sky-400">30 Min Protecție</span>
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                După orice vânzare (TP/SL), moneda intră în cooldown 30 min, blocând re-intrările impulsive pe pierdere.
              </p>
            </div>
          </div>

          <div className="text-[11px] text-zinc-400 bg-zinc-950/80 p-3 rounded-xl border border-white/5 flex items-center justify-between">
            <span>Ponderi Multi-Factor Exit Score:</span>
            <span className="font-mono text-zinc-300">ML Prob (35%) | OppScore (25%) | Trend (15%) | Volum (10%) | %B (10%) | Sentiment (5%)</span>
          </div>
        </div>

        {/* Dynamic Position Sizing & Stop Loss Control Card */}
        <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-amber-950/20 border border-amber-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-serif text-white">Dimensionare Dinamică Poziții (% din Capital) & Stop Loss</h3>
              <p className="text-xs text-amber-400/90">Botul scalabilitate 10-20 poziții: calculează automat mărimea fiecărui ordin ca procent din Equity total.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Position Sizing % */}
            <div className="space-y-3 bg-zinc-950/60 p-4 rounded-xl border border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-white">Mărime Poziție per Ordin (% din Equity)</label>
                <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                  {positionSizePercent || 5}% din Capital
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Fiecare ordin se adaptează automat. Capital mai mare = ordin mai mare. Capital redus = ordin redus.
              </p>

              <div className="flex gap-2 flex-wrap">
                {[2, 3, 5, 8, 10, 15].map(pct => (
                  <button
                    key={pct}
                    onClick={() => setPositionSizePercent(pct)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                      (positionSizePercent || 5) === pct
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold"
                        : "bg-zinc-900/60 text-zinc-400 border-white/5 hover:bg-white/5"
                    )}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Simulation Preview */}
              <div className="text-[11px] text-zinc-300 bg-zinc-900/80 p-2.5 rounded-lg border border-amber-500/10 space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Ordin estimat pe Equity-ul curent (${(balance || 100).toFixed(2)}):</span>
                  <span className="font-mono text-amber-400 font-bold">${((balance || 100) * ((positionSizePercent || 5) / 100)).toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-400">
                  <span>Exemplu $1,000 USDT total ➔ <strong className="text-zinc-200">${1000 * ((positionSizePercent || 5) / 100)} USDT</strong> / ordin</span>
                  <span>Capacitate: ~{Math.floor(100 / (positionSizePercent || 5))} poziții simultan</span>
                </div>
              </div>
            </div>

            {/* Stop Loss % */}
            <div className="space-y-3 bg-zinc-950/60 p-4 rounded-xl border border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-white">Stop Loss Protecție Siguranță (%)</label>
                <span className="text-xs font-mono font-bold bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded border border-rose-500/30">
                  -{Math.abs(stopLossPercent || 2.0).toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Limita strictă de stop loss la care botul execută ieșirea automată pentru protecția capitalului.
              </p>

              <div className="flex gap-2 flex-wrap">
                {[1.0, 1.5, 2.0, 2.5, 3.0, 4.0].map(sl => (
                  <button
                    key={sl}
                    onClick={() => setStopLossPercent(sl)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                      (stopLossPercent || 2.0) === sl
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold"
                        : "bg-zinc-900/60 text-zinc-400 border-white/5 hover:bg-white/5"
                    )}
                  >
                    -{sl.toFixed(1)}%
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-zinc-300 bg-zinc-900/80 p-2.5 rounded-lg border border-rose-500/10 space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Pierdere maximă per tranzacție (la {positionSizePercent || 5}% alloc):</span>
                  <span className="font-mono text-rose-400 font-bold">-{(((positionSizePercent || 5) / 100) * (stopLossPercent || 2.0)).toFixed(2)}% din capital</span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  💡 Notă: Pe lumânări extreme de volatilitate (slippage/gaps pe altcoins), prețul executat pe Binance poate fi primul preț de piață disponibil.
                </p>
              </div>
            </div>

            {/* Max Hold Time Limit (Minutes) */}
            <div className="space-y-3 bg-zinc-950/60 p-4 rounded-xl border border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-white">Timp Maxim Deținere Poziție (Min)</label>
                <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                  {maxHoldMinutes && maxHoldMinutes > 0 ? `${maxHoldMinutes} minute` : 'Dezactivat (0 min)'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Regulă dinamică de timp: dacă poziția este pe <strong>profit (PnL &ge; 0)</strong>, timpul de deținere crește cu <strong>+50% (1/2)</strong> pentru maximizarea câștigurilor (ex: {maxHoldMinutes ?? 5} min &rarr; {( (maxHoldMinutes ?? 5) * 1.5 ).toFixed(1)} min). Dacă este pe <strong>minus (PnL &lt; 0)</strong> la expirarea celor {maxHoldMinutes ?? 5} min, se vinde imediat!
              </p>

              <div className="flex gap-2 flex-wrap">
                {[3, 5, 10, 15, 30, 0].map(mins => (
                  <button
                    key={mins}
                    onClick={() => setMaxHoldMinutes(mins)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                      (maxHoldMinutes ?? 5) === mins
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold"
                        : "bg-zinc-900/60 text-zinc-400 border-white/5 hover:bg-white/5"
                    )}
                  >
                    {mins === 0 ? 'Fără limită (0m)' : `${mins} min`}
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-zinc-300 bg-zinc-900/80 p-2.5 rounded-lg border border-amber-500/10 space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Strategie Scalping Timp Limitat:</span>
                  <span className="font-mono text-amber-400 font-bold">{maxHoldMinutes && maxHoldMinutes > 0 ? `Închidere automată la ⏱️ ${maxHoldMinutes} min` : 'Fără expirare pe timp'}</span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  ⚡ Previne blocarea capitalului în poziții stagnante și forțează rotirea rapidă a capitalului pe micro-trenduri.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
          <h3 className="font-serif text-lg mb-4 text-white">Interval Actualizare Date & Prețuri</h3>
          <p className="text-sm text-zinc-400 mb-6">
            Frecvența cu care se actualizează prețurile de pe piață, se verifică Stop Loss / Take Profit și se reîmprospătează interfața (Dashboard).
          </p>
          
          <div className="flex gap-4 flex-wrap">
            {[10, 30, 60, 300].map(val => (
              <button
                key={val}
                onClick={() => setDataInterval(val)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors border ${
                  dataInterval === val 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-zinc-800/40 text-zinc-300 border-white/5 hover:bg-white/5'
                }`}
              >
                {val === 300 ? '5 min' : val === 60 ? '1 min' : `${val} sec`}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
          <h3 className="font-serif text-lg mb-4 text-white">Interval Analiză AI & Execuție Semnale</h3>
          <p className="text-sm text-zinc-400 mb-6">
            Frecvența cu care se apelează modelul AI (LLM / Model ML) pentru a recalcula probabilitățile, a genera semnale (BUY/SELL) și a lua decizii de execuție. Un interval mai mare economisește apeluri API.
          </p>
          
          <div className="flex gap-4 flex-wrap">
            {[30, 60, 120, 300, 900].map(val => (
              <button
                key={val}
                onClick={() => setAnalysisInterval(val)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors border ${
                  analysisInterval === val 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-zinc-800/40 text-zinc-300 border-white/5 hover:bg-white/5'
                }`}
              >
                {val >= 60 ? `${val / 60} min` : `${val} sec`}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-serif text-zinc-200">Conectare Exchange (Binance)</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Configurează cheile API pentru Binance Testnet și Live. Pentru securitate maxima, dezactivează permisiunile de retragere (Withdrawals).
              </p>
            </div>
          </div>

          {/* Switch rapid pentru Mod Testnet */}
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl mb-6 flex items-center justify-between">
            <div className="pr-4">
              <div className="flex items-center gap-2">
                <span className="font-medium text-amber-200 text-sm">Mod Testnet (Binance Testnet)</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase ${
                  binanceMode === 'testnet' 
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-400/30 font-bold' 
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                }`}>
                  {binanceMode === 'testnet' ? 'ACTIV' : 'INACTIV'}
                </span>
              </div>
              <p className="text-xs text-amber-300/80 mt-1">
                Lansează oricând tranzacții în mediul securizat de test <strong>testnet.binance.vision</strong> fără niciun risc pentru fondurile reale.
              </p>
            </div>
            <button 
              type="button"
              onClick={() => setBinanceMode(binanceMode === 'testnet' ? 'paper' : 'testnet')}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                binanceMode === 'testnet' ? 'bg-amber-500' : 'bg-zinc-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                binanceMode === 'testnet' ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="mb-6">
            <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2 font-sans">Mod Execuție Selectat</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['paper', 'testnet', 'live'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setBinanceMode(mode)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-colors border text-center ${
                    binanceMode === mode 
                      ? (mode === 'live' 
                          ? 'bg-red-500/20 text-red-300 border-red-500/40 font-semibold' 
                          : mode === 'testnet' 
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold' 
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold') 
                      : 'bg-zinc-800/40 text-zinc-400 border-white/5 hover:bg-white/5'
                  }`}
                >
                  {mode === 'paper' ? 'Paper (Demo Local)' : mode === 'testnet' ? 'Binance Testnet' : 'Binance Real (LIVE)'}
                </button>
              ))}
            </div>
            {binanceMode === 'live' && (
              <p className="text-xs text-red-400 mt-3 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                ⚠️ ATENȚIE: Modul LIVE este activat! Tranzacțiile vor fi trimise către API-ul Binance Real cu capitalul tău din cont.
              </p>
            )}
            {binanceMode === 'testnet' && (
              <div className="mt-3 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-xs text-amber-200 space-y-1.5">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <span>🟡 MOD TESTNET ACTIV (testnet.binance.vision)</span>
                </div>
                <p className="text-zinc-300 text-[11px] leading-relaxed">
                  Dacă balanța citită din API este <strong>0.009 USDT</strong>: Conturile de testnet.binance.vision au adesea soldul consumat. Pentru a re-încărca 10.000 USDT de test pe serverul oficial Binance:
                  <br />
                  1. Intră pe <a href="https://testnet.binance.vision" target="_blank" rel="noreferrer" className="text-amber-400 underline font-semibold">testnet.binance.vision ↗</a> și autentifică-te cu GitHub.
                  <br />
                  2. Apasă <strong>Generate API Key</strong> sau <strong>Reset / Faucet Spot Assets</strong>.
                  <br />
                  3. În aplicație, am activat protecția de sold minim ($300 USDT) pentru ca testarea să nu fie blocată.
                </p>
              </div>
            )}
          </div>

          {/* Câmpuri Binance Testnet */}
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider font-mono">Binance Testnet Credentials</span>
              <a 
                href="https://testnet.binance.vision" 
                target="_blank" 
                rel="noreferrer" 
                className="text-[11px] text-amber-400 hover:underline"
              >
                Obține Chei Testnet ↗
              </a>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-400 mb-1 font-sans">Testnet API Key</label>
              <input 
                type="text" 
                value={testnetApiKey}
                onChange={(e) => setTestnetApiKey(e.target.value)}
                placeholder="Ex: 62a8f9b2c3d4..." 
                className="w-full bg-zinc-800/60 border border-amber-500/20 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-amber-500/50 font-mono text-sm" 
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-400 mb-1 font-sans">Testnet Secret Key</label>
              <input 
                type="password" 
                value={testnetApiSecret}
                onChange={(e) => setTestnetApiSecret(e.target.value)}
                placeholder="Ex: 98f7e6d5c4b3..." 
                className="w-full bg-zinc-800/60 border border-amber-500/20 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-amber-500/50 font-mono text-sm" 
              />
            </div>
          </div>

          {/* Câmpuri Binance Live */}
          <div className="p-4 rounded-xl bg-zinc-800/30 border border-white/5 space-y-4">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono block">Binance Live (Real) Credentials</span>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-sans">Live Binance API Key</label>
              <input 
                type="text" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Introdu Live API Key..." 
                className="w-full bg-zinc-800/40 border border-white/5 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-white/20 font-mono text-sm" 
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-sans">Live Binance Secret Key</label>
              <input 
                type="password" 
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Introdu Live API Secret..." 
                className="w-full bg-zinc-800/40 border border-white/5 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-white/20 font-mono text-sm" 
              />
            </div>
          </div>

          {/* Test & Sync Balance Button */}
          <div className="mt-6 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <button
              type="button"
              disabled={syncStatus.loading || binanceMode === 'paper'}
              onClick={async () => {
                setSyncStatus({ loading: true, message: 'Se testează conexiunea și se descarcă balanța...', error: false });
                const res = await syncBinanceBalance();
                if (res && res.success) {
                  setSyncStatus({ 
                    loading: false, 
                    message: `Sincronizat cu succes! Balanță găsită: $${res.balance?.toFixed(2) || '0.00'} USDT`, 
                    error: false 
                  });
                } else {
                  setSyncStatus({ 
                    loading: false, 
                    message: `Eroare conexiune: ${res?.error || 'Cheile API sunt invalide sau respinse de Binance.'}`, 
                    error: true 
                  });
                }
              }}
              className="px-4 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 font-medium rounded-lg text-xs transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.loading ? 'animate-spin' : ''}`} />
              <span>Sincronizează Balanța din {binanceMode === 'testnet' ? 'Testnet' : binanceMode === 'live' ? 'Binance Live' : 'Exchange'}</span>
            </button>

            {syncStatus.message && (
              <div className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 ${
                syncStatus.error 
                  ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20' 
                  : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
              }`}>
                {syncStatus.error ? <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
                <span>{syncStatus.message}</span>
              </div>
            )}
          </div>

          {/* Binance Service Inspector */}
          <div className="mt-6 pt-4 border-t border-white/5 bg-zinc-950/50 rounded-xl p-4 border border-white/5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Inspector BinanceService.ts (Live Test & Interogare Directă)
            </h4>
            <p className="text-xs text-zinc-400 mb-3">
              Poți apela serviciul dedicat <code className="text-amber-300 font-mono text-[11px]">server/services/BinanceService.ts</code> direct din browser sau din cod pentru a interoga contul și tranzacțiile tale.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-3">
              <button
                type="button"
                disabled={binanceInspectorLoading || binanceMode === 'paper'}
                onClick={async () => {
                  setBinanceInspectorLoading(true);
                  try {
                    const res = await fetch('/api/binance/account');
                    const data = await res.json();
                    setBinanceInspectorResult(data);
                  } catch (err: any) {
                    setBinanceInspectorResult({ error: err?.message || 'Eroare conectare' });
                  } finally {
                    setBinanceInspectorLoading(false);
                  }
                }}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-mono border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
              >
                1. /api/binance/account (getAccountInfo)
              </button>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={binanceInspectorSymbol}
                  onChange={(e) => setBinanceInspectorSymbol(e.target.value.toUpperCase())}
                  placeholder="BTCUSDT"
                  className="w-24 bg-zinc-900 border border-white/10 rounded px-2 py-1 text-xs font-mono text-zinc-200 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={binanceInspectorLoading || binanceMode === 'paper'}
                  onClick={async () => {
                    setBinanceInspectorLoading(true);
                    try {
                      const res = await fetch(`/api/binance/trades?symbol=${binanceInspectorSymbol}`);
                      const data = await res.json();
                      setBinanceInspectorResult(data);
                    } catch (err: any) {
                      setBinanceInspectorResult({ error: err?.message || 'Eroare conectare' });
                    } finally {
                      setBinanceInspectorLoading(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-mono border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  2. /api/binance/trades (getMyTrades)
                </button>
              </div>
            </div>

            {binanceInspectorLoading && (
              <p className="text-xs text-amber-400 font-mono animate-pulse">Se interoghează BinanceService.ts...</p>
            )}

            {binanceInspectorResult && !binanceInspectorLoading && (
              <div className="mt-2 bg-zinc-900 border border-white/5 rounded-lg p-3 text-xs font-mono overflow-x-auto max-h-60">
                <div className="flex justify-between items-center mb-1 text-[10px] text-zinc-500 uppercase">
                  <span>Răspuns Binance API:</span>
                  <button type="button" onClick={() => setBinanceInspectorResult(null)} className="text-zinc-400 hover:text-white">Închide</button>
                </div>
                <pre className="text-amber-300/90 text-[11px] whitespace-pre-wrap">
                  {JSON.stringify(binanceInspectorResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-serif text-zinc-200 mb-4">Google Gemini (AI Analyst)</h3>
          <p className="text-sm text-zinc-400 mb-4">Introdu propria ta cheie API Gemini pentru a debloca capabilitățile AI Analyst. Cheia este stocată local și folosită pentru a genera rapoarte și semnale.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-sans">Gemini API Key</label>
              <input 
                type="password" 
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIzaSy..." 
                className="w-full bg-zinc-800/40 border border-white/5 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-white/20 font-mono text-sm" 
              />
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-serif text-zinc-200 mb-4">Notificări Telegram</h3>
          <p className="text-sm text-zinc-400 mb-4">Primește semnalele de tranzacționare și rapoartele de activitate direct pe telefon prin Telegram Bot.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-sans">Telegram Bot Token</label>
              <input 
                type="password" 
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                placeholder="Ex: 123456789:ABCdefGHIjklMNOpqrs..." 
                className="w-full bg-zinc-800/40 border border-white/5 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-white/20 font-mono text-sm" 
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-sans">Chat ID</label>
              <input 
                type="text" 
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="Ex: 123456789" 
                className="w-full bg-zinc-800/40 border border-white/5 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-white/20 font-mono text-sm" 
              />
            </div>

            <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
              <button
                type="button"
                disabled={telegramGuideLoading || !telegramBotToken}
                onClick={async () => {
                  setTelegramGuideLoading(true);
                  setTelegramGuideStatus(null);
                  try {
                    // First ensure latest keys are saved to server
                    await fetch('/api/bot/config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        telegramBotToken: telegramBotToken.trim(),
                        telegramChatId: telegramChatId.trim(),
                        notificationProvider: 'telegram'
                      })
                    });

                    const res = await fetch('/api/bot/send-telegram-guide', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ chatId: telegramChatId.trim() })
                    });
                    const data = await res.json();
                    if (data && data.success) {
                      setTelegramGuideStatus({
                        message: '✅ Lista de comenzi a fost trimisă cu succes pe Telegram! O poți fixa (Pin) în chat.',
                        error: false
                      });
                    } else {
                      setTelegramGuideStatus({
                        message: `⚠️ Eroare: ${data?.error || 'Verifică Bot Token și Chat ID'}`,
                        error: true
                      });
                    }
                  } catch (err: any) {
                    setTelegramGuideStatus({
                      message: `⚠️ Eroare rețea: ${err?.message || 'Nu s-a putut trimite ghidul'}`,
                      error: true
                    });
                  } finally {
                    setTelegramGuideLoading(false);
                  }
                }}
                className="px-4 py-2 bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 font-medium rounded-lg text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span>📌 Trimite & Fixează Lista de Comenzi pe Telegram</span>
              </button>

              {telegramGuideStatus && (
                <div className={`text-xs p-2.5 rounded-lg font-mono ${
                  telegramGuideStatus.error
                    ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                }`}>
                  {telegramGuideStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-serif text-zinc-200 mb-2">Capacitate Stocare Loguri (Server / VPS)</h3>
          <p className="text-sm text-zinc-400 mb-4">Setează numărul maxim de loguri păstrate în memorie și pe server. Ideal pentru găzduire continuă pe un VPS.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2 font-sans">Număr Maxim Loguri Salvate</label>
              <div className="flex items-center gap-2 flex-wrap">
                {[100, 250, 500, 1000, 2500, 5000, 10000].map(limit => (
                  <button
                    key={limit}
                    onClick={() => setMaxLogs(limit)}
                    className={`px-3.5 py-2 font-medium rounded-lg text-xs transition-colors border ${
                      (maxLogs || 1000) === limit
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold'
                        : 'bg-zinc-800/40 text-zinc-300 border-white/5 hover:bg-zinc-800'
                    }`}
                  >
                    {limit >= 1000 ? `${limit / 1000}k` : limit} {limit === 1000 ? '(Recomandat)' : limit >= 2500 ? '(VPS)' : ''}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-2 flex items-center justify-between border-t border-white/5">
              <span className="text-xs text-zinc-500">Capacitate curentă selectată: <strong className="text-emerald-400">{maxLogs || 1000} loguri</strong></span>
              <button
                onClick={() => {
                  if (window.confirm('Ștergi toate logurile din memorie?')) clearLogs();
                }}
                className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
              >
                Șterge toate logurile
              </button>
            </div>
          </div>
        </div>

        {/* Top-Up / Adăugare Fonduri Suplimentare */}
        <div className="bg-zinc-900/50 border border-emerald-500/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-serif text-zinc-200 mb-1 flex items-center gap-2">
                <span>➕ Adăugare Fonduri în Sesiunea Curentă</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">Fără Resetare</span>
              </h3>
              <p className="text-sm text-zinc-400">
                Adaugă lichidități suplimentare direct în balanța activă fără a închide pozițiile deschise sau a șterge istoricul.
              </p>
            </div>
            <div className="text-right bg-zinc-950/60 px-3 py-1.5 rounded-lg border border-white/5">
              <span className="text-[10px] uppercase text-zinc-500 block">Balanță Curentă</span>
              <span className="text-sm font-mono font-bold text-emerald-400">${balance.toFixed(2)} USDT</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-400">Adăugare rapidă:</span>
              {[10, 25, 50, 100, 200, 500].map(amt => (
                <button
                  key={amt}
                  onClick={() => {
                    addFunds(amt);
                    setTopupSuccessMsg(`+$${amt} USDT adăugați cu succes!`);
                    setTimeout(() => setTopupSuccessMsg(null), 4000);
                  }}
                  className="px-3 py-1 bg-zinc-800/80 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 rounded-lg text-xs font-mono transition-colors"
                >
                  +${amt} USDT
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1 max-w-md">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono">$</span>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={addTopupAmount}
                  onChange={(e) => setAddTopupAmount(e.target.value)}
                  placeholder="Suma custom (ex: 75)..."
                  className="w-full bg-zinc-950/80 border border-white/10 rounded-lg pl-7 pr-14 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 font-mono"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono">USDT</span>
              </div>
              <button
                onClick={() => {
                  const amt = parseFloat(addTopupAmount);
                  if (isNaN(amt) || amt <= 0) return;
                  addFunds(amt);
                  setTopupSuccessMsg(`+$${amt.toFixed(2)} USDT adăugați cu succes în balanță!`);
                  setTimeout(() => setTopupSuccessMsg(null), 4000);
                }}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-lg text-xs transition-colors whitespace-nowrap shadow-lg shadow-emerald-500/10"
              >
                Adaugă +${parseFloat(addTopupAmount) || 0} USDT
              </button>
            </div>

            {topupSuccessMsg && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{topupSuccessMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Paper Trading Setup (Resetare) */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-serif text-zinc-200 mb-2">Resetare Totală Capital & Sesiune (Reinițializare)</h3>
          <p className="text-sm text-zinc-400 mb-4">Setează un capital inițial curat (ex: $100, $200, $300 sau $500 USDT). Această acțiune va închide pozițiile simulative curente și va reseta istoricul.</p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {[100, 200, 300, 500, 1000].map(amt => (
                <button 
                  key={amt}
                  onClick={async () => {
                    setBalance(amt);
                    setCustomPaperBalance(String(amt));
                    try {
                      await fetch('/api/bot/reset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ balance: amt })
                      });
                    } catch (e) {
                      console.error('Reset error:', e);
                    }
                  }}
                  className={`px-3.5 py-1.5 font-medium rounded-lg transition-colors text-xs border ${
                    amt === 100
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-semibold'
                    : 'bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 border-white/10'
                  }`}>
                  Setează $${amt} USDT {amt === 100 ? '(Implicit $100)' : ''}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 max-w-sm">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono">$</span>
                <input
                  type="number"
                  min="10"
                  max="100000"
                  value={customPaperBalance}
                  onChange={(e) => setCustomPaperBalance(e.target.value)}
                  placeholder="Ex: 100"
                  className="w-full bg-zinc-950/80 border border-white/10 rounded-lg pl-7 pr-12 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 font-mono"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono">USDT</span>
              </div>
              <button
                onClick={async () => {
                  const amt = parseFloat(customPaperBalance);
                  if (isNaN(amt) || amt < 1) return;
                  setBalance(amt);
                  try {
                    await fetch('/api/bot/reset', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ balance: amt })
                    });
                  } catch (e) {
                    console.error('Reset error:', e);
                  }
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
              >
                Resetare Capital
              </button>
            </div>

            <p className="text-xs text-zinc-500">Resetarea capitalului va închide pozițiile simulative curente și va aplica noul sold în serverul 24/7.</p>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-lg font-serif text-zinc-200 mb-2">Notificări Push Desktop</h3>
            <p className="text-sm text-zinc-400 mb-4">Primește notificări push direct pe desktop atunci când AI-ul execută o tranzacție automată de cumpărare sau vânzare.</p>
            <button 
              onClick={handleEnablePush}
              className="px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold rounded-lg text-sm transition-colors">
              Activează Notificările
            </button>
          </div>

          <NotificationDiagnostic />
        </div>

        {/* Sequential Launch Circuit Banner */}
        <div className="bg-zinc-900/80 border border-emerald-500/20 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/5">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                  Circuit de Control & Pornire Sigură (Secvență Pas-cu-Pas)
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                La pornirea aplicației, Serverul 24/7 este OPRIT implicit. Parcurgeți secvența de mai jos pentru pornire sigură:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Step 1: ML Strategies */}
            <div className={cn(
              "p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all",
              mlEngineStarted 
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-zinc-950/60 border-white/10 text-zinc-300"
            )}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-zinc-400">PASUL 1</span>
                  {mlEngineStarted && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
                <h4 className="text-xs font-semibold text-white">1. ML Strategies & Indicatori</h4>
                <p className="text-[11px] text-zinc-400 mt-1">Calcul semnale RSI/MACD & analiză sentiment din știri.</p>
              </div>
              <button
                type="button"
                onClick={handleStartMl}
                className={cn(
                  "w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  mlEngineStarted
                    ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                )}
              >
                {mlEngineStarted ? "✓ ML Strategies Activ" : "Pornire Manuală ML Strategies"}
              </button>
            </div>

            {/* Step 2: AI Strategy Lab */}
            <div className={cn(
              "p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all",
              aiStrategyLabStarted 
                ? "bg-purple-500/10 border-purple-500/30 text-purple-300"
                : "bg-zinc-950/60 border-white/10 text-zinc-300"
            )}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-zinc-400">PASUL 2</span>
                  {aiStrategyLabStarted && <CheckCircle2 className="w-4 h-4 text-purple-400" />}
                </div>
                <h4 className="text-xs font-semibold text-white">2. AI Strategy Lab</h4>
                <p className="text-[11px] text-zinc-400 mt-1">Validare reguli AI, praguri probabilitate & Stop-Loss.</p>
              </div>
              <button
                type="button"
                onClick={handleStartAiLab}
                className={cn(
                  "w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  aiStrategyLabStarted
                    ? "bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30"
                    : "bg-purple-600 hover:bg-purple-500 text-white shadow-sm"
                )}
              >
                {aiStrategyLabStarted ? "✓ AI Lab Validat" : "Pornire Manuală AI Strategy Lab"}
              </button>
            </div>

            {/* Step 3: Server 24/7 & Auto-Trading */}
            <div className={cn(
              "p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all",
              autoTradingActive 
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-zinc-950/60 border-white/10 text-zinc-300"
            )}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-zinc-400">PASUL 3 (FINAL)</span>
                  <span className={cn("w-2 h-2 rounded-full", autoTradingActive ? "bg-emerald-400 animate-pulse" : "bg-rose-500")} />
                </div>
                <h4 className="text-xs font-semibold text-white">3. Server 24/7 & Tranzacționare</h4>
                <p className="text-[11px] text-zinc-400 mt-1">Execuție automată ordine pe Binance / Testnet / Paper.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!mlEngineStarted) handleStartMl();
                  if (!aiStrategyLabStarted) handleStartAiLab();
                  setAutoTradingActive(!autoTradingActive);
                }}
                className={cn(
                  "w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  autoTradingActive
                    ? "bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                )}
              >
                {autoTradingActive ? "OPREȘTE Server 24/7" : "PORNEȘTE Server 24/7 + Tranzacționarea"}
              </button>
            </div>
          </div>
        </div>

        {/* Live Engine Pulse & Heartbeat Indicator Card */}
        <div className="bg-gradient-to-r from-zinc-900/90 via-zinc-900/80 to-zinc-950 border border-cyan-500/30 rounded-2xl p-6 shadow-lg backdrop-blur-md relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3.5 w-3.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500"></span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                    Puls Engine 24/7 — Verificare Stare Server
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                    ONLINE 24/7
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Verifică în orice moment că bucla de scanare a serverului rulează activ în fundal fără întreruperi.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isCheckingPulse}
              onClick={handleCheckPulse}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 text-black hover:bg-cyan-400 transition-all font-mono shadow-md cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Activity className={cn("w-4 h-4", isCheckingPulse && "animate-spin")} />
              <span>{isCheckingPulse ? "Se verifică Serverul..." : "💓 Ia Pulsul Acum"}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs font-mono">
            <div className="p-3 bg-zinc-950/70 border border-white/5 rounded-xl">
              <span className="text-[10px] uppercase text-zinc-500 block mb-1">Ultima Verificare Server</span>
              <p className="text-sm font-semibold text-cyan-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                {secondsSinceCheck === 0 ? "ACUM (Sub 1s)" : `Acum ${secondsSinceCheck}s`}
              </p>
            </div>

            <div className="p-3 bg-zinc-950/70 border border-white/5 rounded-xl">
              <span className="text-[10px] uppercase text-zinc-500 block mb-1">Stare Buclă Fundal</span>
              <p className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                {autoTradingActive ? "AUTO-TRADING ACTIV" : "STANDBY (Monitorizare)"}
              </p>
            </div>

            <div className="p-3 bg-zinc-950/70 border border-white/5 rounded-xl">
              <span className="text-[10px] uppercase text-zinc-500 block mb-1">Frecvență Scanare ML</span>
              <p className="text-sm font-semibold text-zinc-200">
                La fiecare {analysisInterval || 60} secunde
              </p>
            </div>

            <div className="p-3 bg-zinc-950/70 border border-white/5 rounded-xl">
              <span className="text-[10px] uppercase text-zinc-500 block mb-1">Perechi Monitorizate</span>
              <p className="text-sm font-semibold text-zinc-200">
                {watchlist.filter(w => w.active).length} perechi crypto
              </p>
            </div>
          </div>

          {pulseBannerMessage && (
            <div className="mt-3 p-3 bg-cyan-950/90 border border-cyan-500/50 rounded-xl text-xs text-cyan-200 flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="font-mono">{pulseBannerMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
