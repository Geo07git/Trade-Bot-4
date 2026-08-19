import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleHardRefresh = () => {
    localStorage.removeItem('trading_store');
    window.location.reload();
  };

  private handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-black text-zinc-100 flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-zinc-900 border border-rose-500/30 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Eroare Interfață G&S-Trade-Bot</h1>
                <p className="text-xs text-zinc-400">A apărut o eroare neașteptată în interfață.</p>
              </div>
            </div>

            <div className="bg-zinc-950 border border-white/5 rounded-xl p-3 text-xs font-mono text-rose-300 overflow-x-auto max-h-40">
              {this.state.error?.message || 'Eroare necunoscută la randare'}
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={this.handleReload}
                  className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reîncarcă Pagina</span>
                </button>

                <button
                  onClick={this.handleHardRefresh}
                  className="flex-1 py-2.5 px-4 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Hard Refresh</span>
                </button>
              </div>

              <button
                onClick={this.handleReset}
                className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Resetare State Local complet</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
