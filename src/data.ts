import { Position, TradeLog } from './types';

export const initialPositions: Position[] = [
  { id: '1', symbol: 'NVDA', amount: 50, shares: 50, entryPrice: 105.20, currentPrice: 118.45, pnl: 662.50, pnlPercent: 12.59 },
  { id: '2', symbol: 'TSLA', amount: 120, shares: 120, entryPrice: 245.10, currentPrice: 232.80, pnl: -1476.00, pnlPercent: -5.01 },
  { id: '3', symbol: 'AAPL', amount: 200, shares: 200, entryPrice: 178.50, currentPrice: 185.20, pnl: 1340.00, pnlPercent: 3.75 },
];

export const initialLogs: TradeLog[] = [
  { id: '101', timestamp: '2024-05-12T09:30:00Z', type: 'BUY', symbol: 'NVDA', shares: 50, price: 105.20, reason: 'AI Signal: MACD crossover and high volume detected.' },
  { id: '102', timestamp: '2024-05-14T14:15:00Z', type: 'SELL', symbol: 'MSFT', shares: 30, price: 412.10, reason: 'Risk Management: Hit trailing stop loss of 2%.' },
  { id: '103', timestamp: '2024-05-15T10:05:00Z', type: 'BUY', symbol: 'TSLA', shares: 120, price: 245.10, reason: 'AI Signal: Oversold RSI with bullish divergence.' },
];

export const mockChartData = Array.from({ length: 30 }).map((_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (30 - i));
  return {
    time: date.toISOString().split('T')[0],
    equity: 100000 + (Math.sin(i / 3) * 5000) + (i * 200) + Math.random() * 1000,
  };
});
