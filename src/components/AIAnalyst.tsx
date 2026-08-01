import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Bot, User, Loader2, Gauge } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTradingStore } from '../store';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import Markdown from 'react-markdown';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  role: 'ai' | 'user';
  content: string;
}

const GAUGE_COLORS = ['#f43f5e', '#f59e0b', '#10b981']; // Red, Yellow, Green

export function AIAnalyst() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: 'System online. I am connected to the current market data stream. What asset or strategy would you like to analyze?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  
  const watchlist = useTradingStore(state => state.watchlist);

  // Calculate dynamic sentiment score (-100 to 100)
  const sentimentScore = useMemo(() => {
    let score = 0;
    let activeItems = 0;
    watchlist.forEach(item => {
      if (item.active && item.signal) {
        activeItems++;
        if (item.signal.action === 'BUY') score += 100;
        if (item.signal.action === 'SELL') score -= 100;
      }
    });
    return activeItems > 0 ? Math.round(score / activeItems) : 0;
  }, [watchlist]);

  // Convert -100...100 score to a 0...180 degree angle for the needle
  // Score -100 -> angle 0 (left)
  // Score 0 -> angle 90 (top)
  // Score 100 -> angle 180 (right)
  const needleAngle = useMemo(() => {
    // Map -100,100 to 180,0 (Recharts Pie uses 180 as start angle, 0 as end angle)
    return 180 - ((sentimentScore + 100) / 200) * 180;
  }, [sentimentScore]);

  // Determine sentiment label
  const sentimentLabel = useMemo(() => {
    if (sentimentScore <= -50) return { text: 'Extrem Frică', color: 'text-rose-400' };
    if (sentimentScore < 0) return { text: 'Frică', color: 'text-rose-300' };
    if (sentimentScore === 0) return { text: 'Neutru', color: 'text-zinc-400' };
    if (sentimentScore < 50) return { text: 'Lăcomie', color: 'text-emerald-300' };
    return { text: 'Extrem Lăcomie', color: 'text-emerald-400' };
  }, [sentimentScore]);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      // Build real market context from local state
      const state = useTradingStore.getState();
      const equity = state.balance + state.positions.reduce((acc, pos) => acc + (pos.amount * (pos.currentPrice || pos.entryPrice)), 0);
      const activeWatchlist = state.watchlist.filter(w => w.active).map(w => `${w.symbol}: $${w.price || 'Unknown'} (Signal: ${w.signal?.action || 'None'})`);
      const portfolio = state.positions.map(p => `${p.amount} ${p.symbol} @ $${p.entryPrice} (Current: $${p.currentPrice})`);
      
      const context = `
Current Portfolio Equity: $${equity.toFixed(2)}
Cash Balance: $${state.balance.toFixed(2)}
Current Sentiment: ${sentimentLabel.text} (Score: ${sentimentScore})
Active Watchlist & Prices:
${activeWatchlist.join('\n') || 'None'}

Current Open Positions:
${portfolio.join('\n') || 'None'}
`;
      
      const geminiApiKey = useTradingStore.getState().geminiApiKey;
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg, context, geminiApiKey })
      });

      const data = await res.json();
      
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'ai', content: data.result }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: `[ERROR]: ${data.error}` }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', content: `[SYSTEM FAILURE]: Could not reach analysis engine.` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const pieData = [
    { name: 'Bearish', value: 1 },
    { name: 'Neutral', value: 1 },
    { name: 'Bullish', value: 1 },
  ];

  return (
    <div className="flex flex-col xl:flex-row h-full bg-black overflow-y-auto xl:overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-white/5 order-2 xl:order-1 h-[600px] xl:h-full">
        <header className="h-16 md:h-20 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-zinc-900/10 backdrop-blur-md shrink-0 gap-2">
          <div>
            <h1 className="font-serif text-lg md:text-xl text-white">AI Analysis Engine</h1>
            <p className="text-[10px] uppercase text-zinc-500 tracking-wider mt-0.5">Analiză piață în timp real</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setInput('Generează un raport complet de analiză a pieței crypto și a semnalelor curente.');
              }}
              disabled={isLoading}
              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>▶️ Raport Piață</span>
            </button>
            <button
              onClick={() => {
                setInput('Analizează riscul și alocarea din portofoliul meu curent.');
              }}
              disabled={isLoading}
              className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>⚡ Analiză Portofoliu</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((msg, idx) => (
              <div key={idx} className={cn(
                "flex gap-3 md:gap-4",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}>
                <div className={cn(
                  "w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 border mt-1",
                  msg.role === 'ai' ? "bg-zinc-800/80 text-emerald-400 border-white/10" : "bg-white/5 text-zinc-300 border-transparent"
                )}>
                  {msg.role === 'ai' ? <Bot size={15} /> : <User size={15} />}
                </div>
                
                <div className={cn(
                  "px-4 py-3 md:px-5 md:py-4 rounded-2xl text-zinc-200 leading-relaxed font-sans text-xs md:text-sm max-w-[90%] md:max-w-[85%]",
                  msg.role === 'user' ? "bg-white/10" : "bg-zinc-900/50 border border-white/5 shadow-sm"
                )}>
                  {msg.role === 'ai' ? (
                    <div className="text-zinc-200">
                      <Markdown
                        components={{
                          h1: ({node, ...props}) => <h1 className="text-base font-bold mt-4 mb-2 text-emerald-400" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-sm font-bold mt-3 mb-2 text-zinc-100" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-xs font-bold mt-2 mb-1 text-zinc-300" {...props} />,
                          p: ({node, ...props}) => <p className="mb-2 leading-relaxed" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
                          li: ({node, ...props}) => <li className="pl-1" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                        }}
                      >
                        {msg.content}
                      </Markdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 md:gap-4">
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-zinc-800/80 text-emerald-400 border border-white/10 flex items-center justify-center shrink-0">
                  <Loader2 size={15} className="animate-spin" />
                </div>
                <div className="px-4 py-3 md:px-5 md:py-4 rounded-2xl bg-zinc-900/50 border border-white/5 shadow-sm text-zinc-400 font-sans text-xs md:text-sm flex items-center gap-2">
                  <span className="animate-pulse">Se procesează datele...</span>
                </div>
              </div>
            )}
            <div ref={endOfMessagesRef} />
          </div>
        </div>

        <div className="p-4 md:p-6 border-t border-white/5 shrink-0 bg-zinc-900/10 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Întreabă AI despre BTC, strategii sau semnale..."
              className="w-full bg-zinc-900/50 border border-white/10 rounded-full pl-5 pr-12 py-3 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 transition-all font-sans text-xs md:text-sm"
              disabled={isLoading}
            />
            <button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 disabled:hover:bg-white/10 transition-colors"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>

      {/* Sidebar for Sentiment Gauge */}
      <div className="w-full xl:w-80 shrink-0 bg-zinc-900/30 flex flex-col order-1 xl:order-2 border-b xl:border-b-0 xl:border-l border-white/5">
        <header className="h-14 md:h-20 border-b border-white/5 flex items-center px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
            <h2 className="font-serif text-sm md:text-lg text-white">Sentiment Market</h2>
          </div>
        </header>

        <div className="p-4 md:p-6 flex-1">
          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 md:p-6 flex flex-col items-center">
            <h3 className="text-[10px] uppercase text-zinc-500 tracking-wider mb-2 md:mb-4">Sentiment Score</h3>
            
            <div className="w-full max-w-[240px] h-28 md:h-36 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="100%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={GAUGE_COLORS[index % GAUGE_COLORS.length]} fillOpacity={0.8} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Custom Needle */}
              <div 
                className="absolute bottom-0 left-1/2 w-1 bg-zinc-200 rounded-full origin-bottom z-10 transition-transform duration-1000 ease-out shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                style={{ 
                  height: '60px', 
                  transform: `translateX(-50%) rotate(${needleAngle - 90}deg)`,
                  transformOrigin: 'bottom center'
                }}
              >
                <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full"></div>
              </div>
            </div>

            <div className="text-center mt-3 md:mt-4">
              <div className="text-2xl md:text-3xl font-serif text-white mb-0.5">
                {sentimentScore}
              </div>
              <div className={cn("text-xs md:text-sm font-medium", sentimentLabel.color)}>
                {sentimentLabel.text}
              </div>
            </div>
            
            <p className="text-[10px] md:text-xs text-zinc-500 text-center mt-3">
              Calculat pe baza semnalelor active din lista de urmărire.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
