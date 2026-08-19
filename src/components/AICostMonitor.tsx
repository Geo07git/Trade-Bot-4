import React, { useState } from 'react';
import { useTradingStore } from '../store';
import { DollarSign, Cpu, Zap, Calculator, BarChart2, Info, ArrowUpRight, ShieldCheck } from 'lucide-react';

interface ModelPricing {
  id: string;
  name: string;
  inputCostPerM: number;  // Cost in USD per 1,000,000 input tokens
  outputCostPerM: number; // Cost in USD per 1,000,000 output tokens
  description: string;
}

const MODEL_PRICING_PRESETS: ModelPricing[] = [
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash (Default)',
    inputCostPerM: 0.075,
    outputCostPerM: 0.30,
    description: 'Ultra-fast & cost-effective AI model'
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash (Experimental)',
    inputCostPerM: 0.10,
    outputCostPerM: 0.40,
    description: 'Next-gen flash model with enhanced speed'
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    inputCostPerM: 1.25,
    outputCostPerM: 5.00,
    description: 'Deep reasoning & complex strategy analysis'
  }
];

export const AICostMonitor: React.FC = () => {
  const aiUsageStats = useTradingStore((state) => state.aiUsageStats);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-1.5-flash');

  const currentPricing = MODEL_PRICING_PRESETS.find(m => m.id === selectedModel) || MODEL_PRICING_PRESETS[0];

  const inputTokens = aiUsageStats?.totalInputTokens || 0;
  const outputTokens = aiUsageStats?.totalOutputTokens || 0;
  const totalTokens = inputTokens + outputTokens;
  const totalRequests = aiUsageStats?.totalRequests || 0;

  // Calculate costs in USD
  const inputCost = (inputTokens / 1_000_000) * currentPricing.inputCostPerM;
  const outputCost = (outputTokens / 1_000_000) * currentPricing.outputCostPerM;
  const totalCost = inputCost + outputCost;

  // Average cost per request
  const avgCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;
  const avgTokensPerRequest = totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0;

  // Forecast for 1,000 market analyses
  const forecast1kCost = avgCostPerRequest * 1000;

  // Input vs Output percentage
  const inputCostPercentage = totalCost > 0 ? (inputCost / totalCost) * 100 : 50;
  const outputCostPercentage = totalCost > 0 ? (outputCost / totalCost) * 100 : 50;

  return (
    <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/20 border border-emerald-500/20 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-serif text-white flex items-center gap-2">
              AI Cost Monitor
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                REAL-TIME EXPENSE TRACKER
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Calcul live al cheltuielilor API Gemini în funcție de numărul de tokeni consumați
            </p>
          </div>
        </div>

        {/* Model Pricing Selector */}
        <div className="flex items-center gap-2 bg-zinc-950/80 p-1.5 rounded-xl border border-white/10 text-xs font-mono">
          <Cpu className="w-4 h-4 text-emerald-400 ml-1.5" />
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer text-xs pr-2"
          >
            {MODEL_PRICING_PRESETS.map((m) => (
              <option key={m.id} value={m.id} className="bg-zinc-900 text-white">
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Cost Highlight Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Cost Box */}
        <div className="md:col-span-1 bg-gradient-to-br from-emerald-950/40 via-zinc-950 to-zinc-950 border border-emerald-500/30 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/80 font-bold">
              Cost Total Estimat
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-emerald-400">
                ${totalCost < 0.0001 && totalCost > 0 ? totalCost.toFixed(6) : totalCost.toFixed(4)}
              </span>
              <span className="text-xs font-mono text-zinc-500">USD</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 font-mono">
              ≈ {(totalCost * 4.6).toFixed(4)} RON (curs mediu BNR)
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>Medie / interogare:</span>
            <span className="text-zinc-200 font-semibold">${avgCostPerRequest.toFixed(6)}</span>
          </div>
        </div>

        {/* Token Breakdown Metrics */}
        <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
          <div className="bg-zinc-950/60 border border-white/5 p-4 rounded-xl flex flex-col justify-between">
            <div>
              <span className="text-zinc-500 text-[10px] uppercase tracking-wider block mb-1">Total Interogări</span>
              <span className="text-xl font-bold text-white">{totalRequests.toLocaleString()}</span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-2 font-mono">
              ~{avgTokensPerRequest.toLocaleString()} tok/cererii
            </span>
          </div>

          <div className="bg-zinc-950/60 border border-white/5 p-4 rounded-xl flex flex-col justify-between">
            <div>
              <span className="text-zinc-500 text-[10px] uppercase tracking-wider block mb-1">Input Tokens</span>
              <span className="text-xl font-bold text-sky-400">{inputTokens.toLocaleString()}</span>
            </div>
            <span className="text-[10px] text-sky-400/80 mt-2 font-mono">
              ${inputCost.toFixed(6)} (${currentPricing.inputCostPerM}/1M)
            </span>
          </div>

          <div className="bg-zinc-950/60 border border-white/5 p-4 rounded-xl flex flex-col justify-between col-span-2 sm:col-span-1">
            <div>
              <span className="text-zinc-500 text-[10px] uppercase tracking-wider block mb-1">Output Tokens</span>
              <span className="text-xl font-bold text-emerald-400">{outputTokens.toLocaleString()}</span>
            </div>
            <span className="text-[10px] text-emerald-400/80 mt-2 font-mono">
              ${outputCost.toFixed(6)} (${currentPricing.outputCostPerM}/1M)
            </span>
          </div>
        </div>
      </div>

      {/* Visual Cost Proportion Bar */}
      <div className="bg-zinc-950/60 border border-white/5 p-4 rounded-xl space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
            Distribuție Cost Input vs Output
          </span>
          <span className="text-zinc-400">
            Input: <strong className="text-sky-400">{inputCostPercentage.toFixed(1)}%</strong> | Output: <strong className="text-emerald-400">{outputCostPercentage.toFixed(1)}%</strong>
          </span>
        </div>
        
        <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden flex">
          <div
            className="bg-sky-500 transition-all duration-500"
            style={{ width: `${inputCostPercentage}%` }}
            title={`Input cost: $${inputCost.toFixed(6)}`}
          />
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${outputCostPercentage}%` }}
            title={`Output cost: $${outputCost.toFixed(6)}`}
          />
        </div>
      </div>

      {/* Forecast & Estimator Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
        <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <span className="text-zinc-400 block text-[11px]">Proiecție pentru 1,000 Analize AI</span>
            <span className="text-white font-bold text-sm">
              ${forecast1kCost > 0 ? forecast1kCost.toFixed(2) : (0.05).toFixed(2)} USD
            </span>
            <p className="text-[10px] text-zinc-500">Estimare bazată pe profilul mediu de tokeni</p>
          </div>
        </div>

        <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-zinc-400 block text-[11px]">Eficiență & Optimizare Prompt</span>
            <span className="text-emerald-400 font-bold text-xs">
              Gemini 1.5 Flash (Ultra Economic)
            </span>
            <p className="text-[10px] text-zinc-500">1,000 interogări tipice costă sub $0.05 USD</p>
          </div>
        </div>
      </div>

      {/* Last Request Footprint */}
      {aiUsageStats?.lastRequestTime ? (
        <div className="bg-zinc-950/80 border border-emerald-500/20 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            Amprentă ultimul apel API:
          </span>
          <span className="text-emerald-300 font-semibold">
            {aiUsageStats.lastInputTokens} in / {aiUsageStats.lastOutputTokens} out ({aiUsageStats.lastInputTokens + aiUsageStats.lastOutputTokens} total) → ${(((aiUsageStats.lastInputTokens / 1e6) * currentPricing.inputCostPerM) + ((aiUsageStats.lastOutputTokens / 1e6) * currentPricing.outputCostPerM)).toFixed(6)} USD
          </span>
        </div>
      ) : (
        <div className="text-xs text-zinc-500 font-mono italic flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-zinc-600" />
          Nicio interogare AI înregistrată în această sesiune. Folosește "AI Analyst" din meniu pentru a simula sau executa analize.
        </div>
      )}
    </div>
  );
};
