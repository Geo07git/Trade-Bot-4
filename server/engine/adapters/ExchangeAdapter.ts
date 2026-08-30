export interface Order {
  id: string;
  clientOrderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  status: 'CREATED' | 'SUBMITTED' | 'ACKNOWLEDGED' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCEL_REQUESTED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';
  price?: number;
  quantity: number;
  filledQuantity: number;
}

export interface ExchangeAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  submitOrder(order: Order): Promise<Order>;
  cancelOrder(clientOrderId: string, symbol: string): Promise<boolean>;
  getOpenOrders(symbol?: string): Promise<Order[]>;
  getBalance(): Promise<Record<string, number>>;
  getPositions(): Promise<any[]>;
}
