import React, { useState, useEffect } from 'react';
import { NewsArticle } from '../types';
import { Newspaper, RefreshCw, ExternalLink, TrendingUp, TrendingDown, Minus, Search, Sparkles, Filter, ShieldCheck, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function NewsFeed() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [aiAnalysisTarget, setAiAnalysisTarget] = useState<NewsArticle | null>(null);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/news');
      if (res.ok) {
        const data = await res.json();
        if (data.articles) {
          setArticles(data.articles);
        }
      }
    } catch (err) {
      console.error('Error fetching news feed:', err);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 60000); // Auto-refresh every 60s
    return () => clearInterval(interval);
  }, []);

  // Calculate sentiment metrics
  const bullishCount = articles.filter(a => a.sentiment === 'bullish').length;
  const bearishCount = articles.filter(a => a.sentiment === 'bearish').length;
  const neutralCount = articles.filter(a => a.sentiment === 'neutral').length;
  const totalArticles = articles.length || 1;
  const bullishPercent = Math.round((bullishCount / totalArticles) * 100);

  // Filter articles
  const filteredArticles = articles.filter(article => {
    const matchesSearch = 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.relatedSymbols?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'binance') {
      return article.source.toLowerCase().includes('binance') || 
             article.categories.some(c => c.toLowerCase().includes('binance') || c.toLowerCase().includes('bnb'));
    }
    if (selectedCategory === 'btc') {
      return article.categories.some(c => c.toLowerCase().includes('btc') || c.toLowerCase().includes('bitcoin')) ||
             article.relatedSymbols?.includes('BTCUSDT');
    }
    if (selectedCategory === 'bullish') return article.sentiment === 'bullish';
    if (selectedCategory === 'bearish') return article.sentiment === 'bearish';

    return true;
  });

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = new Date().getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Chiar acum';
      if (diffMins < 60) return `acum ${diffMins} min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `acum ${diffHours} ore`;
      const diffDays = Math.floor(diffHours / 24);
      return `acum ${diffDays} zile`;
    } catch {
      return 'recent';
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-zinc-100 overflow-hidden">
      {/* Top Bar Header */}
      <header className="h-20 border-b border-white/5 flex items-center justify-between px-4 sm:px-8 bg-zinc-900/10 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Newspaper className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-xl text-white font-medium">Flux Știri Binance & Crypto</h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                LIVE FEED
              </span>
            </div>
            <p className="text-[10px] uppercase text-zinc-500 tracking-wider mt-0.5">
              Anunțuri oficiale, stiri de piață și analiză de sentiment în timp real
            </p>
          </div>
        </div>

        <button 
          onClick={fetchNews}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-white/10 hover:border-emerald-500/50 rounded-xl text-xs font-mono text-zinc-300 transition-colors"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin text-emerald-400")} />
          <span className="hidden sm:inline">Actualizează</span>
        </button>
      </header>

      <div className="p-4 sm:p-8 overflow-y-auto flex-1 space-y-6">
        {/* Market Sentiment Overview Card */}
        <div className="bg-gradient-to-r from-zinc-900/80 via-zinc-900/40 to-zinc-900/80 border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">Barometru Sentiment Piață (24h Flux)</h2>
              </div>
              <p className="text-xs text-zinc-400">
                Calculat automat din analiza titlurilor și articolelor recente din piața crypto.
              </p>
            </div>

            <div className="flex items-center gap-6 font-mono text-xs">
              <div className="text-center">
                <p className="text-[10px] text-zinc-500 uppercase">Bullish</p>
                <p className="text-base font-bold text-emerald-400 flex items-center gap-1 justify-center">
                  <TrendingUp className="w-4 h-4" /> {bullishCount} ({bullishPercent}%)
                </p>
              </div>
              <div className="text-center border-x border-white/10 px-6">
                <p className="text-[10px] text-zinc-500 uppercase">Neutral</p>
                <p className="text-base font-bold text-zinc-300 flex items-center gap-1 justify-center">
                  <Minus className="w-4 h-4" /> {neutralCount}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-zinc-500 uppercase">Bearish</p>
                <p className="text-base font-bold text-rose-400 flex items-center gap-1 justify-center">
                  <TrendingDown className="w-4 h-4" /> {bearishCount}
                </p>
              </div>
            </div>
          </div>

          {/* Sentiment Progress Visual Bar */}
          <div className="mt-4 h-2 bg-zinc-800 rounded-full overflow-hidden flex">
            <div style={{ width: `${(bullishCount/totalArticles)*100}%` }} className="bg-emerald-500 h-full transition-all duration-500"></div>
            <div style={{ width: `${(neutralCount/totalArticles)*100}%` }} className="bg-zinc-500 h-full transition-all duration-500"></div>
            <div style={{ width: `${(bearishCount/totalArticles)*100}%` }} className="bg-rose-500 h-full transition-all duration-500"></div>
          </div>
        </div>

        {/* Filters and Search controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 font-mono text-xs">
            {[
              { id: 'all', label: 'Toate Știrile' },
              { id: 'binance', label: 'Binance & Listări' },
              { id: 'btc', label: 'Bitcoin (BTC)' },
              { id: 'bullish', label: '🟢 Bullish' },
              { id: 'bearish', label: '🔴 Bearish' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap",
                  selectedCategory === tab.id
                    ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 font-semibold"
                    : "bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
            <input 
              type="text"
              placeholder="Căutare știri, monede (BTC, BNB...)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Articles List */}
        {loading && articles.length === 0 ? (
          <div className="py-20 text-center text-zinc-500 space-y-3 font-mono text-xs">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-500/60" />
            <p>Se încarcă fluxul de știri în timp real de pe Binance & Crypto API...</p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl text-zinc-500 font-mono text-xs">
            Nicio știre găsită pentru criteriile selectate. Încearcă o altă căutare.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredArticles.map(article => (
              <div 
                key={article.id} 
                className="bg-zinc-900/40 border border-white/5 hover:border-white/15 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all hover:bg-zinc-900/60 group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                      <span className="font-semibold text-emerald-400/90">{article.source}</span>
                      <span>•</span>
                      <span>{formatRelativeTime(article.publishedAt)}</span>
                    </div>

                    <span className={cn(
                      "px-2 py-0.5 text-[10px] font-mono font-bold rounded-md uppercase border flex items-center gap-1",
                      article.sentiment === 'bullish' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                      article.sentiment === 'bearish' && "bg-rose-500/10 text-rose-400 border-rose-500/30",
                      article.sentiment === 'neutral' && "bg-zinc-800 text-zinc-400 border-zinc-700"
                    )}>
                      {article.sentiment === 'bullish' && <TrendingUp className="w-3 h-3" />}
                      {article.sentiment === 'bearish' && <TrendingDown className="w-3 h-3" />}
                      {article.sentiment === 'neutral' && <Minus className="w-3 h-3" />}
                      {article.sentiment}
                    </span>
                  </div>

                  <a 
                    href={article.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-serif text-base font-semibold text-white group-hover:text-emerald-400 transition-colors line-clamp-2 block"
                  >
                    {article.title}
                  </a>

                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                    {article.summary}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {article.relatedSymbols?.map((sym) => (
                      <span key={sym} className="px-2 py-0.5 bg-black border border-white/10 rounded font-mono text-[10px] text-zinc-300">
                        {sym}
                      </span>
                    ))}
                    {article.categories.slice(0, 2).map((cat, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 text-[10px] text-zinc-500 font-mono">
                        #{cat.trim()}
                      </span>
                    ))}
                  </div>

                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-mono"
                  >
                    <span>Citește</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
