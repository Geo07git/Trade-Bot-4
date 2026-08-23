import React, { useState, useEffect } from 'react';
import { useTradingStore } from '../store';
import { requestNotificationPermission } from '../services/notifications';
import { NotificationDiagnostic } from './NotificationDiagnostic';
import { AICostMonitor } from './AICostMonitor';
import { apiFetch, safeJson } from '../utils/apiHelper';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  Clock, 
  Zap, 
  Laptop, 
  Download, 
  Copy, 
  Check, 
  CreditCard, 
  Bot, 
  Bell, 
  Sliders, 
  ShieldAlert,
  Layers,
  Server,
  Globe,
  Wifi,
  XCircle,
  RotateCcw,
  Cpu,
  GitMerge,
  Sparkles,
  BrainCircuit
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<'engine' | 'intervals' | 'account' | 'ai' | 'notifications' | 'system'>('engine');

  const [syncStatus, setSyncStatus] = useState<{ loading: boolean; message: string | null; error: boolean }>(
    { loading: false, message: null, error: false }
  );
  const [binanceInspectorLoading, setBinanceInspectorLoading] = useState(false);
  const [binanceInspectorSymbol, setBinanceInspectorSymbol] = useState('BTCUSDT');
  const [binanceInspectorResult, setBinanceInspectorResult] = useState<any>(null);
  const [telegramGuideLoading, setTelegramGuideLoading] = useState(false);
  const [telegramGuideStatus, setTelegramGuideStatus] = useState<{ message: string; error: boolean } | null>(null);
  const [discordTestLoading, setDiscordTestLoading] = useState(false);
  const [discordTestStatus, setDiscordTestStatus] = useState<{ message: string; error: boolean } | null>(null);
  const [customPaperBalance, setCustomPaperBalance] = useState('100');
  const [addTopupAmount, setAddTopupAmount] = useState('10');
  const [topupSuccessMsg, setTopupSuccessMsg] = useState<string | null>(null);


  const [serverTestStatus, setServerTestStatus] = useState<{ loading: boolean; message: string | null; success: boolean | null }>({
    loading: false,
    message: null,
    success: null
  });

  const handleTestServerConnection = async () => {
    setServerTestStatus({ loading: true, message: 'Se testează conexiunea la server...', success: null });
    try {
      const res = await apiFetch('/api/bot/state');
      const data = await safeJson(res, null);
      if (res.ok && data) {
        setServerTestStatus({
          loading: false,
          message: `Conectat cu succes la Server 24/7! (Loguri: ${data.logs?.length || 0}, Semnale: ${data.signalJournal?.length || 0})`,
          success: true
        });
      } else {
        setServerTestStatus({
          loading: false,
          message: `Serverul a răspuns cu eroare HTTP ${res.status}.`,
          success: false
        });
      }
    } catch (err: any) {
      setServerTestStatus({
        loading: false,
        message: `Nu s-a putut conecta la server (${err?.message || 'Eroare rețea'}). Se folosește Modul Autonom Client pe Mobil.`,
        success: false
      });
    }
  };

  // Pulse & Circuit State
  const [secondsSinceCheck, setSecondsSinceCheck] = useState<number>(0);
  const [isCheckingPulse, setIsCheckingPulse] = useState(false);
  const [pulseBannerMessage, setPulseBannerMessage] = useState<string | null>(null);
  const [confirmResetAcc, setConfirmResetAcc] = useState(false);

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
    serverUrl,
    setServerUrl,
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
    aiUsageStats,
    notificationProvider,
    setNotificationProvider,
    discordWebhookUrl,
    setDiscordWebhookUrl,
    telegramBotToken,
    setTelegramBotToken,
    telegramChatId,
    setTelegramChatId,
    reportConfig,
    setReportConfig,
    binanceMode,
    setBinanceMode,
    positionSizePercent,
    setPositionSizePercent,
    stopLossPercent,
    setStopLossPercent,
    maxHoldMinutes,
    setMaxHoldMinutes,
    scalpingConfig,
    setScalpingConfig,
    setMaxNegativeHoldMinutes,
    setEnableMaxNegativeHold,
    executionEngine,
    setExecutionEngine,
    mlModelType,
    setMlModelType,
    positions,
    maxLogs,
    setMaxLogs,
    clearLogs,
    lastCheckAt,
    checkEnginePulse,
    watchlist,
    accumulationBalance = 0,
    sessionCycleCount = 1,
    accumulationTargetPercent = 3.0,
    accumulationTargetEnabled = true,
    setAccumulationTargetPercent,
    toggleAccumulationTarget,
    resetAccumulationVault,
    consolidateAccumulation
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

  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(label);
    setTimeout(() => setCopiedCmd(null), 3000);
  };

  const tabItems: Array<{ id: 'engine' | 'intervals' | 'account' | 'ai' | 'notifications' | 'system'; label: string; icon: any; badge?: string }> = [
    { id: 'engine', label: 'Execuție & Risc', icon: Activity, badge: executionEngine === 'both' ? 'Hibrid' : executionEngine === 'grid' ? 'Grid' : 'Scalping' },
    { id: 'intervals', label: 'Intervale & Server 24/7', icon: Clock },
    { id: 'account', label: 'Cont & Exchange', icon: CreditCard, badge: binanceMode.toUpperCase() },
    { id: 'ai', label: 'Modele AI & Gemini', icon: Bot },
    { id: 'notifications', label: 'Notificări', icon: Bell },
    { id: 'system', label: 'Sistem & Desktop', icon: Sliders }
  ];

  return (
    <div className="p-3 sm:p-6 md:p-8 h-full overflow-y-auto max-w-4xl mx-auto pb-32">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif text-white tracking-tight">Setări Platformă G&amp;S-Trade-Bot</h2>
          <p className="text-zinc-400 mt-0.5 text-xs sm:text-sm">Configurare parametri motor, risc, chei API și intervale de timp.</p>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('trading_store');
            window.location.reload();
          }}
          className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 self-start sm:self-auto shadow-sm"
          title="Curăță starea locală din browser (trading_store) și reîncarcă aplicația"
        >
          <RotateCcw className="w-4 h-4 text-amber-400" />
          <span>Hard Refresh State (Reset Local)</span>
        </button>
      </div>

      {/* Top Tab Bar Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-zinc-900/90 border border-white/10 rounded-2xl mb-4 sm:mb-8 backdrop-blur-md">
        {tabItems.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between gap-1.5 cursor-pointer font-mono w-full",
                isActive
                  ? "bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/10"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 bg-zinc-950/40 border border-white/5"
              )}
            >
              <div className="flex items-center gap-1.5 truncate">
                <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-zinc-950" : "text-zinc-400")} />
                <span className="truncate">{tab.label}</span>
              </div>
              {tab.badge && (
                <span className={cn(
                  "px-1 py-0.2 rounded text-[8px] font-bold uppercase border shrink-0",
                  isActive ? "bg-zinc-950/20 text-zinc-950 border-zinc-950/30" : "bg-zinc-800 text-zinc-400 border-white/5"
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Engine & Risk */}
      {activeTab === 'engine' && (
        <div className="space-y-6">
          {/* Auto-Trading Toggle */}
          <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-serif text-white">Automatizare Calcul (Auto-Trading AI)</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Sistemul rulează modelele de AI pentru a genera semnale și a efectua tranzacții automate.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-mono font-bold px-2 py-0.5 rounded border", autoTradingActive ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-zinc-800 text-zinc-400 border-white/10")}>
                  {autoTradingActive ? 'ACTIV 24/7' : 'OPRIT'}
                </span>
                <button 
                  onClick={() => setAutoTradingActive(!autoTradingActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${autoTradingActive ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoTradingActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Execution Engine Selector Card (Both / Grid / Scalping) */}
          <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-cyan-950/20 border border-cyan-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-serif text-white">Motor de Execuție Automatizată</h3>
                  <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
                    {(executionEngine || 'both') === 'both' ? 'HIBRID (GRID + SCALPING)' : ((executionEngine || 'both') === 'grid' ? 'DOAR GRID' : 'DOAR SCALPING')}
                  </span>
                </div>
                <p className="text-xs text-cyan-400/90">Alege modul în care se vor executa ordinele automate pe piață.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
              {/* Option 1: Both */}
              <button
                onClick={() => setExecutionEngine('both')}
                className={cn(
                  "p-4 rounded-xl text-left border transition-all relative flex flex-col justify-between space-y-3 cursor-pointer",
                  (executionEngine || 'both') === 'both'
                    ? "bg-cyan-500/15 border-cyan-500/50 text-white shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-500/30"
                    : "bg-zinc-950/60 border-white/5 text-zinc-400 hover:bg-white/5 hover:border-white/10"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-cyan-300">⚡ Amândouă Odată</span>
                    <span className="text-[9px] font-mono bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded">Hibrid Complete</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-snug">
                    Rulează atât <strong>Smart AI Grid</strong> (în consolidare) cât și <strong>AI Scalping</strong> (pe impuls).
                  </p>
                </div>
                <div className="text-[10px] font-mono text-cyan-400/80 pt-2 border-t border-cyan-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span>Flexibilitate Maximă 24/7</span>
                </div>
              </button>

              {/* Option 2: Grid Only */}
              <button
                onClick={() => setExecutionEngine('grid')}
                className={cn(
                  "p-4 rounded-xl text-left border transition-all relative flex flex-col justify-between space-y-3 cursor-pointer",
                  executionEngine === 'grid'
                    ? "bg-emerald-500/15 border-emerald-500/50 text-white shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/30"
                    : "bg-zinc-950/60 border-white/5 text-zinc-400 hover:bg-white/5 hover:border-white/10"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-emerald-300">📊 Doar Grid</span>
                    <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">Range Only</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-snug">
                    Execută exclusiv ordine de rețea <strong>Smart AI Grid</strong> în canale de acumulare laterală. Scalping-ul este complet oprit.
                  </p>
                </div>
                <div className="text-[10px] font-mono text-emerald-400/80 pt-2 border-t border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>Oscilații & DCA Inteligent</span>
                </div>
              </button>

              {/* Option 3: Scalping Only */}
              <button
                onClick={() => setExecutionEngine('scalping')}
                className={cn(
                  "p-4 rounded-xl text-left border transition-all relative flex flex-col justify-between space-y-3 cursor-pointer",
                  executionEngine === 'scalping'
                    ? "bg-amber-500/15 border-amber-500/50 text-white shadow-lg shadow-amber-950/50 ring-1 ring-amber-500/30"
                    : "bg-zinc-950/60 border-white/5 text-zinc-400 hover:bg-white/5 hover:border-white/10"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-amber-300">🚀 Doar Scalping</span>
                    <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">Momentum Only</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-snug">
                    Execută exclusiv semnale de <strong>AI Scalping</strong> bazate pe scorul ML. Grid-ul este complet oprit.
                  </p>
                </div>
                <div className="text-[10px] font-mono text-amber-400/80 pt-2 border-t border-amber-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span>Intrări Ultra-Rapide</span>
                </div>
              </button>
            </div>
          </div>

          {/* ML Calculation Model Selection Card */}
          <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-amber-950/20 border border-amber-500/20 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-serif text-white">Motor Calcul Semnale ML</h3>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">
                      ACTIV
                    </span>
                  </div>
                  <p className="text-xs text-amber-300/80">
                    Procesare ultra-rapidă și stabilă a probabilităților de intrare, oportunităților de piață și semnalelor de tranzacționare.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-zinc-950/80 border border-white/10 px-3 py-1.5 rounded-xl">
                <span className="text-[11px] text-zinc-400">Mod Activ:</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  🌲 RANDOM FOREST (RF)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl text-left border border-amber-500/30 bg-amber-500/10 text-white space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300">Random Forest Classifier (18 Arbori Decizionali)</span>
                </div>
                <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">RF Active</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-snug">
                Calculează semnalele pe baza ansamblului <strong>Random Forest (18 arbori decizionali)</strong>, evaluând în timp real indicatorii tehnici cheie (RSI, ADX, EMA, Volum, Reversals, Platt Calibration) cu inferență sub 1ms.
              </p>
            </div>
          </div>

          {/* Engine Exit & Risk:Reward Management Card */}
          <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/40 to-emerald-950/20 border border-emerald-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-serif text-white">Motor Ieșire Dinamică & Risk:Reward (G&S-Trade-Bot)</h3>
                <p className="text-xs text-emerald-400/90">Optimare asimetrică: Profit Mediu ~ +4.0% vs. Pierdere Medie ~ -2.0% (Raport 2:1)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-zinc-300 mb-4">
              <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="font-semibold text-emerald-300 flex items-center justify-between">
                  <span>🚀 Lăsare Câștigători să Alerge</span>
                  <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-400 font-mono">ScorIeșire &lt; 55</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Profitul nu se mai închide fix la +1.5%! Dacă semnalul AI rămâne puternic, poziția urcă spre +4%, +6%+!
                </p>
              </div>

              <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="font-semibold text-rose-300 flex items-center justify-between">
                  <span>✂️ Tăiere Agresivă Pierderi</span>
                  <span className="text-[10px] bg-rose-500/20 px-2 py-0.5 rounded text-rose-400 font-mono">Smart Cut at -2%</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Dacă probabilitatea AI scade sau trendul devine bearish, pierderea se taie la -1.8% ~ -2.0%!
                </p>
              </div>

              <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="font-semibold text-amber-300 flex items-center justify-between">
                  <span>🛡️ Protecție Break-Even</span>
                  <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-400 font-mono">Vârf &ge; +1.5%</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Când PnL atinge +1.5%, Stop Loss urcă automat la +0.3% net pentru acoperirea comisioanelor.
                </p>
              </div>

              <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="font-semibold text-sky-300 flex items-center justify-between">
                  <span>🛑 Cooldown Anti-Whipsaw</span>
                  <span className="text-[10px] bg-sky-500/20 px-2 py-0.5 rounded text-sky-400 font-mono">30 Min Protecție</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  După orice vânzare, moneda intră în cooldown 30 min, blocând re-intrările impulsive.
                </p>
              </div>
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
                <p className="text-xs text-amber-400/90">Botul calculează automat mărimea fiecărui ordin ca procent din Equity total.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Position Sizing % */}
              <div className="space-y-3 bg-zinc-950/60 p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white">Mărime Poziție (% din Equity)</label>
                  <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                    {positionSizePercent || 5}% din Capital
                  </span>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {[2, 3, 5, 8, 10, 15].map(pct => (
                    <button
                      key={pct}
                      onClick={() => setPositionSizePercent(pct)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer",
                        (positionSizePercent || 5) === pct
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold"
                          : "bg-zinc-900/60 text-zinc-400 border-white/5 hover:bg-white/5"
                      )}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>

                <div className="text-[11px] text-zinc-300 bg-zinc-900/80 p-2.5 rounded-lg border border-amber-500/10 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Ordin pe Equity curent (${(balance || 100).toFixed(2)}):</span>
                    <span className="text-amber-400 font-bold">${((balance || 100) * ((positionSizePercent || 5) / 100)).toFixed(2)} USDT</span>
                  </div>
                </div>
              </div>

              {/* Stop Loss % */}
              <div className="space-y-3 bg-zinc-950/60 p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white">Stop Loss Siguranță (%)</label>
                  <span className="text-xs font-mono font-bold bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded border border-rose-500/30">
                    -{Math.abs(stopLossPercent || 2.0).toFixed(1)}%
                  </span>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0].map(sl => (
                    <button
                      key={sl}
                      onClick={() => setStopLossPercent(sl)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer",
                        (stopLossPercent || 2.0) === sl
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold"
                          : "bg-zinc-900/60 text-zinc-400 border-white/5 hover:bg-white/5"
                      )}
                    >
                      -{sl.toFixed(1)}%
                    </button>
                  ))}
                </div>

                <div className="text-[11px] text-zinc-300 bg-zinc-900/80 p-2.5 rounded-lg border border-rose-500/10 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Pierdere max per ordin:</span>
                    <span className="text-rose-400 font-bold">-{(((positionSizePercent || 5) / 100) * (stopLossPercent || 2.0)).toFixed(2)}% din capital</span>
                  </div>
                </div>
              </div>

              {/* Levier Ajustabil (Doar la Scalping) */}
              <div className="space-y-3 bg-amber-950/20 p-4 rounded-xl border border-amber-500/30 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-amber-200 flex items-center gap-2">
                    <span>⚡ Levier Multiplicator (Exclusiv Scalping)</span>
                  </label>
                  <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded border border-amber-500/40">
                    {scalpingConfig?.leverage ?? 1}x Multiplicator
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Amplifică volumul pozițiilor și expunerea pentru tranzacțiile rapide de <strong>Scalping</strong>. Această setare se aplică <strong>doar la modul Scalping</strong>, menținând strategia Smart Grid și tranzacțiile manuale fără risc de levier.
                </p>

                <div className="flex items-center gap-3 pt-1">
                  <input 
                    type="range" 
                    min="1" 
                    max="50" 
                    step="1" 
                    value={scalpingConfig?.leverage ?? 1} 
                    onChange={(e) => setScalpingConfig({ leverage: Number(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer" 
                  />
                </div>

                <div className="flex gap-2 flex-wrap pt-1 font-mono">
                  {[1, 2, 3, 5, 10, 20].map(lev => (
                    <button
                      key={lev}
                      onClick={() => setScalpingConfig({ leverage: lev })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer",
                        (scalpingConfig?.leverage ?? 1) === lev
                          ? "bg-amber-500/30 text-amber-200 border-amber-500/50 font-bold"
                          : "bg-zinc-900/60 text-zinc-400 border-white/5 hover:bg-white/5"
                      )}
                    >
                      {lev}x {lev === 1 ? '(Fără levier)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Hold Time Limit (Minutes) */}
              <div className="space-y-3 bg-zinc-950/60 p-4 rounded-xl border border-white/5 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white">Timp Maxim Deținere Scalping (Min)</label>
                  <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                    {maxHoldMinutes && maxHoldMinutes > 0 ? `${maxHoldMinutes} minute (Scalping)` : 'Dezactivat (0 min)'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Scalping-ul folosește această limită (ex: {maxHoldMinutes ?? 15}m) pentru pozițiile pe pierdere sau stagnare. Pozițiile pe profit sunt preluate de Trailing Stop & TP fără limită de timp. <strong>Smart Grid folosește limita sa configurată de 90 minute per nivel.</strong>
                </p>

                <div className="flex gap-2 flex-wrap">
                  {[3, 5, 10, 15, 30, 60, 120, 180, 240, 0].map(mins => (
                    <button
                      key={mins}
                      onClick={() => setMaxHoldMinutes(mins)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer font-mono",
                        (maxHoldMinutes ?? 15) === mins
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold"
                          : "bg-zinc-900/60 text-zinc-400 border-white/5 hover:bg-white/5"
                      )}
                    >
                      {mins === 0 ? 'Fără limită (0m)' : (mins >= 60 ? `${mins / 60}h (${mins}m)` : `${mins} min`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Negative Hold Time Limit (Minute pe Minus) */}
              {/* Regula de limită de timp pe minus cu comutator ON/OFF */}
              <div className="space-y-3 bg-rose-950/30 p-4 rounded-xl border border-rose-500/30 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-rose-200 flex items-center gap-2">
                    <span>⏳ Limită Timp de la Intrarea pe Minus (PnL &lt; 0)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-xs font-mono font-bold px-2.5 py-1 rounded border transition-colors",
                      (scalpingConfig?.enableMaxNegativeHold ?? false)
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    )}>
                      {(scalpingConfig?.enableMaxNegativeHold ?? false) ? `${scalpingConfig?.maxNegativeHoldMinutes ?? 1.0} minute` : 'DEZACTIVAT'}
                    </span>
                    {/* Toggle ON/OFF Switch */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={scalpingConfig?.enableMaxNegativeHold ?? false} 
                        onChange={(e) => setEnableMaxNegativeHold(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                    </label>
                  </div>
                </div>

                {(scalpingConfig?.enableMaxNegativeHold ?? true) ? (
                  <>
                    <p className="text-xs text-rose-200/80 leading-relaxed">
                      Când o poziție BUY trece în PnL negativ (sub prețul de intrare), pornește o numărătoare inversă de exact <strong>{scalpingConfig?.maxNegativeHoldMinutes ?? 1.0} min</strong>. Dacă tranzacția nu își revine pe plus înainte de expirarea timpului, botul execută un SELL automat (dacă nu a atins Stop Loss-ul mai devreme).
                    </p>

                    <div className="flex items-center gap-3 pt-1">
                      <input 
                        type="range" 
                        min="0.1" 
                        max="10" 
                        step="0.1" 
                        value={scalpingConfig?.maxNegativeHoldMinutes ?? 1.0} 
                        onChange={(e) => setMaxNegativeHoldMinutes(Number(e.target.value))}
                        className="w-full accent-rose-500 cursor-pointer" 
                      />
                    </div>

                    <div className="flex gap-2 flex-wrap pt-1">
                      {[0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0].map(mins => (
                        <button
                          key={mins}
                          onClick={() => setMaxNegativeHoldMinutes(mins)}
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-medium transition-all border cursor-pointer font-mono",
                            (scalpingConfig?.maxNegativeHoldMinutes ?? 1.0) === mins
                              ? "bg-rose-500/30 text-rose-200 border-rose-500/50 font-bold"
                              : "bg-zinc-900/60 text-zinc-400 border-white/5 hover:bg-white/5"
                          )}
                        >
                          {mins} min
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-zinc-400 italic bg-black/20 p-2.5 rounded-lg border border-white/5">
                    Regula de limita de timp pe minus este <strong className="text-zinc-300">Dezactivată</strong>. Pozițiile pe minus vor rămâne deschise și vor fi protejate exclusiv prin Stop Loss sau deținerea maximă standard.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Intervals & Server 24/7 */}
      {activeTab === 'intervals' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 space-y-4">
            <h3 className="font-serif text-lg text-white">Interval Actualizare Date & Prețuri</h3>
            <p className="text-xs text-zinc-400">
              Frecvența cu care se actualizează prețurile de pe piață și se verifică Stop Loss / Take Profit.
            </p>
            
            <div className="flex gap-3 flex-wrap font-mono">
              {[10, 30, 60, 300].map(val => (
                <button
                  key={val}
                  onClick={() => setDataInterval(val)}
                  className={`px-4 py-2 rounded-xl text-xs transition-colors border cursor-pointer ${
                    dataInterval === val 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' 
                    : 'bg-zinc-800/40 text-zinc-300 border-white/5 hover:bg-white/5'
                  }`}
                >
                  {val === 300 ? '5 min' : val === 60 ? '1 min' : `${val} sec`}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 space-y-4">
            <h3 className="font-serif text-lg text-white">Interval Analiză AI & Execuție Semnale</h3>
            <p className="text-xs text-zinc-400">
              Frecvența cu care se apelează modelele ML pentru a recalcula oportunitățile și semnalele (BUY/SELL).
            </p>
            
            <div className="flex gap-3 flex-wrap font-mono">
              {[30, 60, 120, 300, 900].map(val => (
                <button
                  key={val}
                  onClick={() => setAnalysisInterval(val)}
                  className={`px-4 py-2 rounded-xl text-xs transition-colors border cursor-pointer ${
                    analysisInterval === val 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' 
                    : 'bg-zinc-800/40 text-zinc-300 border-white/5 hover:bg-white/5'
                  }`}
                >
                  {val >= 60 ? `${val / 60} min` : `${val} sec`}
                </button>
              ))}
            </div>
          </div>

          {/* Sequential Launch Circuit Banner */}
          <div className="bg-zinc-900/80 border border-emerald-500/20 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/5">
              <div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                    Circuit de Control & Secvență de Pornire Server 24/7
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Parcurgeți secvența de mai jos pentru pornirea optimizată:
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
                  <p className="text-[11px] text-zinc-400 mt-1">Calcul semnale RSI/MACD & analiză sentiment.</p>
                </div>
                <button
                  type="button"
                  onClick={handleStartMl}
                  className={cn(
                    "w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer font-mono",
                    mlEngineStarted
                      ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                  )}
                >
                  {mlEngineStarted ? "✓ ML Strategies Activ" : "Pornire Manuală ML"}
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
                  <p className="text-[11px] text-zinc-400 mt-1">Validare reguli AI & praguri de Stop-Loss.</p>
                </div>
                <button
                  type="button"
                  onClick={handleStartAiLab}
                  className={cn(
                    "w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer font-mono",
                    aiStrategyLabStarted
                      ? "bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30"
                      : "bg-purple-600 hover:bg-purple-500 text-white shadow-sm"
                  )}
                >
                  {aiStrategyLabStarted ? "✓ AI Lab Validat" : "Pornire Manuală AI Lab"}
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
                  <p className="text-[11px] text-zinc-400 mt-1">Execuție automată ordine pe Binance / Paper.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!mlEngineStarted) handleStartMl();
                    if (!aiStrategyLabStarted) handleStartAiLab();
                    setAutoTradingActive(!autoTradingActive);
                  }}
                  className={cn(
                    "w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer font-mono",
                    autoTradingActive
                      ? "bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                  )}
                >
                  {autoTradingActive ? "OPREȘTE Server 24/7" : "PORNEȘTE Server 24/7"}
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
                    Verifică starea buclei de scanare în timp real.
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
                <span>{isCheckingPulse ? "Se verifică..." : "💓 Ia Pulsul Acum"}</span>
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
                  {autoTradingActive ? "AUTO-TRADING ACTIV" : "STANDBY"}
                </p>
              </div>

              <div className="p-3 bg-zinc-950/70 border border-white/5 rounded-xl">
                <span className="text-[10px] uppercase text-zinc-500 block mb-1">Frecvență Scanare ML</span>
                <p className="text-sm font-semibold text-zinc-200">
                  La fiecare {analysisInterval || 60}s
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
              <div className="mt-3 p-3 bg-cyan-950/90 border border-cyan-500/50 rounded-xl text-xs text-cyan-200 flex items-center gap-2 animate-fadeIn font-mono">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{pulseBannerMessage}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Account & Exchange */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          {/* Top-Up / Adăugare Fonduri Suplimentare */}
          <div className="bg-zinc-900/60 border border-emerald-500/20 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-serif text-white mb-1 flex items-center gap-2">
                  <span>➕ Adăugare Fonduri (Paper Trading)</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">Fără Resetare</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Adaugă lichidități suplimentare direct în balanța activă fără a închide pozițiile curente.
                </p>
              </div>
              <div className="text-right bg-zinc-950/60 px-3 py-1.5 rounded-lg border border-white/5 font-mono">
                <span className="text-[10px] uppercase text-zinc-500 block">Balanță Curentă</span>
                <span className="text-sm font-bold text-emerald-400">${balance.toFixed(2)} USDT</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-zinc-400 font-mono">Adăugare rapidă:</span>
                {[10, 25, 50, 100, 200, 500].map(amt => (
                  <button
                    key={amt}
                    onClick={() => {
                      addFunds(amt);
                      setTopupSuccessMsg(`+$${amt} USDT adăugați cu succes!`);
                      setTimeout(() => setTopupSuccessMsg(null), 4000);
                    }}
                    className="px-3 py-1 bg-zinc-800/80 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-mono transition-colors cursor-pointer"
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
                    placeholder="Suma..."
                    className="w-full bg-zinc-950/80 border border-white/10 rounded-lg pl-7 pr-14 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono">USDT</span>
                </div>
                <button
                  onClick={() => {
                    const amt = parseFloat(addTopupAmount);
                    if (isNaN(amt) || amt <= 0) return;
                    addFunds(amt);
                    setTopupSuccessMsg(`+$${amt.toFixed(2)} USDT adăugați cu succes!`);
                    setTimeout(() => setTopupSuccessMsg(null), 4000);
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-lg text-xs transition-colors whitespace-nowrap shadow-lg shadow-emerald-500/10 cursor-pointer font-mono"
                >
                  Adaugă +${parseFloat(addTopupAmount) || 0}
                </button>
              </div>

              {topupSuccessMsg && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg font-mono">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{topupSuccessMsg}</span>
                </div>
              )}
            </div>
          </div>

          {/* Paper Trading Reset */}
          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-serif text-white mb-1">Resetare Totală Capital Paper Trading</h3>
            <p className="text-xs text-zinc-400 mb-4">Setează un capital inițial curat (ex: $1,000, $5,000, $10,000). Această acțiune va reseta istoricul și pozițiile.</p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap font-mono">
                {[1000, 2500, 5000, 10000, 25000].map(amt => (
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
                    className={`px-3.5 py-1.5 rounded-lg transition-colors text-xs border cursor-pointer ${
                      amt === 10000
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-semibold'
                      : 'bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 border-white/10'
                    }`}>
                    Setează ${amt.toLocaleString()} USDT {amt === 10000 ? '(Implicit)' : ''}
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
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 rounded-lg text-xs font-medium transition-colors font-mono cursor-pointer"
                >
                  Resetare
                </button>
              </div>
            </div>
          </div>

          {/* Resetare Sold Acumulare Vault */}
          <div className="bg-gradient-to-b from-amber-950/20 to-zinc-900/50 border border-amber-500/20 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h3 className="text-lg font-serif text-amber-200">Resetare Sold "Acumulare" (Vault)</h3>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Sold: ${accumulationBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Ciclu #{sessionCycleCount})
              </span>
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              Resetează doar profitul conservat din Vault-ul de Acumulare la $0.00 și reinițializează numărul de cicluri la #1, fără a afecta balanța principală sau pozițiile active.
            </p>
            {confirmResetAcc ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    await resetAccumulationVault();
                    setConfirmResetAcc(false);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-mono font-bold transition-all cursor-pointer shadow-lg"
                >
                  Confirmi resetarea la $0.00?
                </button>
                <button
                  onClick={() => setConfirmResetAcc(false)}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-mono transition-all cursor-pointer"
                >
                  Anulează
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmResetAcc(true)}
                className="px-4 py-2 bg-amber-500/20 hover:bg-rose-500/30 text-amber-200 hover:text-rose-200 border border-amber-500/40 hover:border-rose-500/50 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Resetează Sold "Acumulare" la $0.00
              </button>
            )}
          </div>

          {/* Binance API Credentials */}
          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
            <div className="mb-4">
              <h3 className="text-lg font-serif text-white">Conectare Exchange Binance</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Configurează cheile API pentru Binance Testnet și Live.
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2 font-mono">Mod Execuție Selectat</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
                {(['paper', 'testnet', 'live'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setBinanceMode(mode)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-colors border text-center cursor-pointer ${
                      binanceMode === mode 
                        ? (mode === 'live' 
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold' 
                            : mode === 'testnet' 
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold' 
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold') 
                        : 'bg-zinc-800/40 text-zinc-400 border-white/5 hover:bg-white/5'
                    }`}
                  >
                    {mode === 'paper' ? 'Paper (Demo)' : mode === 'testnet' ? 'Binance Testnet' : 'Binance LIVE'}
                  </button>
                ))}
              </div>
              {binanceMode === 'live' && (
                <p className="text-xs text-rose-300 mt-3 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20 font-mono">
                  ⚠️ ATENȚIE: Modul LIVE este activat! Ordinele vor fi trimise către API-ul Binance Real.
                </p>
              )}
            </div>

            {/* Testnet Credentials */}
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 mb-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider font-mono">Binance Testnet Credentials</span>
                <a href="https://testnet.binance.vision" target="_blank" rel="noreferrer" className="text-[11px] text-amber-400 hover:underline">
                  Obține Chei Testnet ↗
                </a>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-400 mb-1 font-mono">Testnet API Key</label>
                <input 
                  type="text" 
                  value={testnetApiKey}
                  onChange={(e) => setTestnetApiKey(e.target.value)}
                  placeholder="Ex: 62a8f9b2c3d4..." 
                  className="w-full bg-zinc-800/60 border border-amber-500/20 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-amber-500/50 font-mono text-sm" 
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-400 mb-1 font-mono">Testnet Secret Key</label>
                <input 
                  type="password" 
                  value={testnetApiSecret}
                  onChange={(e) => setTestnetApiSecret(e.target.value)}
                  placeholder="Ex: 98f7e6d5c4b3..." 
                  className="w-full bg-zinc-800/60 border border-amber-500/20 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-amber-500/50 font-mono text-sm" 
                />
              </div>
            </div>

            {/* Live Credentials */}
            <div className="p-4 rounded-xl bg-zinc-800/30 border border-white/5 space-y-4">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono block">Binance Live Credentials</span>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-mono">Live API Key</label>
                <input 
                  type="text" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Introdu Live API Key..." 
                  className="w-full bg-zinc-800/40 border border-white/5 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-white/20 font-mono text-sm" 
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-mono">Live Secret Key</label>
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
                  setSyncStatus({ loading: true, message: 'Se testează conexiunea...', error: false });
                  const res = await syncBinanceBalance();
                  if (res && res.success) {
                    setSyncStatus({ 
                      loading: false, 
                      message: `Balanță citită din Binance: $${res.balance?.toFixed(2) || '0.00'} USDT`, 
                      error: false 
                    });
                  } else {
                    setSyncStatus({ 
                      loading: false, 
                      message: `Eroare conexiune: ${res?.error || 'Cheile API sunt invalide'}`, 
                      error: true 
                    });
                  }
                }}
                className="px-4 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 font-medium rounded-xl text-xs transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer font-mono"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.loading ? 'animate-spin' : ''}`} />
                <span>Sincronizează Balanța {binanceMode === 'testnet' ? 'Testnet' : 'Live'}</span>
              </button>

              {syncStatus.message && (
                <div className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 font-mono ${
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
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-2 font-mono">
                <RefreshCw className="w-3.5 h-3.5" /> Inspector BinanceService.ts
              </h4>

              <div className="flex flex-wrap items-center gap-3 mb-3">
                <button
                  type="button"
                  disabled={binanceInspectorLoading || binanceMode === 'paper'}
                  onClick={async () => {
                    setBinanceInspectorLoading(true);
                    try {
                      const res = await apiFetch('/api/binance/account');
                      const data = await safeJson(res, { error: 'Răspuns invalid de la server' });
                      setBinanceInspectorResult(data);
                    } catch (err: any) {
                      setBinanceInspectorResult({ error: err?.message || 'Eroare conectare' });
                    } finally {
                      setBinanceInspectorLoading(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-mono border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  1. Interogare Cont (/api/binance/account)
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
                        const res = await apiFetch(`/api/binance/trades?symbol=${binanceInspectorSymbol}`);
                        const data = await safeJson(res, { error: 'Răspuns invalid de la server' });
                        setBinanceInspectorResult(data);
                      } catch (err: any) {
                        setBinanceInspectorResult({ error: err?.message || 'Eroare conectare' });
                      } finally {
                        setBinanceInspectorLoading(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-mono border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    2. Interogare Tranzacții
                  </button>
                </div>
              </div>

              {binanceInspectorResult && !binanceInspectorLoading && (
                <div className="mt-2 bg-zinc-900 border border-white/5 rounded-lg p-3 text-xs font-mono overflow-x-auto max-h-60">
                  <div className="flex justify-between items-center mb-1 text-[10px] text-zinc-500 uppercase">
                    <span>Răspuns Binance API:</span>
                    <button type="button" onClick={() => setBinanceInspectorResult(null)} className="text-zinc-400 hover:text-white cursor-pointer">Închide</button>
                  </div>
                  <pre className="text-amber-300/90 text-[11px] whitespace-pre-wrap">
                    {JSON.stringify(binanceInspectorResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: AI Models & Gemini */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-serif text-white mb-2">Google Gemini (AI Analyst & ML Assistant)</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Introdu cheia ta API Gemini pentru a asigura funcționarea asistatului AI Analyst și generarea de rapoarte de sinteză.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-mono">Gemini API Key</label>
                <input 
                  type="password" 
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy..." 
                  className="w-full bg-zinc-800/40 border border-white/5 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500/50 font-mono text-sm" 
                />
              </div>
            </div>
          </div>

          {/* AI Cost Monitor Component */}
          <AICostMonitor />

          {/* ML Calculation Engine Card */}
          <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-amber-950/20 border border-amber-500/20 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-serif text-white">Motor Calcul Semnale ML</h3>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">
                      ACTIV
                    </span>
                  </div>
                  <p className="text-xs text-amber-300/80">
                    Procesare ultra-rapidă și stabilă a probabilităților de intrare, oportunităților de piață și semnalelor de tranzacționare.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-zinc-950/80 border border-white/10 px-3 py-1.5 rounded-xl">
                <span className="text-[11px] text-zinc-400">Mod Activ:</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  🌲 RANDOM FOREST (RF)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl text-left border border-amber-500/30 bg-amber-500/10 text-white space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300">Random Forest Classifier (18 Arbori Decizionali)</span>
                </div>
                <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">RF Active</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-snug">
                Calculează semnalele pe baza ansamblului <strong>Random Forest (18 arbori decizionali)</strong>, evaluând în timp real indicatorii tehnici cheie (RSI, ADX, EMA, Volum, Reversals, Platt Calibration) cu inferență sub 1ms.
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900 to-purple-950/30 border border-purple-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-serif text-white">Modele Machine Learning Active</h3>
                <p className="text-xs text-purple-300/80">Classifier Ensemble (Random Forest + Meta-Model)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3.5 bg-zinc-950/60 border border-white/5 rounded-xl space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">Random Forest 2.0</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">ACTIV</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans">Pondere în ansamblu: 40%. Clasificare multi-indicator.</p>
              </div>

              <div className="p-3.5 bg-zinc-950/60 border border-white/5 rounded-xl space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">XGBoost Volatility Classifier</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">ACTIV</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans">Pondere în ansamblu: 35%. Detecție volatilitate & impuls.</p>
              </div>

              <div className="p-3.5 bg-zinc-950/60 border border-white/5 rounded-xl space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">LightGBM Trend Alignment</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">ACTIV</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans">Pondere în ansamblu: 25%. Filtrare fals-pozitiv.</p>
              </div>

              <div className="p-3.5 bg-zinc-950/60 border border-white/5 rounded-xl space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">Smart AI Grid Classifier</span>
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">ACTIV</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans">Calcul Range Probability % (Choppiness + Hurst + ADX).</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Notifications */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          {/* Master ON/OFF Switch */}
          <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-serif text-white">Sistem General Notificări Bot</h3>
                <span className={cn(
                  "text-xs font-mono font-bold px-2.5 py-0.5 rounded border transition-colors",
                  (reportConfig?.enabled ?? true)
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                )}>
                  {(reportConfig?.enabled ?? true) ? 'ACTIVAT' : 'DEZACTIVAT'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Comutator principal ON/OFF pentru toate canalele de notificare (Telegram, Discord, Web Push).
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input 
                type="checkbox" 
                checked={reportConfig?.enabled ?? true} 
                onChange={(e) => setReportConfig({ enabled: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-12 h-6.5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Telegram Bot Card */}
          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sky-400 font-bold text-sm">💬 Telegram Bot</span>
                  <span className={cn(
                    "text-[10px] font-mono px-2 py-0.5 rounded border",
                    (reportConfig?.channels?.telegram ?? true)
                      ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
                      : "bg-zinc-800 text-zinc-500 border-white/5"
                  )}>
                    {(reportConfig?.channels?.telegram ?? true) ? 'Canal Activ' : 'Canal Inactiv'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">Primește semnalele de tranzacționare direct pe telefon prin Telegram Bot.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  checked={reportConfig?.channels?.telegram ?? true} 
                  onChange={(e) => setReportConfig({ channels: { ...reportConfig?.channels, telegram: e.target.checked } as any })}
                  className="sr-only peer" 
                />
                <div className="w-10 h-5.5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
              </label>
            </div>

            <div className="space-y-4 font-mono">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-mono">Telegram Bot Token</label>
                <input 
                  type="password" 
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  placeholder="Ex: 123456789:ABCdefGHIjklMNOpqrs..." 
                  className="w-full bg-zinc-800/40 border border-white/5 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500/50 text-sm" 
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-mono">Chat ID</label>
                <input 
                  type="text" 
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="Ex: 123456789" 
                  className="w-full bg-zinc-800/40 border border-white/5 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500/50 text-sm" 
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
                      await fetch('/api/bot/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          telegramBotToken: telegramBotToken.trim(),
                          telegramChatId: telegramChatId.trim(),
                          notificationProvider: 'telegram'
                        })
                      });

                      const res = await apiFetch('/api/bot/send-telegram-guide', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chatId: telegramChatId.trim() })
                      });
                      const data = await safeJson(res, { success: false, error: 'Server indisponibil' });
                      if (data && data.success) {
                        setTelegramGuideStatus({
                          message: '✅ Lista de comenzi a fost trimisă cu succes pe Telegram!',
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
                  className="px-4 py-2 bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 font-medium rounded-xl text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer font-mono"
                >
                  <span>📌 Trimite & Fixează Ghidul de Comenzi pe Telegram</span>
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

          {/* Discord Webhook Card */}
          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-indigo-400 font-bold text-sm">🎮 Discord Webhook</span>
                  <span className={cn(
                    "text-[10px] font-mono px-2 py-0.5 rounded border",
                    (reportConfig?.channels?.discord ?? true)
                      ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                      : "bg-zinc-800 text-zinc-500 border-white/5"
                  )}>
                    {(reportConfig?.channels?.discord ?? true) ? 'Canal Activ' : 'Canal Inactiv'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">Primește alerte instant pe canalul tău de Discord folosind un Webhook URL.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  checked={reportConfig?.channels?.discord ?? true} 
                  onChange={(e) => setReportConfig({ channels: { ...reportConfig?.channels, discord: e.target.checked } as any })}
                  className="sr-only peer" 
                />
                <div className="w-10 h-5.5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
              </label>
            </div>

            <div className="space-y-4 font-mono">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-mono">Discord Webhook URL</label>
                <input 
                  type="text" 
                  value={discordWebhookUrl}
                  onChange={async (e) => {
                    const val = e.target.value;
                    setDiscordWebhookUrl(val);
                    try {
                      await fetch('/api/bot/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ discordWebhookUrl: val.trim() })
                      });
                    } catch (err) {}
                  }}
                  placeholder="https://discord.com/api/webhooks/123456789/ABCdef..." 
                  className="w-full bg-zinc-800/40 border border-white/5 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500/50 text-sm" 
                />
              </div>

              <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={discordTestLoading || !discordWebhookUrl}
                  onClick={async () => {
                    setDiscordTestLoading(true);
                    setDiscordTestStatus(null);
                    try {
                      await fetch('/api/bot/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ discordWebhookUrl: discordWebhookUrl.trim() })
                      });

                      const res = await fetch(discordWebhookUrl.trim(), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          content: '🎮 **[G&S-Trade-Bot]** Test notificare Discord Webhook funcționează cu succes!'
                        })
                      });
                      if (res.ok) {
                        setDiscordTestStatus({
                          message: '✅ Notificare de test trimisă cu succes pe Discord!',
                          error: false
                        });
                      } else {
                        setDiscordTestStatus({
                          message: `⚠️ Discord Webhook a returnat codul ${res.status}`,
                          error: true
                        });
                      }
                    } catch (err: any) {
                      setDiscordTestStatus({
                        message: `⚠️ Eroare trimitere Discord: ${err?.message || 'Eroare de rețea'}`,
                        error: true
                      });
                    } finally {
                      setDiscordTestLoading(false);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 font-medium rounded-xl text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer font-mono"
                >
                  <span>🎮 Trimite Notificare de Test pe Discord Webhook</span>
                </button>

                {discordTestStatus && (
                  <div className={`text-xs p-2.5 rounded-lg font-mono ${
                    discordTestStatus.error
                      ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  }`}>
                    {discordTestStatus.message}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Push Card */}
          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold text-sm">🔔 Notificări Push Desktop & Android (PWA)</span>
                  <span className={cn(
                    "text-[10px] font-mono px-2 py-0.5 rounded border",
                    (reportConfig?.channels?.browser ?? true)
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-zinc-800 text-zinc-500 border-white/5"
                  )}>
                    {(reportConfig?.channels?.browser ?? true) ? 'Canal Activ' : 'Canal Inactiv'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">Primește notificări push direct pe ecran la execuția unui ordin.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  checked={reportConfig?.channels?.browser ?? true} 
                  onChange={(e) => setReportConfig({ channels: { ...reportConfig?.channels, browser: e.target.checked } as any })}
                  className="sr-only peer" 
                />
                <div className="w-10 h-5.5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div>
              <button 
                onClick={handleEnablePush}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs transition-colors cursor-pointer font-mono">
                Activează Permisiuni Notificări
              </button>
            </div>

            <NotificationDiagnostic />
          </div>
        </div>
      )}

      {/* Tab 6: System & Desktop */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* Server Backend & APK Connection Settings Card */}
          <div className="bg-zinc-900/80 border border-emerald-500/30 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-serif text-white flex items-center gap-2">
                  <span>Conexiune Server Backend (APK Mobil / VPS)</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono border border-emerald-500/30">
                    Sincronizare 24/7
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Setează adresa serverului tău Cloud Run sau VPS pentru ca fișierul APK mobil să se conecteze la starea și logurile 24/7.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>URL Server Cloud / VPS</span>
                  <span className="text-emerald-400/80 lowercase text-[10px]">ex: https://ais-pre-73nanovzlxia6n3a2nz2pj-746454457956.europe-west2.run.app</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Globe className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      value={serverUrl || ''}
                      onChange={(e) => setServerUrl(e.target.value)}
                      placeholder="Lasă necompletat pentru Server Local, sau introdu https://URL-SERVER.run.app"
                      className="w-full bg-zinc-950/90 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 font-mono"
                    />
                  </div>
                  <button
                    onClick={handleTestServerConnection}
                    disabled={serverTestStatus.loading}
                    className="px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {serverTestStatus.loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                    <span>Test Conexiune</span>
                  </button>
                </div>
              </div>

              {serverTestStatus.message && (
                <div className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2.5 ${
                  serverTestStatus.success === true
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : serverTestStatus.success === false
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : 'bg-zinc-800/80 border-white/10 text-zinc-300'
                }`}>
                  {serverTestStatus.success === true ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : serverTestStatus.success === false ? (
                    <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  ) : (
                    <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-zinc-400" />
                  )}
                  <span>{serverTestStatus.message}</span>
                </div>
              )}

              <p className="text-[11px] text-zinc-400 bg-black/40 p-3 rounded-xl border border-white/5 leading-relaxed font-sans">
                💡 <strong>Notă importantă pentru APK Mobil:</strong> Când aplicația rulează ca fișier APK pe telefon fără conexiune la serverul local NodeJS, poți completa adresa publică a serverului (Cloud Run / VPS). În cazul în care nu ai setat un URL, aplicația rulează în <strong>Mod Autonom Client</strong> pe telefon, scanând Binance în timp real și generând semnale și loguri direct pe mobil.
              </p>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-serif text-white mb-1">Capacitate Stocare Loguri (Server / VPS)</h3>
            <p className="text-xs text-zinc-400 mb-4">Setează numărul maxim de loguri păstrate în memorie pe server.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2 font-mono">Număr Maxim Loguri Salvate</label>
                <div className="flex items-center gap-2 flex-wrap font-mono">
                  {[100, 250, 500, 1000, 2500, 5000, 10000].map(limit => (
                    <button
                      key={limit}
                      onClick={() => setMaxLogs(limit)}
                      className={`px-3.5 py-2 font-medium rounded-xl text-xs transition-colors border cursor-pointer ${
                        (maxLogs || 1000) === limit
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold'
                          : 'bg-zinc-800/40 text-zinc-300 border-white/5 hover:bg-zinc-800'
                      }`}
                    >
                      {limit >= 1000 ? `${limit / 1000}k` : limit} {limit === 1000 ? '(Recomandat)' : ''}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pt-2 flex items-center justify-between border-t border-white/5 font-mono">
                <span className="text-xs text-zinc-500">Capacitate curentă: <strong className="text-emerald-400">{maxLogs || 1000} loguri</strong></span>
                <button
                  onClick={() => {
                    if (window.confirm('Ștergi toate logurile din memorie?')) clearLogs();
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  Șterge toate logurile
                </button>
              </div>
            </div>
          </div>

          {/* Electron Desktop Application Packaging Card */}
          <div className="bg-gradient-to-br from-indigo-950/60 via-zinc-900 to-zinc-950 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400">
                <Laptop className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-serif text-white">Aplicație Desktop Electron &amp; Executabil .EXE</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                    WINDOWS &amp; CROSS-PLATFORM
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Rulează nativ ca aplicație desktop independentă pe Windows (.exe).
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="p-3.5 bg-zinc-950/80 border border-white/10 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-sans font-bold text-indigo-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                    1. Rulare Nativă pe Desktop (Dezvoltare)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('npm run electron:dev', 'dev')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 transition-all text-[11px] cursor-pointer"
                  >
                    {copiedCmd === 'dev' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCmd === 'dev' ? 'Copiat!' : 'Copiază Comanda'}</span>
                  </button>
                </div>
                <div className="bg-black/90 p-2.5 rounded-lg border border-white/5 text-emerald-400 text-[11px] font-mono flex items-center justify-between">
                  <code>npm run electron:dev</code>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-950/80 border border-white/10 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-sans font-bold text-amber-300 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    2. Generare Instalate `.exe` pentru Windows (NSIS Installer)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('npm run build:exe', 'exe')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-all text-[11px] cursor-pointer"
                  >
                    {copiedCmd === 'exe' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCmd === 'exe' ? 'Copiat!' : 'Copiază Comanda'}</span>
                  </button>
                </div>
                <div className="bg-black/90 p-2.5 rounded-lg border border-white/5 text-amber-300 text-[11px] font-mono flex items-center justify-between">
                  <code>npm run build:exe</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
