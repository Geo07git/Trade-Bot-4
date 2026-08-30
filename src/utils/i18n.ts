export type Language = 'en' | 'ro';

export interface Translations {
  // Navigation & Headers
  terminalTitle: string;
  terminalSub: string;
  bloombergView: string;
  overviewView: string;
  strategyView: string;
  auditView: string;
  momentumView: string;
  backtestView: string;
  journalView: string;
  logsView: string;
  settingsView: string;

  // Status & Controls
  liveParity: string;
  desyncLock: string;
  emergencyKill: string;
  autoTradingOn: string;
  autoTradingOff: string;
  hardReset: string;
  quickMatrix: string;
  connected: string;
  disconnected: string;
  paperMode: string;
  liveMode: string;
  testnetMode: string;
  tradingActive: string;
  tradingHalted: string;

  // Bloomberg Terminal Command Bar
  commandPromptPlaceholder: string;
  cmdHelp: string;
  cmdGo: string;
  cmdTop: string;
  cmdPort: string;
  cmdMatrix: string;
  cmdScalp: string;
  cmdAudit: string;
  cmdNews: string;
  cmdReset: string;
  cmdKill: string;
  funcKeysLabel: string;

  // Metrics & Headers
  totalBalance: string;
  unrealizedPnl: string;
  realizedPnl: string;
  winRate: string;
  profitFactor: string;
  maxDrawdown: string;
  activePositions: string;
  totalVolume: string;
  systemParity: string;
  engineState: string;
  driftDelta: string;
  reconcileNow: string;
  reconciling: string;
  unlockDesync: string;

  // Table Headers
  symbol: string;
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
  spread: string;
  change24h: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  mlProb: string;
  metaScore: string;
  pattern: string;
  actionSignal: string;
  side: string;
  amount: string;
  entryPrice: string;
  markPrice: string;
  takeProfit: string;
  stopLoss: string;
  duration: string;
  actions: string;
  closePosition: string;
  buy: string;
  sell: string;
  hold: string;

  // Tabs & Panels
  marketMatrix: string;
  positionBlotter: string;
  technicalChart: string;
  intelligenceFeed: string;
  orderAudit: string;
  riskParameters: string;
  scalpingEngine: string;
  executionLogs: string;

  // Logs & Messages
  noOpenPositions: string;
  noActiveSignals: string;
  noAuditEvents: string;
  reconciliationSuccess: string;
  reconciliationDesync: string;
  killSwitchEngaged: string;
  desyncUnlocked: string;
  serverSyncActive: string;
  languageSelect: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    terminalTitle: 'TradeBot Terminal',
    terminalSub: 'Quantitative Execution & Parity System',
    bloombergView: '⚡ Matrix Terminal',
    overviewView: '📊 Terminal Overview',
    strategyView: '⚙️ Strategy Engine',
    auditView: '🛡️ Audit & Parity',
    momentumView: '🚀 Momentum Simulator',
    backtestView: '📈 Momentum Backtest',
    journalView: '📓 Trading Journal',
    logsView: '🖥️ System Logs',
    settingsView: '🔧 Settings & Keys',

    liveParity: 'PARITY SYNCED',
    desyncLock: 'DESYNC LOCKED',
    emergencyKill: 'KILL SWITCH ENGAGED',
    autoTradingOn: '24/7 ACTIVE',
    autoTradingOff: '24/7 HALTED',
    hardReset: 'Reset Store',
    quickMatrix: '⚡ Matrix',
    connected: 'CONNECTED',
    disconnected: 'DISCONNECTED',
    paperMode: 'PAPER TRADING',
    liveMode: 'LIVE TRADING',
    testnetMode: 'TESTNET',
    tradingActive: 'TRADING ACTIVE',
    tradingHalted: 'TRADING HALTED',

    commandPromptPlaceholder: 'Type command or symbol (e.g. BTC, PORT <GO>, SCALP <GO>, TOP <GO>, HELP)...',
    cmdHelp: '<HELP>',
    cmdGo: '<GO>',
    cmdTop: 'TOP <GO>',
    cmdPort: 'PORT <GO>',
    cmdMatrix: 'MATRIX <GO>',
    cmdScalp: 'SCALP <GO>',
    cmdAudit: 'AUDIT <GO>',
    cmdNews: 'NEWS <GO>',
    cmdReset: 'RESET <GO>',
    cmdKill: 'KILL <GO>',
    funcKeysLabel: 'TERMINAL FUNCTION KEYS',

