import React, { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}
import { useTradingStore } from '../store';
import { getTranslation } from '../utils/i18n';

interface ShortcutBarProps {
  currentView: string;
  setCurrentView: (view: any) => void;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  isReconciling: boolean;
  handleManualReconcile: () => void;
}

export function ShortcutBar({
  currentView,
  setCurrentView,
  activeTab,
  setActiveTab,
  isReconciling,
  handleManualReconcile
}: ShortcutBarProps) {
  const { language } = useTradingStore();
  const t = getTranslation(language);

  const navigateTo = (view: string, tab?: string) => {
    setCurrentView(view);
    if (tab) setActiveTab(tab);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'F1':
          e.preventDefault();
          navigateTo('dashboard');
          break;
        case 'F2':
          e.preventDefault();
          navigateTo('bloomberg', 'matrix');
          break;
        case 'F3':
          e.preventDefault();
          navigateTo('momentumPaper');
          break;
        case 'F4':
          e.preventDefault();
          navigateTo('bloomberg', 'blotter');
          break;
        case 'F5':
          e.preventDefault();
          navigateTo('audit');
          break;
        case 'F6':
          e.preventDefault();
          handleManualReconcile();
          break;
        case 'F7':
          e.preventDefault();
          navigateTo('strategy');
          break;
        case 'F8':
          e.preventDefault();
          navigateTo('backtest');
          break;
        case 'F9':
          e.preventDefault();
          navigateTo('journal');
          break;
        case 'F10':
          e.preventDefault();
          navigateTo('logs');
          break;
        case 'F12':
          e.preventDefault();
          navigateTo('settings');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCurrentView, setActiveTab, handleManualReconcile]);

  return (
    <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto text-[10px] bg-zinc-950 border-b border-white/5 px-2 py-1.5 w-full">
      <button 
        onClick={() => navigateTo('dashboard')}
        className={cn(
          "px-2 py-0.5 rounded border transition-all font-bold",
          currentView === 'dashboard' ? "bg-amber-500 text-black border-amber-400" : "bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
        )}
      >
        F1 {t.overviewView || 'Overview'}
      </button>
      <button 
        onClick={() => navigateTo('bloomberg', 'matrix')}
        className={cn(
          "px-2 py-0.5 rounded border transition-all font-bold",
          currentView === 'bloomberg' && activeTab === 'matrix' ? "bg-amber-500 text-black border-amber-400" : "bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
        )}
      >
        F2 {t.cmdMatrix || 'Matrix'}
      </button>
      <button 
        onClick={() => navigateTo('momentumPaper')}
        className={cn(
          "px-2 py-0.5 rounded border transition-all font-bold",
          currentView === 'momentumPaper' ? "bg-amber-500 text-black border-amber-400" : "bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
        )}
      >
        F3 {t.momentumView || 'Momentum'}
      </button>
      <button 
        onClick={() => navigateTo('bloomberg', 'blotter')}
        className={cn(
          "px-2 py-0.5 rounded border transition-all font-bold",
          currentView === 'bloomberg' && activeTab === 'blotter' ? "bg-amber-500 text-black border-amber-400" : "bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
        )}
      >
        F4 {t.cmdPort || 'Portfolio'}
      </button>
      <button 
        onClick={() => navigateTo('audit')}
        className={cn(
          "px-2 py-0.5 rounded border transition-all font-bold",
          currentView === 'audit' ? "bg-amber-500 text-black border-amber-400" : "bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
        )}
      >
        F5 {t.cmdAudit || 'Audit'}
      </button>
      <button 
        onClick={handleManualReconcile}
        disabled={isReconciling}
        className="px-2 py-0.5 rounded border bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60 font-bold flex items-center gap-1"
      >
        <RefreshCw className={cn("w-2.5 h-2.5", isReconciling && "animate-spin")} />
        F6 {t.reconcileNow || 'Sync'}
      </button>
      <button 
        onClick={() => navigateTo('strategy')}
        className={cn(
          "px-2 py-0.5 rounded border transition-all font-bold",
          currentView === 'strategy' ? "bg-amber-500 text-black border-amber-400" : "bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
        )}
      >
        F7 {t.cmdScalp || 'Scalping'}
      </button>
      <button 
        onClick={() => navigateTo('backtest')}
        className={cn(
          "px-2 py-0.5 rounded border transition-all font-bold",
          currentView === 'backtest' ? "bg-amber-500 text-black border-amber-400" : "bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
        )}
      >
        F8 {t.backtestView || 'Backtest'}
      </button>
      <button 
        onClick={() => navigateTo('journal')}
        className={cn(
          "px-2 py-0.5 rounded border transition-all font-bold",
          currentView === 'journal' ? "bg-amber-500 text-black border-amber-400" : "bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
        )}
      >
        F9 {t.journalView || 'Journal'}
      </button>
      <button 
        onClick={() => navigateTo('logs')}
        className={cn(
          "px-2 py-0.5 rounded border transition-all font-bold",
          currentView === 'logs' ? "bg-amber-500 text-black border-amber-400" : "bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
        )}
      >
        F10 {t.logsView || 'Logs'}
      </button>
      <button 
        onClick={() => navigateTo('settings')}
        className={cn(
          "px-2 py-0.5 rounded border transition-all font-bold",
          currentView === 'settings' ? "bg-amber-500 text-black border-amber-400" : "bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
        )}
      >
        F12 {t.settingsView || 'Settings'}
      </button>
    </div>
  );
}
