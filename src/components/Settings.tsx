import React, { useState, useEffect } from 'react';
import { useTradingStore } from '../store';
import { requestNotificationPermission } from '../services/notifications';
import { Alerts } from './Alerts';
import { AIAnalyst } from './AIAnalyst';
import { AICalibration } from './AICalibration';
import { NotificationDiagnostic } from './NotificationDiagnostic';
import { AICostMonitor } from './AICostMonitor';
import { apiFetch, safeJson } from '../utils/apiHelper';
import { getTranslation } from '../utils/i18n';
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
  ShieldCheck,
  Layers,
  Server,
  Globe,
  Wifi,
  XCircle,
  RotateCcw,
  Cpu,
  GitMerge,
  Sparkles,
  BrainCircuit,
  Target,
  Rocket,
  Pause
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<'engine' | 'intervals' | 'account' | 'ai' | 'notifications' | 'system' | 'alerts' | 'analyst' | 'calibration'>('engine');

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
    language,
    setLanguage,
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
    exchangeProvider,
    setExchangeProvider,
    bybitApiKey,
    bybitApiSecret,
    bybitTestnetApiKey,
    bybitTestnetApiSecret,
    setBybitApiKey,
    setBybitApiSecret,
    setBybitTestnetApiKey,
    setBybitTestnetApiSecret,
    okxApiKey,
    okxApiSecret,
    okxPassphrase,
    okxTestnetApiKey,
    okxTestnetApiSecret,
    okxTestnetPassphrase,
    setOkxApiKey,
    setOkxApiSecret,
    setOkxPassphrase,
    setOkxTestnetApiKey,
    setOkxTestnetApiSecret,
    setOkxTestnetPassphrase,
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
    initialBalance,
    equityProtectionConfig,
    setEquityProtectionConfig,
  } = useTradingStore();

  const t = getTranslation(language);

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

  const tabItems: Array<{ id: 'engine' | 'intervals' | 'account' | 'ai' | 'notifications' | 'system' | 'alerts' | 'analyst' | 'calibration'; label: string; icon: any; badge?: string }> = [
    { id: 'engine', label: language === 'ro' ? 'Risc & Execuție' : 'Risk & Execution', icon: Activity },
    { id: 'intervals', label: language === 'ro' ? 'Intervale & Server 24/7' : 'Intervals & 24/7 Server', icon: Clock },
    { id: 'account', label: language === 'ro' ? 'Cont & Exchange' : 'Account & Exchange', icon: CreditCard, badge: binanceMode.toUpperCase() },
    { id: 'ai', label: language === 'ro' ? 'Modele AI & Gemini' : 'AI Models & Gemini', icon: Bot },
    { id: 'notifications', label: language === 'ro' ? 'Notificări' : 'Notifications', icon: Bell },
    { id: 'system', label: language === 'ro' ? 'Sistem & Desktop' : 'System & Desktop', icon: Sliders },
    { id: 'alerts', label: language === 'ro' ? 'Alerte' : 'Alerts', icon: AlertCircle },
    { id: 'analyst', label: 'AI Analyst', icon: BrainCircuit },
    { id: 'calibration', label: language === 'ro' ? 'Calibrare AI' : 'AI Calibration', icon: Target },
  ];

  return (
    <div className="p-3 sm:p-6 md:p-8 h-full overflow-y-auto max-w-4xl mx-auto pb-32">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif text-white tracking-tight">
            {language === 'ro' ? 'Setări Platformă G&S-Trade-Bot' : 'G&S-Trade-Bot Platform Settings'}
          </h2>
          <p className="text-zinc-400 mt-0.5 text-xs sm:text-sm">
            {language === 'ro' ? 'Configurare parametri motor, risc, chei API și intervale de timp.' : 'Configure engine parameters, risk management, API keys, and timer intervals.'}
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('trading_store');
            window.location.reload();
          }}
          className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 self-start sm:self-auto shadow-sm"
          title={language === 'ro' ? "Curăță starea locală din browser (trading_store) și reîncarcă aplicația" : "Clear local browser storage and reload application"}
        >
          <RotateCcw className="w-4 h-4 text-amber-400" />
          <span>{language === 'ro' ? 'Hard Reset Stare (Reset Local)' : 'Hard Reset State (Local Reset)'}</span>
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

          {/* Equity Trailing / Capital Protection Card */}
          <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-emerald-950/20 border border-emerald-500/20 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Equity Trailing / Capital Protection</h3>
                  <p className="text-xs text-zinc-400">Protejează câștigurile acumulate bazat pe High-Water Mark și Trailing Drawdown.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={equityProtectionConfig?.enabled ?? true}
                  onChange={(e) => setEquityProtectionConfig({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="space-y-6 pt-2">
              {/* Slider 1: Prag Minim de Profit pentru Activare */}
              <div className="space-y-2 p-3.5 bg-black/30 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block">
                      {language === 'ro' ? '1. Prag Minim de Profit pentru Activare Trailing (%)' : '1. Minimum Profit Activation Threshold (%)'}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {language === 'ro' ? 'Protecția pornește urmărirea DOAR DUPĂ ce contul acumulează acest profit minim' : 'Trailing activates ONLY AFTER the account accumulates this minimum profit'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded border border-emerald-500/40 inline-block">
                      +{(equityProtectionConfig?.profitThresholdPct ?? 0.80).toFixed(2)}%
                    </span>
                    <span className="block text-[10px] font-mono text-zinc-400 mt-0.5">
                      ~+${(((initialBalance || balance || 1000) * (equityProtectionConfig?.profitThresholdPct ?? 0.80)) / 100).toFixed(2)} USDT
                    </span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="0.00" 
                  max="5.00" 
                  step="0.05"
                  value={equityProtectionConfig?.profitThresholdPct ?? 0.80}
                  onChange={(e) => setEquityProtectionConfig({ profitThresholdPct: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>0.00% (Imediat)</span>
                  <span>+0.80% (Recomandat)</span>
                  <span>+2.00%</span>
                  <span>+5.00%</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed pt-1">
                  {language === 'ro' 
                    ? `Cât timp profitul contului este sub +${(equityProtectionConfig?.profitThresholdPct ?? 0.80).toFixed(2)}%, botul lasă pozițiile deschise să respire și NU va închide prematur pe zgomot de piață. Comisioanele de schimb nu vă vor afecta.`
                    : `While account profit is under +${(equityProtectionConfig?.profitThresholdPct ?? 0.80).toFixed(2)}%, trailing is on hold, preventing early liquidation on market noise.`}
                </p>
              </div>

              {/* Slider 2: Distanța de Retragere din Vârf (Trailing Distance) */}
              <div className="space-y-2 p-3.5 bg-black/30 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block">
                      {language === 'ro' ? '2. Distanță Retragere din Vârf / Trailing Drawdown (%)' : '2. Trailing Drawdown from Peak (%)'}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {language === 'ro' ? 'Distanța maximă de cădere permisă din cel mai înalt punct (HWM)' : 'Maximum pullback allowed from high-water mark peak'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded border border-amber-500/40 inline-block">
                      -{(equityProtectionConfig?.trailingDistancePct ?? 0.40).toFixed(2)}%
                    </span>
                    <span className="block text-[10px] font-mono text-zinc-400 mt-0.5">
                      ~-${(((initialBalance || balance || 1000) * (equityProtectionConfig?.trailingDistancePct ?? 0.40)) / 100).toFixed(2)} USDT
                    </span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="0.10" 
                  max="3.00" 
                  step="0.05"
                  value={equityProtectionConfig?.trailingDistancePct ?? 0.40}
                  onChange={(e) => setEquityProtectionConfig({ trailingDistancePct: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>-0.10% (Foarte strâns)</span>
                  <span>-0.40% (Optim)</span>
                  <span>-1.00%</span>
                  <span>-3.00% (Larg)</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed pt-1">
                  {language === 'ro'
                    ? `După ce pragul 1 a fost atins, dacă capitalul (Equity) scade cu ${(equityProtectionConfig?.trailingDistancePct ?? 0.40).toFixed(2)}% față de vârful maxim atins, botul vinde instant toate pozițiile la piață și securizează profitul net în Free Balance.`
                    : `Once Step 1 is reached, if equity drops by ${(equityProtectionConfig?.trailingDistancePct ?? 0.40).toFixed(2)}% from peak HWM, all positions close immediately.`}
                </p>
              </div>

              {/* Caseta de Exemplu Vizual Live */}
              {(() => {
                const base = initialBalance || balance || 1000;
                const pThresh = equityProtectionConfig?.profitThresholdPct ?? 0.80;
                const tDist = equityProtectionConfig?.trailingDistancePct ?? 0.40;
                const minHwm = base * (1 + pThresh / 100);
                const examplePeak = Math.max(minHwm + base * 0.007, base * 1.015);
                const triggerEq = examplePeak * (1 - tDist / 100);
                const netLocked = triggerEq - base;

                return (
                  <div className="p-3 bg-emerald-950/20 rounded-xl border border-emerald-500/20 text-xs">
                    <div className="font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>{language === 'ro' ? 'Cum funcționează concret pe contul tău:' : 'How it works on your account:'}</span>
                    </div>
                    <ul className="space-y-1 text-zinc-300 text-[11px] pl-5 list-disc">
                      <li>
                        {language === 'ro' 
                          ? <>Contul pleacă de la <strong>${base.toFixed(2)} USDT</strong>. Până când nu atinge minim <strong>${minHwm.toFixed(2)} USDT</strong> (+{pThresh.toFixed(2)}%), trailing-ul nu se panichează.</>
                          : <>Starts at <strong>${base.toFixed(2)} USDT</strong>. Trailing stays idle until reaching at least <strong>${minHwm.toFixed(2)} USDT</strong>.</>}
                      </li>
                      <li>
                        {language === 'ro'
                          ? <>Dacă atinge de exemplu <strong>${examplePeak.toFixed(2)} USDT</strong> și apoi se retrage cu {tDist.toFixed(2)}%, vinde tot automat la <strong>${triggerEq.toFixed(2)} USDT</strong>.</>
                          : <>If equity hits <strong>${examplePeak.toFixed(2)} USDT</strong> and drops {tDist.toFixed(2)}%, it sells all at <strong>${triggerEq.toFixed(2)} USDT</strong>.</>}
                      </li>
                      <li className="text-emerald-300 font-semibold">
                        {language === 'ro'
                          ? <>Profit net securizat în buzunar: <strong>+${netLocked.toFixed(2)} USDT</strong> (acoperind confortabil orice comision Binance!).</>
                          : <>Secured net profit in pocket: <strong>+${netLocked.toFixed(2)} USDT</strong>.</>}
                      </li>
                    </ul>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Motor de Execuție Strategii Active */}
          <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-cyan-950/20 border border-cyan-500/20 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-serif text-white">
                    {language === 'ro' ? 'Motor de Execuție Strategii' : 'Strategy Execution Engine'}
                  </h3>
                  <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
                    {executionEngine === 'scalping' 
                      ? 'SCALPING ML' 
                      : executionEngine === 'momentum' 
                        ? 'MOMENTUM BREAKOUT' 
                        : executionEngine === 'none'
                          ? 'OPRIT (NONE)'
                          : (language === 'ro' ? 'AMBELE ACTIVE (HIBRID)' : 'BOTH ACTIVE (HYBRID)')}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {language === 'ro' 
                    ? 'Comutator direct între strategiile active din platformă: alege ce motoare pot deschide poziții noi.'
                    : 'Direct toggle between active platform strategies: choose which engines can open new positions.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Option 1: Scalping ML */}
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
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Scalping ML
                    </span>
                    <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">1m TF</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-snug">
                    {language === 'ro' 
                      ? 'Execută exclusiv semnalele de Scalping bazate pe ansamblul Random Forest și confirmări de volum.'
                      : 'Executes exclusively ML Scalping signals driven by the Random Forest ensemble and volume spikes.'}
                  </p>
                </div>
                <div className="text-[10px] font-mono text-amber-400/80 pt-2 border-t border-amber-500/20 flex items-center gap-1.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full", executionEngine === 'scalping' ? "bg-amber-400 animate-pulse" : "bg-zinc-600")}></span>
                  <span>{language === 'ro' ? 'Intrări Rapide' : 'Fast Entries'}</span>
                </div>
              </button>

              {/* Option 2: Momentum Breakout */}
              <button
                onClick={() => setExecutionEngine('momentum')}
                className={cn(
                  "p-4 rounded-xl text-left border transition-all relative flex flex-col justify-between space-y-3 cursor-pointer",
                  executionEngine === 'momentum'
                    ? "bg-purple-500/15 border-purple-500/50 text-white shadow-lg shadow-purple-950/50 ring-1 ring-purple-500/30"
                    : "bg-zinc-950/60 border-white/5 text-zinc-400 hover:bg-white/5 hover:border-white/10"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <Rocket className="w-3.5 h-3.5 text-purple-400" />
                      Momentum Breakout
                    </span>
                    <span className="text-[9px] font-mono bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">15m/1h TF</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-snug">
                    {language === 'ro'
                      ? 'Execută exclusiv scanerul de Momentum pe monede cu breakout de volatilitate și Trailing Stop dinamic.'
                      : 'Executes exclusively Momentum Breakout scanner on high volatility coins with dynamic Trailing Stop.'}
                  </p>
                </div>
                <div className="text-[10px] font-mono text-purple-400/80 pt-2 border-t border-purple-500/20 flex items-center gap-1.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full", executionEngine === 'momentum' ? "bg-purple-400 animate-pulse" : "bg-zinc-600")}></span>
                  <span>{language === 'ro' ? 'Tendințe & Expansiuni' : 'Trends & Expansions'}</span>
                </div>
              </button>

              {/* Option 3: Ambele Active Simultan */}
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
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      Ambele Active
                    </span>
                    <span className="text-[9px] font-mono bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded">Hibrid</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-snug">
                    {language === 'ro'
                      ? 'Rulează ambele strategii în paralel pe oportunități diferite, cu protecție maxim 1 poziție per monedă.'
                      : 'Runs both trading strategies concurrently on distinct opportunities with strict max 1 position per coin.'}
                  </p>
                </div>
                <div className="text-[10px] font-mono text-cyan-400/80 pt-2 border-t border-cyan-500/20 flex items-center gap-1.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full", (executionEngine || 'both') === 'both' ? "bg-cyan-400 animate-pulse" : "bg-zinc-600")}></span>
                  <span>{language === 'ro' ? 'Capacitate Maximă' : 'Maximum Coverage'}</span>
                </div>
              </button>

              {/* Option 4: Oprit / Niciunul */}
              <button
                onClick={() => setExecutionEngine('none')}
                className={cn(
                  "p-4 rounded-xl text-left border transition-all relative flex flex-col justify-between space-y-3 cursor-pointer",
                  executionEngine === 'none'
                    ? "bg-rose-500/15 border-rose-500/50 text-white shadow-lg shadow-rose-950/50 ring-1 ring-rose-500/30"
                    : "bg-zinc-950/60 border-white/5 text-zinc-400 hover:bg-white/5 hover:border-white/10"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                      <Pause className="w-3.5 h-3.5 text-rose-400" />
                      {language === 'ro' ? 'Oprit (Niciunul)' : 'Paused (None)'}
                    </span>
                    <span className="text-[9px] font-mono bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">Standby</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-snug">
                    {language === 'ro'
                      ? 'Suspendează deschiderea de noi poziții automate pe toate motoarele (Scalping și Momentum).'
                      : 'Suspends opening new automated positions across all trading engines (Scalping & Momentum).'}
                  </p>
                </div>
                <div className="text-[10px] font-mono text-rose-400/80 pt-2 border-t border-rose-500/20 flex items-center gap-1.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full", executionEngine === 'none' ? "bg-rose-400 animate-pulse" : "bg-zinc-600")}></span>
                  <span>{language === 'ro' ? 'Pauză Execuție' : 'Paused Execution'}</span>
                </div>
              </button>
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
            <h3 className="text-lg font-serif text-white mb-1">Resetare Capital Global (Scalping & Momentum)</h3>
            <p className="text-xs text-zinc-400 mb-4">Setează un capital inițial curat (ex: $1,000, $5,000, $10,000). Această acțiune va reseta istoricul, pozițiile și va sincroniza soldul pentru ambele motoare (Scalping și Momentum Simulator).</p>
            
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

      {activeTab === 'alerts' && <div className="h-full"><Alerts /></div>}
      {activeTab === 'analyst' && <div className="h-full"><AIAnalyst /></div>}
      {activeTab === 'calibration' && <div className="h-full"><AICalibration /></div>}
    </div>
  );
}