    totalBalance: 'Total Balance',
    unrealizedPnl: 'Unrealized PnL',
    realizedPnl: 'Realized PnL',
    winRate: 'Win Rate',
    profitFactor: 'Profit Factor',
    maxDrawdown: 'Max Drawdown',
    activePositions: 'Active Positions',
    totalVolume: '24h Volume',
    systemParity: 'Parity Drift',
    engineState: 'Engine State',
    driftDelta: 'Drift Delta',
    reconcileNow: 'Reconcile Parity',
    reconciling: 'Reconciling...',
    unlockDesync: 'Unlock Desync',

    symbol: 'Symbol',
    lastPrice: 'Last Price',
    bidPrice: 'Bid',
    askPrice: 'Ask',
    spread: 'Spread (bps)',
    change24h: '24h Chg%',
    high24h: '24h High',
    low24h: '24h Low',
    volume24h: '24h Volume',
    mlProb: 'ML Prob%',
    metaScore: 'Meta Score',
    pattern: 'Pattern / Setup',
    actionSignal: 'Signal',
    side: 'Side',
    amount: 'Qty',
    entryPrice: 'Entry Price',
    markPrice: 'Mark Price',
    takeProfit: 'Take Profit',
    stopLoss: 'Stop Loss',
    duration: 'Hold Time',
    actions: 'Action',
    closePosition: 'Close Position',
    buy: 'BUY',
    sell: 'SELL',
    hold: 'HOLD',

    marketMatrix: 'MARKET DEPTH & WATCHLIST MATRIX',
    positionBlotter: 'REAL-TIME POSITION BLOTTER & PnL',
    technicalChart: 'PRICE ACTION & VOLATILITY TAPE',
    intelligenceFeed: 'MARKET INTELLIGENCE & ML SIGNALS',
    orderAudit: 'AUDIT TRAIL & SYSTEM DISCREPANCY LOG',
    riskParameters: 'RISK CONTROL & ENGINE CONFIGURATION',
    scalpingEngine: 'AUTONOMOUS SCALPING ENGINE',
    executionLogs: 'EXECUTION SYSTEM LOGS',

