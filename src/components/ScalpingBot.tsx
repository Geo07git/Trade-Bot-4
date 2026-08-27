import React, { useState, useEffect } from 'react';
import { useTradingStore } from '../store';
import { 
  Zap, 
  Play, 
  Pause, 
  Settings2, 
  RotateCcw, 
  TrendingUp, 
  Activity, 
  Sliders, 
  Sparkles, 
  Info, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Gauge, 
  Clock, 
  Percent, 
  Flame, 
  ShieldCheck,
  BarChart3,
  X,
  Compass
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function ScalpingBot() {
  const {
    scalpingActive,
    scalpingConfig,
    setScalpingConfig,
    toggleScalpingEngine,
    resetScalpingEngine,
    watchlist,
    marketOpportunities,
    positions,
    balance,
    logs,
    signalJournal,
    autoTradingActive
  } = useTradingStore();

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form local state
  const [minRfProb, setMinRfProb] = useState<number>(scalpingConfig?.minRfProb ?? 70);
  const [minMetaScore, setMinMetaScore] = useState<number>(scalpingConfig?.minMetaScore ?? 70);
  const [stopLossPercent, setStopLossPercent] = useState<number>(scalpingConfig?.stopLossPercent ?? 1.0);
  const [targetTakeProfit, setTargetTakeProfit] = useState<number>(scalpingConfig?.targetTakeProfit ?? 3.0);
  const [trailingStopActivation, setTrailingStopActivation] = useState<number>(scalpingConfig?.trailingStopActivation ?? 1.5);
  const [trailingStopDistance, setTrailingStopDistance] = useState<number>(scalpingConfig?.trailingStopDistance ?? 0.5);
  const [breakEvenActivation, setBreakEvenActivation] = useState<number>(scalpingConfig?.breakEvenActivation ?? 1.0);
  const [positionSizePercent, setPositionSizePercent] = useState<number>(scalpingConfig?.positionSizePercent ?? 5.0);
  const [maxHoldMinutes, setMaxHoldMinutes] = useState<number>(scalpingConfig?.maxHoldMinutes ?? 15);
  const [maxNegativeHoldMinutes, setMaxNegativeHoldMinutesState] = useState<number>(scalpingConfig?.maxNegativeHoldMinutes ?? 1.0);
  const [enableMaxNegativeHold, setEnableMaxNegativeHold] = useState<boolean>(scalpingConfig?.enableMaxNegativeHold ?? true);
  const [minOpportunityScore, setMinOpportunityScore] = useState<number>(scalpingConfig?.minOpportunityScore ?? 50);
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(scalpingConfig?.cooldownMinutes ?? 2);
  const [minVolumeGrowth, setMinVolumeGrowth] = useState<number>(scalpingConfig?.minVolumeGrowth ?? 0.8);
  const [enableDynamicSizing, setEnableDynamicSizing] = useState<boolean>(scalpingConfig?.enableDynamicSizing ?? true);
  const [enableStagnationFilter, setEnableStagnationFilter] = useState<boolean>(scalpingConfig?.enableStagnationFilter ?? true);
  const [minAtrPctThreshold, setMinAtrPctThreshold] = useState<number>(scalpingConfig?.minAtrPctThreshold ?? 0.30);
  const [minRange20pThreshold, setMinRange20pThreshold] = useState<number>(scalpingConfig?.minRange20pThreshold ?? 0.55);
  const [leverage, setLeverage] = useState<number>(scalpingConfig?.leverage ?? 1);

  const setTimeframe = (timeframe: '1m' | '5m') => {
    const is5m = timeframe === '5m';
    
    // Configurații conform tabelului userului
    const newConfig = {
      timeframe,
      minRfProb: is5m ? 60 : 65,
      minMetaScore: is5m ? 55 : 58,
      stopLossPercent: is5m ? 0.50 : 0.30,
      targetTakeProfit: is5m ? 1.00 : 0.60,
      trailingStopActivation: is5m ? 0.55 : 0.35,
      trailingStopDistance: is5m ? 0.18 : 0.12,
      breakEvenActivation: is5m ? 0.40 : 0.40,
      maxHoldMinutes: is5m ? 25 : 5,
      cooldownMinutes: is5m ? 5 : 1,
      minAtrPctThreshold: is5m ? 0.12 : 0.05,
      minRange20pThreshold: is5m ? 0.38 : 0.20,
      positionSizePercent: 5.0,
      leverage: 1,
      enableMaxNegativeHold: false,
      enableDynamicSizing: true
    };

    setScalpingConfig({ ...scalpingConfig, ...newConfig });
    
    // Resetează starea locală pentru form
    setMinRfProb(newConfig.minRfProb);
    setMinMetaScore(newConfig.minMetaScore);
    setStopLossPercent(newConfig.stopLossPercent);
    setTargetTakeProfit(newConfig.targetTakeProfit);
    setTrailingStopActivation(newConfig.trailingStopActivation);
    setTrailingStopDistance(newConfig.trailingStopDistance);
    setBreakEvenActivation(newConfig.breakEvenActivation);
    setMaxHoldMinutes(newConfig.maxHoldMinutes);
    setCooldownMinutes(newConfig.cooldownMinutes);
    setMinAtrPctThreshold(newConfig.minAtrPctThreshold);
    setMinRange20pThreshold(newConfig.minRange20pThreshold);
    setPositionSizePercent(newConfig.positionSizePercent);
    setLeverage(newConfig.leverage);
    setEnableMaxNegativeHold(newConfig.enableMaxNegativeHold);
    setEnableDynamicSizing(newConfig.enableDynamicSizing);
  };

  // Sync state when scalpingConfig changes or modal opens
  useEffect(() => {
    if (scalpingConfig) {
      setMinRfProb(scalpingConfig.minRfProb ?? 70);
      setMinMetaScore(scalpingConfig.minMetaScore ?? 70);
      setStopLossPercent(scalpingConfig.stopLossPercent ?? 1.0);
      setTargetTakeProfit(scalpingConfig.targetTakeProfit ?? 3.0);
      setTrailingStopActivation(scalpingConfig.trailingStopActivation ?? 1.5);
      setTrailingStopDistance(scalpingConfig.trailingStopDistance ?? 0.5);
      setBreakEvenActivation(scalpingConfig.breakEvenActivation ?? 1.0);
      setPositionSizePercent(scalpingConfig.positionSizePercent ?? 5.0);
      setMaxHoldMinutes(scalpingConfig.maxHoldMinutes ?? 15);
      setMaxNegativeHoldMinutesState(scalpingConfig.maxNegativeHoldMinutes ?? 1.0);
      setEnableMaxNegativeHold(scalpingConfig.enableMaxNegativeHold ?? true);
      setMinOpportunityScore(scalpingConfig.minOpportunityScore ?? 50);
      setCooldownMinutes(scalpingConfig.cooldownMinutes ?? 2);
      setMinVolumeGrowth(scalpingConfig.minVolumeGrowth ?? 0.8);
      setEnableDynamicSizing(scalpingConfig.enableDynamicSizing ?? true);
      setEnableStagnationFilter(scalpingConfig.enableStagnationFilter ?? true);
      setMinAtrPctThreshold(scalpingConfig.minAtrPctThreshold ?? 0.30);
      setMinRange20pThreshold(scalpingConfig.minRange20pThreshold ?? 0.55);
      setLeverage(scalpingConfig.leverage ?? 1);
    }
  }, [scalpingConfig, isConfigOpen]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setScalpingConfig({
      active: scalpingActive,
      timeframe: scalpingConfig?.timeframe || '1m',
      minRfProb,
      minMetaScore,
      stopLossPercent,
      targetTakeProfit,
      trailingStopActivation,
      trailingStopDistance,
      breakEvenActivation,
      positionSizePercent,
      maxHoldMinutes,
      maxNegativeHoldMinutes,
      enableMaxNegativeHold,
      minOpportunityScore,
      cooldownMinutes,
      minVolumeGrowth,
      enableDynamicSizing,
      enableStagnationFilter,
      minAtrPctThreshold,
      minRange20pThreshold,
      leverage
    });
    setTimeout(() => {
      setIsSaving(false);
      setIsConfigOpen(false);
    }, 400);
  };

  const applyPreset = (type: 'Conservator' | 'Free Trade' | 'Configurabil' | 'Dinamic' | 'aggressive' | 'balanced' | 'conservative') => {
    if (type === 'Conservator' || type === 'conservative') {
      setMinRfProb(75);
      setMinMetaScore(55);
      setStopLossPercent(0.55);
      setTargetTakeProfit(0.85);
      setTrailingStopActivation(0.50);
      setTrailingStopDistance(0.15);
      setBreakEvenActivation(0.35);
      setPositionSizePercent(5.0);
      setMaxHoldMinutes(8);
      setMinOpportunityScore(55);
      setCooldownMinutes(2);
      setMinVolumeGrowth(0.8);
      setEnableDynamicSizing(false);
    } else if (type === 'Free Trade' || type === 'aggressive') {
      setMinRfProb(70);
      setMinMetaScore(50);
      setStopLossPercent(1.0);
      setTargetTakeProfit(5.0);
      setTrailingStopActivation(0.60);
      setTrailingStopDistance(0.35);
      setBreakEvenActivation(0.40);
      setPositionSizePercent(5.0);
      setMaxHoldMinutes(8);
      setMinOpportunityScore(50);
      setCooldownMinutes(2);
      setMinVolumeGrowth(0.8);
      setEnableDynamicSizing(true);
    } else if (type === 'Configurabil' || type === 'balanced') {
      setMinRfProb(70);
      setMinMetaScore(70);
      setStopLossPercent(1.0);
      setTargetTakeProfit(3.0);
      setTrailingStopActivation(1.5);
      setTrailingStopDistance(0.5);
      setBreakEvenActivation(1.0);
      setPositionSizePercent(5.0);
      setMaxHoldMinutes(8);
      setMinOpportunityScore(55);
      setCooldownMinutes(2);
      setMinVolumeGrowth(0.8);
      setEnableDynamicSizing(true);
    } else if (type === 'Dinamic') {
      setMinRfProb(75);
      setMinMetaScore(55);
      setStopLossPercent(1.0);
      setTargetTakeProfit(1.0);
      setTrailingStopActivation(0.50);
      setTrailingStopDistance(0.15);
      setBreakEvenActivation(0.35);
      setPositionSizePercent(5.0);
      setMaxHoldMinutes(8);
      setMinOpportunityScore(55);
      setCooldownMinutes(2);
      setMinVolumeGrowth(0.8);
      setEnableDynamicSizing(true);
    }
  };

  // Recent scalping signals from signal journal
  const scalpingSignals = (signalJournal || []).slice(0, 15);
  const activeScalpPositions = positions || [];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-black text-zinc-100 p-3 sm:p-6 space-y-4 sm:space-y-6 pb-28 scrollbar-thin scrollbar-thumb-zinc-800">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-zinc-950 border border-white/10 p-3.5 sm:p-6 rounded-2xl relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400">
            <Zap className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-serif font-bold text-white tracking-tight">Motor Scalping ML 24/7</h2>
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-mono font-medium border flex items-center gap-1.5",
                scalpingActive 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/20" 
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              )}>
                <span className={cn("w-2 h-2 rounded-full", scalpingActive ? "bg-emerald-400 animate-ping" : "bg-amber-400")} />
                {scalpingActive ? 'ACTIV - SCANARE HIGH-FREQ' : 'ÎN AȘTEPTARE / STANDBY'}
              </span>
              
              {/* TIMEFRAME TOGGLE BUTTON */}
              <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-white/10">
                <button
                  onClick={() => setTimeframe('1m')}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-bold transition-all",
                    scalpingConfig?.timeframe === '1m' ? "bg-emerald-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  1m
                </button>
                <button
                  onClick={() => setTimeframe('5m')}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-bold transition-all",
                    scalpingConfig?.timeframe === '5m' ? "bg-emerald-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  5m
                </button>
              </div>
            </div>
            <p className="text-zinc-400 text-xs mt-1 max-w-xl">
              Motorul de execuție rapidă bazat pe Random Forest Ensemble și MetaTradeScore. Execută scalping autonom pe oportunități cu volum și probabilitate ridicată.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto relative z-10">
          <button
            onClick={() => toggleScalpingEngine()}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all shadow-lg",
              scalpingActive
                ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 hover:border-amber-500/60"
                : "bg-emerald-500 hover:bg-emerald-400 text-black font-semibold shadow-emerald-500/25"
            )}
          >
            {scalpingActive ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                OPRIRE Motor
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                PORNIRE Motor
              </>
            )}
          </button>

          <button
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 text-sm font-medium transition-all"
          >
            <Sliders className="w-4 h-4 text-emerald-400" />
            Configurare Praguri
          </button>

          <button
            onClick={() => resetScalpingEngine()}
            title="Resetare valori implicite"
            className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/10 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: RF Prob Min */}
        <div className="bg-zinc-950/80 border border-white/5 p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Prag Min. Probabilitate RF</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-white">
            {scalpingConfig?.minRfProb ?? 50}%
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Random Forest Ensemble Gate</p>
        </div>

        {/* Card 2: MetaScore Min */}
        <div className="bg-zinc-950/80 border border-white/5 p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Prag Min. MetaScore</span>
            <Gauge className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-400">
            {scalpingConfig?.minMetaScore ?? 50}<span className="text-xs text-zinc-500 font-normal"> / 100</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Scor Unificat de Confirmetii</p>
        </div>

        {/* Card 3: SL & TP */}
        <div className="bg-zinc-950/80 border border-white/5 p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Risc / Recompensă (SL / TP)</span>
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-white flex items-center gap-2">
            <span className="text-rose-400">-{scalpingConfig?.stopLossPercent ?? 2.0}%</span>
            <span className="text-zinc-600">/</span>
            <span className="text-emerald-400">+{scalpingConfig?.targetTakeProfit ?? 1.2}%</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            Trail Drop: {scalpingConfig?.trailingStopDistance ?? 0.5}% | BE: +{scalpingConfig?.breakEvenActivation ?? 1.0}%
          </p>
        </div>

        {/* Card 4: Hold Time & Position Sizing */}
        <div className="bg-zinc-950/80 border border-white/5 p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Max Hold &amp; Sizing</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-white flex items-center gap-1.5 flex-wrap">
            {scalpingConfig?.maxHoldMinutes ?? 15} <span className="text-xs text-zinc-400 font-normal">min</span>
            <span className="text-zinc-600 mx-1">|</span>
            <span className="text-emerald-400">{scalpingConfig?.positionSizePercent ?? 5}%</span>
            <span className="text-zinc-600 mx-1">|</span>
            <span className="text-amber-400 font-bold">{scalpingConfig?.leverage ?? 1}x</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            Sizing Dinamic: {scalpingConfig?.enableDynamicSizing ? 'ACTIV ⚡' : 'INACTIV'} | Levier Scalping: {scalpingConfig?.leverage ?? 1}x
          </p>
        </div>
      </div>

      {/* Preset Quick Actions */}
      <div className="bg-zinc-950/80 border border-white/10 p-5 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Flame className="w-4 h-4 text-orange-400" />
            Preseturi Rapide de Configurare Motor Scalping
          </div>
          <span className="text-xs text-zinc-400">Apasă un preset pentru a încărca configurația optimizată</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => {
              applyPreset('Conservator');
              setScalpingConfig({
                minRfProb: 75,
                minMetaScore: 55,
                stopLossPercent: 0.55,
                targetTakeProfit: 0.85,
                trailingStopActivation: 0.50,
                trailingStopDistance: 0.15,
                breakEvenActivation: 0.35,
                maxHoldMinutes: 8,
              });
            }}
            className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-left transition-all group"
          >
            <div className="flex items-center justify-between font-semibold text-emerald-400 text-sm mb-1">
              <span>🛡️ Conservator</span>
              <span className="text-[10px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">Default</span>
            </div>
            <p className="text-xs text-zinc-400">
              RF: 75% | MetaScore: 55 | SL: 0.55% | TP: 0.85% | Trail: 0.5% | Hold: 8m
            </p>
          </button>

          <button
            onClick={() => {
              applyPreset('Free Trade');
              setScalpingConfig({
                minRfProb: 70,
                minMetaScore: 50,
                stopLossPercent: 1.0,
                targetTakeProfit: 5.0,
                trailingStopActivation: 0.60,
                trailingStopDistance: 0.35,
                breakEvenActivation: 0.40,
                maxHoldMinutes: 8,
              });
            }}
            className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10 text-left transition-all group"
          >
            <div className="flex items-center justify-between font-semibold text-sky-400 text-sm mb-1">
              <span>🚀 Free Trade</span>
              <span className="text-[10px] font-mono bg-sky-500/20 px-2 py-0.5 rounded text-sky-300">Agresiv</span>
            </div>
            <p className="text-xs text-zinc-400">
              RF: 70% | MetaScore: 50 | SL: 1.0% | TP: 5.0% | BE: 0.4% | Trail: 0.6%
            </p>
          </button>

          <button
            onClick={() => {
              applyPreset('Configurabil');
              setScalpingConfig({
                minRfProb: 70,
                minMetaScore: 70,
                stopLossPercent: 1.0,
                targetTakeProfit: 3.0,
                trailingStopActivation: 1.5,
                trailingStopDistance: 0.5,
                breakEvenActivation: 1.0,
                maxHoldMinutes: 8,
              });
            }}
            className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-left transition-all group"
          >
            <div className="flex items-center justify-between font-semibold text-amber-400 text-sm mb-1">
              <span>⚙️ Configurabil</span>
              <span className="text-[10px] font-mono bg-amber-500/20 px-2 py-0.5 rounded text-amber-300">Custom</span>
            </div>
            <p className="text-xs text-zinc-400">
              Setări manuale avansate. RF: 70% | MetaScore: 70 | TP: 3.0%
            </p>
          </button>
          
          <button
            onClick={() => {
              applyPreset('Dinamic');
              setScalpingConfig({
                minRfProb: 75,
                minMetaScore: 55,
                stopLossPercent: 1.0, // Va fi suprascris
                targetTakeProfit: 1.0, // Va fi suprascris
                trailingStopActivation: 0.50,
                trailingStopDistance: 0.15,
                breakEvenActivation: 0.35,
                maxHoldMinutes: 8,
                enableDynamicTpSl: true
              });
            }}
            className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 text-left transition-all group"
          >
            <div className="flex items-center justify-between font-semibold text-purple-400 text-sm mb-1">
              <span>⚡ Dinamic</span>
              <span className="text-[10px] font-mono bg-purple-500/20 px-2 py-0.5 rounded text-purple-300">ATR-ML</span>
            </div>
            <p className="text-xs text-zinc-400">
              TP/SL: Dinamic (Calculat în timp real de bot).
            </p>
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Watchlist & Live Scalping Signals */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-950/80 border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                Candidați Scalping &amp; Evaluare Filtre ML (Watchlist Active)
              </h3>
              <span className="text-xs font-mono text-zinc-400">{watchlist.filter(w => w.active).length} Monede Active</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-zinc-400 border-b border-white/10 pb-2">
                    <th className="py-2.5 font-medium">Simbol</th>
                    <th className="py-2.5 font-medium">Preț Curent</th>
                    <th className="py-2.5 font-medium">RF Prob</th>
                    <th className="py-2.5 font-medium">OppScore</th>
                    <th className="py-2.5 font-medium">Status / Semnal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {watchlist.filter(w => w.active).slice(0, 10).map((item) => {
                    const opp = marketOpportunities.find(o => o.symbol === item.symbol);
                    const prob = item.signal?.prob || opp?.rfProb || 50;
                    const oppScore = opp?.opportunityScore || item.opportunityScore || 50;
                    const passRf = prob >= (scalpingConfig?.minRfProb ?? 50);
                    const passOpp = oppScore >= (scalpingConfig?.minOpportunityScore ?? 55);

                    return (
                      <tr key={item.symbol} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 font-semibold text-white">{item.symbol}</td>
                        <td className="py-3 text-zinc-300">
                          ${item.price ? item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '---'}
                        </td>
                        <td className="py-3">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[11px] font-semibold",
                            passRf ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                          )}>
                            {prob}%
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[11px] font-semibold",
                            passOpp ? "bg-teal-500/20 text-teal-300" : "bg-amber-500/20 text-amber-400"
                          )}>
                            {oppScore}/100
                          </span>
                        </td>
                        <td className="py-3">
                          {item.signal?.action === 'BUY' ? (
                            <span className="text-emerald-400 flex items-center gap-1 font-bold">
                              <ArrowUpRight className="w-3.5 h-3.5" /> BUY
                            </span>
                          ) : item.signal?.action === 'SELL' ? (
                            <span className="text-rose-400 flex items-center gap-1 font-bold">
                              <ArrowDownRight className="w-3.5 h-3.5" /> SELL
                            </span>
                          ) : (
                            <span className="text-zinc-500">HOLD</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Scalping Positions */}
          <div className="bg-zinc-950/80 border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Poziții Active în Curs (Scalping Engine)
              </h3>
              <span className="text-xs font-mono text-zinc-400">{activeScalpPositions.length} Poziții Deschise</span>
            </div>

            {activeScalpPositions.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-xl text-zinc-500 text-xs">
                Nicio poziție de scalping deschisă în acest moment. Motorul scannează piața 24/7.
              </div>
            ) : (
              <div className="space-y-3">
                {activeScalpPositions.map((pos) => {
                  const pnl = (pos.currentPrice - pos.entryPrice) * pos.amount;
                  const pnlPct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;

                  return (
                    <div key={pos.symbol} className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{pos.symbol}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                            {pos.amount} cant.
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400 mt-1 space-x-3 font-mono">
                          <span>Intrare: ${pos.entryPrice.toFixed(4)}</span>
                          <span>Preț: ${pos.currentPrice.toFixed(4)}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={cn("text-base font-mono font-bold", pnlPct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                        </div>
                        <div className="text-xs text-zinc-400 font-mono">
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Signal Journal Audit */}
        <div className="space-y-6">
          <div className="bg-zinc-950/80 border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-400" />
                Audit Semnale Scalping ML
              </h3>
              <span className="text-[11px] text-zinc-400 font-mono">Real-time</span>
            </div>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {scalpingSignals.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-xs">
                  Așteptăm primele semnale generate de motor.
                </div>
              ) : (
                scalpingSignals.map((entry) => (
                  <div key={entry.id} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1 text-xs">
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-white">{entry.symbol}</span>
                      <span className="text-[10px] text-zinc-500">{entry.time}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-zinc-400">Preț: ${entry.price.toFixed(4)}</span>
                      <span className={cn("font-bold", entry.finalAction === 'BUY' ? 'text-emerald-400' : 'text-zinc-400')}>
                        {entry.finalAction}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-400 italic pt-1 border-t border-white/5">
                      {entry.vetoReason || entry.explanation?.[0] || 'Semnal evaluat de ML'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Parametri Praguri Motor Scalping ML</h3>
                  <p className="text-xs text-zinc-400">Setează pragurile de filtru, Stop Loss, Take Profit și Trailing Stop preluat 24/7 de motor.</p>
                </div>
              </div>
              <button onClick={() => setIsConfigOpen(false)} className="p-2 text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
              {/* RF Probability */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <label className="text-zinc-200">Prag Min. Probabilitate RF (%)</label>
                  <span className="text-emerald-400 font-mono font-bold">{minRfProb}%</span>
                </div>
                <input 
                  type="range" 
                  min="30" 
                  max="90" 
                  value={minRfProb} 
                  onChange={(e) => setMinRfProb(Number(e.target.value))}
                  className="w-full accent-emerald-500" 
                />
              </div>

              {/* MetaScore */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <label className="text-zinc-200">Prag Min. MetaScore (0-100)</label>
                  <span className="text-emerald-400 font-mono font-bold">{minMetaScore}</span>
                </div>
                <input 
                  type="range" 
                  min="30" 
                  max="90" 
                  value={minMetaScore} 
                  onChange={(e) => setMinMetaScore(Number(e.target.value))}
                  className="w-full accent-emerald-500" 
                />
              </div>

              {/* Stop Loss & Take Profit */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <label className="text-zinc-200">Stop Loss (%)</label>
                    <span className="text-rose-400 font-mono font-bold">-{stopLossPercent}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="5.0" 
                    step="0.1" 
                    value={stopLossPercent} 
                    onChange={(e) => setStopLossPercent(Number(e.target.value))}
                    className="w-full accent-rose-500" 
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <label className="text-zinc-200">Target Take Profit (%)</label>
                    <span className="text-emerald-400 font-mono font-bold">+{targetTakeProfit}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="5.0" 
                    step="0.1" 
                    value={targetTakeProfit} 
                    onChange={(e) => setTargetTakeProfit(Number(e.target.value))}
                    className="w-full accent-emerald-500" 
                  />
                </div>
              </div>

              {/* Trailing Stop Activation & Drop Distance */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <label className="text-zinc-200">Activare Trailing Stop (%)</label>
                    <span className="text-teal-400 font-mono font-bold">+{trailingStopActivation}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="5.0" 
                    step="0.1" 
                    value={trailingStopActivation} 
                    onChange={(e) => setTrailingStopActivation(Number(e.target.value))}
                    className="w-full accent-teal-500" 
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <label className="text-zinc-200">Trailing Drop Distance (%)</label>
                    <span className="text-teal-300 font-mono font-bold">-{trailingStopDistance}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.2" 
                    max="2.0" 
                    step="0.1" 
                    value={trailingStopDistance} 
                    onChange={(e) => setTrailingStopDistance(Number(e.target.value))}
                    className="w-full accent-teal-400" 
                  />
                </div>
              </div>

              {/* Break Even Activation & Position Size */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <label className="text-zinc-200">Activare Break-Even (%)</label>
                    <span className="text-blue-400 font-mono font-bold">+{breakEvenActivation}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.3" 
                    max="3.0" 
                    step="0.1" 
                    value={breakEvenActivation} 
                    onChange={(e) => setBreakEvenActivation(Number(e.target.value))}
                    className="w-full accent-blue-500" 
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <label className="text-zinc-200">Alocare Capital / Poziție (%)</label>
                    <span className="text-emerald-400 font-mono font-bold">{positionSizePercent}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    step="1" 
                    value={positionSizePercent} 
                    onChange={(e) => setPositionSizePercent(Number(e.target.value))}
                    className="w-full accent-emerald-500" 
                  />
                </div>
              </div>

              {/* Leverage (Levier Scalping) */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <label className="text-xs font-semibold text-amber-200">Levier Multiplicator (Scalping Only)</label>
                  </div>
                  <span className="text-amber-400 font-mono font-bold text-sm bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                    {leverage}x
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Amplifică puterea de cumpărare și expunerea pentru tranzacțiile rapide de Scalping fără a afecta alte module (Grid/Manual).
                </p>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    min="1" 
                    max="50" 
                    step="1" 
                    value={leverage} 
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="w-full accent-amber-500" 
                  />
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {[1, 2, 3, 5, 10, 20].map((levVal) => (
                      <button
                        key={levVal}
                        type="button"
                        onClick={() => setLeverage(levVal)}
                        className={`px-2 py-1 text-xs rounded font-mono transition-all ${
                          leverage === levVal
                            ? 'bg-amber-500 text-black font-bold'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        {levVal}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Max Hold Duration & Cooldown */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <label className="text-zinc-200">Max Hold Duration (minute)</label>
                    <span className="text-purple-400 font-mono font-bold">{maxHoldMinutes} min</span>
                  </div>
                  <input 
                    type="range" 
                    min="3" 
                    max="120" 
                    step="1" 
                    value={maxHoldMinutes} 
                    onChange={(e) => setMaxHoldMinutes(Number(e.target.value))}
                    className="w-full accent-purple-500" 
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <label className="text-zinc-200">Cooldown Anti-Whipsaw (minute)</label>
                    <span className="text-amber-400 font-mono font-bold">{cooldownMinutes} min</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="30" 
                    step="1" 
                    value={cooldownMinutes} 
                    onChange={(e) => setCooldownMinutes(Number(e.target.value))}
                    className="w-full accent-amber-500" 
                  />
                </div>
              </div>

              {/* Max Negative Hold Time Slider (Regulă nouă: deținere pe minus cu comutator ON/OFF) */}
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-2.5">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <label className="text-rose-200 flex items-center gap-1.5">
                    <span>⏳ Limită Timp pe Minus (PnL &lt; 0)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs font-mono font-bold px-2 py-0.5 rounded border transition-colors",
                      enableMaxNegativeHold
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    )}>
                      {enableMaxNegativeHold ? `${maxNegativeHoldMinutes} min` : 'DEZACTIVAT'}
                    </span>
                    {/* Toggle ON/OFF Switch */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={enableMaxNegativeHold} 
                        onChange={(e) => setEnableMaxNegativeHold(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                    </label>
                  </div>
                </div>
                {enableMaxNegativeHold ? (
                  <>
                    <input 
                      type="range" 
                      min="0.1" 
                      max="15" 
                      step="0.1" 
                      value={maxNegativeHoldMinutes} 
                      onChange={(e) => setMaxNegativeHoldMinutesState(Number(e.target.value))}
                      className="w-full accent-rose-500 cursor-pointer" 
                    />
                    <div className="text-[11px] text-rose-300/80 leading-relaxed">
                      Când o poziție BUY trece în PnL negativ, pornește o numărătoare inversă de <strong className="text-rose-200">{maxNegativeHoldMinutes} min</strong>. Dacă rămâne negativă la expirare, botul închide tranzacția prin SELL automat.
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-zinc-400 italic bg-black/20 p-2 rounded-lg border border-white/5">
                    Regula de limita de timp pe minus este <strong className="text-zinc-300">Dezactivată</strong>. Pozițiile pe minus vor fi gestionate exclusiv prin Stop Loss sau timpul de deținere maxim standard.
                  </div>
                )}
              </div>

              {/* Filtru Stagnare & Volatilitate Scăzută (NO-TRADE Regime) */}
              <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 space-y-3">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <label className="text-cyan-200 flex items-center gap-1.5">
                    <span>🧊 Filtru Stagnare & Comisioane (NO-TRADE)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs font-mono font-bold px-2 py-0.5 rounded border transition-colors",
                      enableStagnationFilter
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    )}>
                      {enableStagnationFilter ? 'ACTIV' : 'DEZACTIVAT'}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={enableStagnationFilter} 
                        onChange={(e) => setEnableStagnationFilter(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                    </label>
                  </div>
                </div>

                {enableStagnationFilter ? (
                  <div className="space-y-2.5 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-zinc-300">Min ATR Volatilitate:</span>
                          <span className="text-cyan-400 font-mono font-bold">{minAtrPctThreshold}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.10" 
                          max="0.80" 
                          step="0.05" 
                          value={minAtrPctThreshold} 
                          onChange={(e) => setMinAtrPctThreshold(Number(e.target.value))}
                          className="w-full accent-cyan-500 cursor-pointer" 
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-zinc-300">Min Range 20 Lumânări:</span>
                          <span className="text-cyan-400 font-mono font-bold">{minRange20pThreshold}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.20" 
                          max="1.50" 
                          step="0.05" 
                          value={minRange20pThreshold} 
                          onChange={(e) => setMinRange20pThreshold(Number(e.target.value))}
                          className="w-full accent-cyan-500 cursor-pointer" 
                        />
                      </div>
                    </div>

                    <div className="text-[11px] text-cyan-300/80 leading-relaxed bg-cyan-950/40 p-2 rounded-lg border border-cyan-800/30">
                      Când volatilitatea (ATR % &lt; <strong className="text-cyan-200">{minAtrPctThreshold}%</strong> sau Range 20p &lt; <strong className="text-cyan-200">{minRange20pThreshold}%</strong>) este prea mică, botul intră automat în regimul <strong className="text-cyan-200">NO-TRADE</strong>. Previne consumarea profitului prin comisioanele Binance (~0.15%-0.20% tur-retur) în perioadele de stagnare.
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-zinc-400 italic bg-black/20 p-2 rounded-lg border border-white/5">
                    Filtru de Stagnare <strong className="text-zinc-300">Dezactivat</strong>. Botul poate executa tranzacții și în mișcări laterale foarte înguste.
                  </div>
                )}
              </div>

              {/* Dynamic Sizing Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div>
                  <div className="text-xs font-semibold text-white">Sizing Dinamic de Capital</div>
                  <div className="text-[11px] text-zinc-400">Scalează automat alocarea la 1.2x - 1.5x pentru semnale cu MetaScore &gt; 80.</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={enableDynamicSizing} 
                  onChange={(e) => setEnableDynamicSizing(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded" 
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <button
                onClick={() => setIsConfigOpen(false)}
                className="px-4 py-2.5 rounded-xl text-zinc-400 hover:text-white text-xs font-medium"
              >
                Anulare
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-lg shadow-emerald-500/20"
              >
                {isSaving ? 'Se salvează...' : 'Salvează și Aplică în Motor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
