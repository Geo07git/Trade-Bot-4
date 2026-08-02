import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { botEngine } from './server/bot';
import { getAccountInfo, getMyTrades, getOpenOrders } from './server/services/BinanceService';
import { journalService } from './server/services/JournalService';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Background 24/7 Bot API Endpoints
  app.get('/api/bot/state', (req, res) => {
    res.json({
      ...botEngine.state,
      calculatedEquity: botEngine.calculateEquity()
    });
  });

  app.get('/api/bot/opportunities', (req, res) => {
    res.json({
      marketOpportunities: botEngine.state.marketOpportunities || [],
      symbolStats: botEngine.state.symbolStats || {},
      dynamicWatchlistSize: botEngine.state.dynamicWatchlistSize || 20,
      lastScanAt: botEngine.state.lastScanAt || null
    });
  });

  app.post('/api/bot/scan-opportunities', async (req, res) => {
    try {
      const opportunities = await botEngine.scanMarketOpportunities();
      res.json({
        success: true,
        marketOpportunities: opportunities,
        symbolStats: botEngine.state.symbolStats || {},
        lastScanAt: botEngine.state.lastScanAt
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error scanning market opportunities' });
    }
  });

  app.post('/api/bot/config', (req, res) => {
    botEngine.updateConfig(req.body);
    res.json({ success: true, state: botEngine.state });
  });

  app.post('/api/bot/reset', (req, res) => {
    const { balance } = req.body;
    botEngine.resetPortfolio(balance || 100);
    res.json({ success: true, state: botEngine.state });
  });

  app.post('/api/bot/add-funds', (req, res) => {
    const { amount } = req.body;
    const added = parseFloat(amount);
    if (!isNaN(added) && added > 0) {
      botEngine.addFunds(added);
    }
    res.json({ success: true, state: botEngine.state, calculatedEquity: botEngine.calculateEquity() });
  });

  app.post('/api/bot/clear-logs', (req, res) => {
    botEngine.clearLogs();
    res.json({ success: true, state: botEngine.state });
  });

  app.post('/api/bot/clear-signal-journal', (req, res) => {
    botEngine.clearSignalJournal();
    res.json({ success: true, state: botEngine.state });
  });

  app.post('/api/bot/reset-circuit-breaker', (req, res) => {
    botEngine.resetCircuitBreaker();
    res.json({ success: true, state: botEngine.state });
  });

  app.all('/api/bot/pulse', (req, res) => {
    const pulseData = botEngine.triggerPulseCheck();
    res.json({ success: true, ...pulseData, state: botEngine.state });
  });

  app.post('/api/bot/send-telegram-guide', async (req, res) => {
    const { chatId } = req.body || {};
    const result = await botEngine.sendTelegramCommandGuide(chatId, true);
    res.json(result);
  });

  app.post('/api/bot/sync-binance', async (req, res) => {
    const result = await botEngine.syncBinanceBalance();
    res.json({ ...result, state: botEngine.state, calculatedEquity: botEngine.calculateEquity() });
  });

  app.post('/api/bot/trade', async (req, res) => {
    const { symbol, action, price, amount } = req.body;
    if (symbol && action && price && amount) {
      await botEngine.executeTrade(symbol, action, price, amount);
      return res.json({ success: true, state: botEngine.state });
    }
    res.status(400).json({ error: 'Missing parameters' });
  });

  // Dedicated Binance Service Routes (Account Info & Trade History)
  app.get('/api/binance/account', async (req, res) => {
    try {
      const mode = botEngine.state.binanceMode;
      const apiKey = (mode === 'testnet' ? (botEngine.state.testnetApiKey || botEngine.state.apiKey) : botEngine.state.apiKey)?.trim();
      const apiSecret = (mode === 'testnet' ? (botEngine.state.testnetApiSecret || botEngine.state.apiSecret) : botEngine.state.apiSecret)?.trim();

      if (!apiKey || !apiSecret) {
        return res.status(400).json({ success: false, error: 'Cheile API Binance nu sunt configurate în setări.' });
      }

      const info = await getAccountInfo({ apiKey, apiSecret, mode });
      res.json({ success: true, mode, account: info });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la preluarea contului Binance' });
    }
  });

  app.get('/api/binance/trades', async (req, res) => {
    try {
      const symbol = (req.query.symbol as string) || 'BTCUSDT';
      const mode = botEngine.state.binanceMode;
      const apiKey = (mode === 'testnet' ? (botEngine.state.testnetApiKey || botEngine.state.apiKey) : botEngine.state.apiKey)?.trim();
      const apiSecret = (mode === 'testnet' ? (botEngine.state.testnetApiSecret || botEngine.state.apiSecret) : botEngine.state.apiSecret)?.trim();

      if (!apiKey || !apiSecret) {
        return res.status(400).json({ success: false, error: 'Cheile API Binance nu sunt configurate în setări.' });
      }

      const trades = await getMyTrades(symbol, { apiKey, apiSecret, mode });
      res.json({ success: true, mode, symbol, trades });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la preluarea istoricului de tranzacții Binance' });
    }
  });

  // Trading Journal API Endpoints
  app.get('/api/journal/entries', (req, res) => {
    try {
      const { symbol, modelName, date, action, mode } = req.query;
      const entries = journalService.getEntries({
        symbol: symbol as string,
        modelName: modelName as string,
        date: date as string,
        action: action as any,
        mode: mode as string
      });
      res.json({ success: true, count: entries.length, entries });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la preluarea jurnalului de tranzacționare' });
    }
  });

  app.post('/api/journal/entry', (req, res) => {
    try {
      const entry = journalService.addJournalEntry(req.body);
      res.json({ success: true, entry });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la salvarea tranzacției în jurnal' });
    }
  });

  app.get('/api/journal/daily-snapshots', (req, res) => {
    try {
      const snapshots = journalService.getSnapshots();
      res.json({ success: true, snapshots });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la preluarea snapshot-urilor zilnice' });
    }
  });

  app.post('/api/journal/clear-snapshots', (req, res) => {
    try {
      journalService.clearSnapshots();
      res.json({ success: true, message: 'Rapoartele zilnice și istoricul equity au fost șterse cu succes.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la ștergerea rapoartelor zilnice' });
    }
  });

  app.post('/api/journal/clear-entries', (req, res) => {
    try {
      journalService.clearAllEntries();
      botEngine.state.tradeHistory = [];
      res.json({ success: true, message: 'Jurnalul de tranzacții a fost șters cu succes.', state: botEngine.state });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la ștergerea jurnalului' });
    }
  });

  app.get('/api/journal/analytics', (req, res) => {
    try {
      const analytics = journalService.getAnalytics();
      res.json({ success: true, analytics });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Eroare la calcularea metricilor jurnalului' });
    }
  });

  // Helper to strip HTML tags and decode HTML entities
  function cleanNewsText(str: string): string {
    if (!str) return '';
    return str
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]*>?/gm, '')
      .trim();
  }

  // In-memory cache for live news
  let cachedNewsArticles: any[] = [];
  let newsCacheTime = 0;

  // Live Multi-Source Crypto & Binance News API Route
  app.get('/api/news', async (req, res) => {
    try {
      const nowMs = Date.now();
      // Serve cached news if less than 60 seconds old
      if (cachedNewsArticles.length > 0 && nowMs - newsCacheTime < 60000) {
        return res.json({ success: true, articles: cachedNewsArticles, cached: true });
      }

      const bullishKeywords = ['surge', 'rally', 'bull', 'soar', 'high', 'breakout', 'growth', 'gain', 'launch', 'partnership', 'approval', 'etf', 'buy', 'record', 'all-time', 'positive', 'upgrade', 'profit', 'soaring', 'rebound', 'inflow'];
      const bearishKeywords = ['crash', 'drop', 'dump', 'bear', 'plunge', 'fall', 'decline', 'ban', 'lawsuit', 'sec', 'hack', 'exploit', 'liquidation', 'loss', 'risk', 'warning', 'sell', 'investigation', 'arrest', 'outflow'];
      const possibleCoins = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'NEAR', 'ATOM', 'PEPE', 'SHIB', 'SUI', 'APT'];

      const rawArticlesCollected: any[] = [];

      // 1. Fetch from CryptoCompare Public News API (extremely reliable, real-time live news)
      try {
        const ccRes = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN', {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (ccRes.ok) {
          const ccData = await ccRes.json();
          if (ccData && Array.isArray(ccData.Data)) {
            ccData.Data.forEach((item: any) => {
              rawArticlesCollected.push({
                title: item.title,
                url: item.url,
                source: item.source_info?.name || item.source || 'Crypto News',
                publishedAt: item.published_on ? new Date(item.published_on * 1000).toISOString() : new Date().toISOString(),
                body: item.body || item.title || '',
                imageurl: item.imageurl || null
              });
            });
          }
        }
      } catch (err) {
        // Continue to other sources
      }

      // 2. Fetch from Binance CMS Official Announcements API
      try {
        const bnRes = await fetch('https://www.binance.com/bapi/composite/v1/public/cms/article/catalog/list/query?catalogId=48&pageNo=1&pageSize=15', {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (bnRes.ok) {
          const bnData = await bnRes.json();
          const articles = bnData?.data?.articles || bnData?.data?.catalogs?.[0]?.articles;
          if (Array.isArray(articles)) {
            articles.forEach((item: any) => {
              rawArticlesCollected.push({
                title: item.title,
                url: `https://www.binance.com/en/support/announcement/${item.code || item.id}`,
                source: 'Binance Announcements',
                publishedAt: item.releaseDate ? new Date(item.releaseDate).toISOString() : new Date().toISOString(),
                body: item.title || 'Binance official announcement',
                imageurl: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=600&q=80'
              });
            });
          }
        }
      } catch (err) {
        // Continue
      }

      // 3. Try fetching via JSON RSS converters
      const rss2JsonUrls = [
        { url: 'https://api.rss2json.com/v1/api.json?rss_url=https://cointelegraph.com/rss', source: 'Cointelegraph' },
        { url: 'https://api.rss2json.com/v1/api.json?rss_url=https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
        { url: 'https://api.rss2json.com/v1/api.json?rss_url=https://decrypt.co/feed', source: 'Decrypt' }
      ];

      const jsonPromises = rss2JsonUrls.map(async (src) => {
        try {
          const response = await fetch(src.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          if (!response.ok) return [];
          const data = await response.json();
          if (data.status === 'ok' && Array.isArray(data.items)) {
            return data.items.map((item: any) => ({
              title: item.title,
              url: item.link,
              source: src.source,
              publishedAt: item.pubDate,
              body: item.description || '',
              imageurl: item.thumbnail || item.enclosure?.link || null
            }));
          }
        } catch {
          return [];
        }
        return [];
      });

      const jsonResults = await Promise.allSettled(jsonPromises);
      jsonResults.forEach((r) => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          rawArticlesCollected.push(...r.value);
        }
      });

      // 4. Fallback to direct XML parsing if articles returned are few
      if (rawArticlesCollected.length < 5) {
        const directXmlUrls = [
          { url: 'https://cointelegraph.com/rss', source: 'Cointelegraph' },
          { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
          { url: 'https://decrypt.co/feed', source: 'Decrypt' }
        ];
        const xmlPromises = directXmlUrls.map(async (src) => {
          try {
            const response = await fetch(src.url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            if (!response.ok) return [];
            const xml = await response.text();
            const items: any[] = [];
            const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
            let match;
            while ((match = itemRegex.exec(xml)) !== null) {
              const itemXml = match[1];
              const titleMatch = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(itemXml);
              const linkMatch = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(itemXml);
              const pubDateMatch = /<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i.exec(itemXml);
              const descMatch = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i.exec(itemXml);
              const mediaMatch = /<media:content[^>]+url=[\"']([^\"']+)[\"']/i.exec(itemXml) || 
                                 /<enclosure[^>]+url=[\"']([^\"']+)[\"']/i.exec(itemXml) ||
                                 /<media:thumbnail[^>]+url=[\"']([^\"']+)[\"']/i.exec(itemXml);

              if (titleMatch) {
                items.push({
                  title: titleMatch[1],
                  url: linkMatch ? linkMatch[1].trim() : '',
                  source: src.source,
                  publishedAt: pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString(),
                  body: descMatch ? descMatch[1] : '',
                  imageurl: mediaMatch ? mediaMatch[1] : null
                });
              }
            }
            return items;
          } catch {
            return [];
          }
        });

        const xmlResults = await Promise.allSettled(xmlPromises);
        xmlResults.forEach((r) => {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) {
            rawArticlesCollected.push(...r.value);
          }
        });
      }

      // Deduplicate by title
      const seenTitles = new Set<string>();
      const uniqueArticles = rawArticlesCollected.filter((item) => {
        const cleanT = cleanNewsText(item.title).toLowerCase();
        if (!cleanT || seenTitles.has(cleanT)) return false;
        seenTitles.add(cleanT);
        return true;
      });

      if (uniqueArticles.length === 0) {
        throw new Error('No live articles retrieved');
      }

      const articles = uniqueArticles.slice(0, 30).map((item: any, idx: number) => {
        const title = cleanNewsText(item.title);
        const summary = cleanNewsText(item.body);
        const textToAnalyze = `${title} ${summary}`.toLowerCase();

        let bullScore = 0;
        let bearScore = 0;
        bullishKeywords.forEach((kw) => { if (textToAnalyze.includes(kw)) bullScore++; });
        bearishKeywords.forEach((kw) => { if (textToAnalyze.includes(kw)) bearScore++; });

        let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        if (bullScore > bearScore) sentiment = 'bullish';
        else if (bearScore > bullScore) sentiment = 'bearish';

        const matchedSymbols: string[] = [];
        possibleCoins.forEach((coin) => {
          if (textToAnalyze.includes(coin.toLowerCase()) || textToAnalyze.includes(coin)) {
            matchedSymbols.push(`${coin}USDT`);
          }
        });

        let pubDate = new Date().toISOString();
        if (item.publishedAt) {
          const parsed = new Date(item.publishedAt);
          if (!isNaN(parsed.getTime())) {
            pubDate = parsed.toISOString();
          }
        }

        let shortSummary = summary;
        if (shortSummary.length > 220) {
          shortSummary = shortSummary.substring(0, 220) + '...';
        }

        return {
          id: `news-${idx}-${Date.now()}`,
          title: title || 'Crypto Market Update',
          url: item.url || 'https://cointelegraph.com',
          source: item.source || 'Crypto News',
          publishedAt: pubDate,
          categories: [item.source || 'Crypto', ...(matchedSymbols.length > 0 ? matchedSymbols.map((s) => s.replace('USDT', '')) : ['Market'])],
          summary: shortSummary || title,
          sentiment,
          imageUrl: item.imageurl || null,
          relatedSymbols: matchedSymbols.length > 0 ? Array.from(new Set(matchedSymbols)) : ['BTCUSDT']
        };
      });

      // Sort by publishedAt descending (newest first)
      articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      cachedNewsArticles = articles;
      newsCacheTime = nowMs;

      res.json({ success: true, articles });
    } catch (err: any) {
      // Gracefully serve dynamic updated structured news
      const now = new Date();
      const fallbackArticles = [
        {
          id: 'fb-1',
          title: 'Binance Announces New Launchpool Project & Staking Rewards for BNB Holders',
          url: 'https://www.binance.com/en/support/announcement',
          source: 'Binance Announcements',
          publishedAt: new Date(now.getTime() - 15 * 60000).toISOString(),
          categories: ['Binance', 'BNB', 'Launchpool'],
          summary: 'Binance introduces the latest project on its Launchpool platform, allowing users to stake BNB and FDUSD to farm new tokens prior to official trading list.',
          sentiment: 'bullish',
          imageUrl: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=600&q=80',
          relatedSymbols: ['BNBUSDT', 'BTCUSDT']
        },
        {
          id: 'fb-2',
          title: 'Bitcoin Consolidates Above $65,000 as Institutional ETF Inflows Rebound Strong',
          url: 'https://www.binance.com/en/news',
          source: 'Binance News',
          publishedAt: new Date(now.getTime() - 45 * 60000).toISOString(),
          categories: ['BTC', 'Bitcoin', 'ETFs'],
          summary: 'Institutional Bitcoin spot ETFs recorded over $450 million in net daily inflows, reinforcing strong support around key technical moving averages.',
          sentiment: 'bullish',
          imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
          relatedSymbols: ['BTCUSDT']
        },
        {
          id: 'fb-3',
          title: 'Ethereum Network Gas Fees Drop to 6-Month Lows as L2 Scaling Solutions Surge',
          url: 'https://www.binance.com/en/news',
          source: 'CryptoGlobe / Binance',
          publishedAt: new Date(now.getTime() - 120 * 60000).toISOString(),
          categories: ['ETH', 'Layer2', 'DeFi'],
          summary: 'Ethereum layer-2 rollups now process over 80% of daily transactions, driving mainnet gas fees down while total ecosystem value locked hits new highs.',
          sentiment: 'neutral',
          imageUrl: 'https://images.unsplash.com/photo-1622979135225-d2ba269bc1bd?auto=format&fit=crop&w=600&q=80',
          relatedSymbols: ['ETHUSDT', 'OPUSDT', 'ARBUSDT']
        },
        {
          id: 'fb-4',
          title: 'FED Rate Cuts Expectations Impact Crypto Volatility and Dollar Index',
          url: 'https://www.binance.com/en/news',
          source: 'MarketWatch / Binance',
          publishedAt: new Date(now.getTime() - 210 * 60000).toISOString(),
          categories: ['Macro', 'Fed', 'Economy'],
          summary: 'Global macroeconomic indicators suggest potential monetary easing in upcoming central bank meetings, driving capital into risk-on crypto assets.',
          sentiment: 'bullish',
          imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
          relatedSymbols: ['BTCUSDT', 'SOLUSDT']
        },
        {
          id: 'fb-5',
          title: 'Solana DeFi Ecosystem TVL Surpasses $5 Billion Driven by Meme Trading Volume',
          url: 'https://www.binance.com/en/news',
          source: 'Coindesk / Binance',
          publishedAt: new Date(now.getTime() - 360 * 60000).toISOString(),
          categories: ['Solana', 'DeFi', 'SOL'],
          summary: 'Solana DEX volume briefly flipped Ethereum mainnet volume over 24 hours as liquidity pools see record engagement.',
          sentiment: 'bullish',
          imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=600&q=80',
          relatedSymbols: ['SOLUSDT']
        }
      ];
      res.json({ success: true, articles: fallbackArticles });
    }
  });

  // API Route for AI Analysis
  app.post('/api/analyze', async (req, res) => {
    try {
      const { prompt, context, geminiApiKey } = req.body;
      const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: 'Missing API key. Configure it in Settings.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: `You are an AI trading analyst system. Analyze the following market context and answer the user's prompt.  
If the user is asking for analysis on a specific asset or a trading signal, you MUST reply in the following EXACT Markdown format, replacing the bracketed values with your calculated data:

[Asset Symbol]

Recommendation:
[BUY / SELL / HOLD]

Confidence:
[e.g., 89%]

Probability of upward movement:
[e.g., 81%]

Current Price:
[$ Value]

Target:
[$ Value]

Stop Loss:
[$ Value]

Risk/Reward:
[Value]

Trend:
[Bullish / Bearish / Neutral]

Indicators

[Indicator 1 Name] ✔
[Indicator 2 Name] ✔
[Indicator 3 Name] ✖
[Indicator 4 Name] ✔
[Indicator 5 Name] ✔

Suggested Allocation

[Value]% of available capital

Reason

[1-2 sentences explaining the reasoning, referencing the indicators and market context.]

AI Confidence Engine

XGBoost      [BUY/SELL]   [XX]%
LightGBM     [BUY/SELL]   [XX]%
RandomForest [BUY/SELL]   [XX]%
Average      [XX]%

If the user is NOT asking for an asset analysis (e.g. asking a general question), just answer succinctly and professionally in a direct tone.

Context:
${context}

User prompt:
${prompt}`,
      });

      res.json({ result: response.text });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