    noOpenPositions: 'No active open positions. Engine monitoring market order book.',
    noActiveSignals: 'Awaiting high-probability ML opportunity triggers.',
    noAuditEvents: 'No critical audit events recorded.',
    reconciliationSuccess: 'Ledger and exchange state are fully reconciled (0.00 USDT drift).',
    reconciliationDesync: 'Balance drift exceeds threshold (>5.0 USDT). Engine locked.',
    killSwitchEngaged: 'Emergency Kill Switch engaged. All active executions stopped.',
    desyncUnlocked: 'Desync lock released. Trading state active.',
    serverSyncActive: 'Server State Synchronized',
    languageSelect: 'Language'
  },
  ro: {
    terminalTitle: 'Terminal TradeBot',
    terminalSub: 'Sistem de Execuție Cantitativă și Paritate',
    bloombergView: '⚡ Terminal Matrix',
    overviewView: '📊 Prezentare Generală',
    strategyView: '⚙️ Motor Strategie',
    auditView: '🛡️ Audit & Paritate',
    momentumView: '🚀 Simulator Momentum',
    backtestView: '📈 Backtest Momentum',
    journalView: '📓 Jurnal Tranzacții',
    logsView: '🖥️ Jurnale Sistem',
    settingsView: '🔧 Setări & Chei API',

    liveParity: 'PARITATE SINCRONIZATĂ',
    desyncLock: 'BLOCARE DESINCRONIZARE',
    emergencyKill: 'OPRIRE DE URGENȚĂ ACTIVATĂ',
    autoTradingOn: '24/7 ACTIV',
    autoTradingOff: '24/7 OPRIT',
    hardReset: 'Resetare Magazin',
    quickMatrix: '⚡ Matrix',
    connected: 'CONECTAT',
    disconnected: 'DECONECTAT',
    paperMode: 'SIMULARE PAPER',
    liveMode: 'TRANZACȚIONARE LIVE',
    testnetMode: 'TESTNET',
    tradingActive: 'TRANZACȚIONARE ACTIVĂ',
    tradingHalted: 'TRANZACȚIONARE OPRITĂ',

    commandPromptPlaceholder: 'Introduceți comanda sau simbolul (ex: BTC, PORT <GO>, SCALP <GO>, TOP <GO>, HELP)...',
    cmdHelp: '<AJUTOR>',
    cmdGo: '<EXEC>',
    cmdTop: 'TOP <EXEC>',
    cmdPort: 'PORT <EXEC>',
    cmdMatrix: 'MATRIX <EXEC>',
    cmdScalp: 'SCALP <EXEC>',
    cmdAudit: 'AUDIT <EXEC>',
    cmdNews: 'ȘTIRI <EXEC>',
    cmdReset: 'RESET <EXEC>',
    cmdKill: 'OPRIRE <EXEC>',
    funcKeysLabel: 'TASTE FUNCȚIONALE TERMINAL',

    totalBalance: 'Sold Total',
    unrealizedPnl: 'PnL Nerealizat',
    realizedPnl: 'PnL Realizat',
    winRate: 'Rată Câștig',
    profitFactor: 'Factor Profit',
    maxDrawdown: 'Drawdown Maxim',
    activePositions: 'Poziții Active',
    totalVolume: 'Volum 24h',
    systemParity: 'Deviație Paritate',
    engineState: 'Stare Motor',
    driftDelta: 'Deviație Sold',
    reconcileNow: 'Reconciliere Paritate',
    reconciling: 'Reconciliere în curs...',
    unlockDesync: 'Deblocare Desincronizare',

    symbol: 'Simbol',
    lastPrice: 'Ultimul Preț',
    bidPrice: 'Cumpărare (Bid)',
    askPrice: 'Vânzare (Ask)',
    spread: 'Spread (bps)',
    change24h: 'Variație 24h',
    high24h: 'Maxim 24h',
    low24h: 'Minim 24h',
    volume24h: 'Volum 24h',
    mlProb: 'Probabilitate ML',
    metaScore: 'Scor Meta',
    pattern: 'Tipar / Setup',
    actionSignal: 'Semnal',
    side: 'Direcție',
    amount: 'Cantitate',
    entryPrice: 'Preț Intrare',
    markPrice: 'Preț Curent',
    takeProfit: 'Take Profit',
    stopLoss: 'Stop Loss',
    duration: 'Timp Menținere',
    actions: 'Acțiune',
    closePosition: 'Închide Poziția',
    buy: 'CUMPĂRĂ',
    sell: 'VINDE',
    hold: 'AȘTEAPTĂ',

    marketMatrix: 'MATRICE ADÂNCIME PIAȚĂ & LISTĂ URMĂRIRE',
    positionBlotter: 'BLOTTER POZIȚII & PnL ÎN TIMP REAL',
    technicalChart: 'EVOLUȚIE PREȚ & BANDĂ VOLATILITATE',
    intelligenceFeed: 'INTELLIGENCE PIAȚĂ & SEMNALE ML',
    orderAudit: 'PISTĂ AUDIT & JURNAL DISCREPANȚE SISTEM',
    riskParameters: 'CONTROL RISC & CONFIGURARE MOTOR',
    scalpingEngine: 'MOTOR AUTONOM DE SCALPING',
    executionLogs: 'JURNALE SISTEM DE EXECUȚIE',

    noOpenPositions: 'Nicio poziție deschisă. Motorul monitorizează carnetul de ordine.',
    noActiveSignals: 'Se așteaptă declanșarea oportunităților ML cu probabilitate ridicată.',
    noAuditEvents: 'Niciun eveniment critic de audit înregistrat.',
    reconciliationSuccess: 'Registrul intern și bursa sunt sincronizate complet (0.00 USDT deviație).',
    reconciliationDesync: 'Deviația de sold depășește pragul (>5.0 USDT). Motor blocat din siguranță.',
    killSwitchEngaged: 'Oprirea de Urgență activată. Toate tranzacțiile au fost sistate.',
    desyncUnlocked: 'Blocarea de desincronizare a fost eliberată. Tranzacționarea este activă.',
    serverSyncActive: 'Stare Server Sincronizată',
    languageSelect: 'Limbă'
  }
};

export function getTranslation(lang: Language = 'en'): Translations {
  return translations[lang] || translations.en;
}
