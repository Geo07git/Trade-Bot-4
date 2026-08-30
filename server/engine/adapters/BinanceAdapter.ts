import { ExchangeAdapter, Order } from './ExchangeAdapter';
import Binance from 'binance-api-node';

export class BinanceAdapter implements ExchangeAdapter {
  private client: any;

  constructor(apiKey?: string, apiSecret?: string, httpBase?: string) {
    const binanceFactory = typeof Binance === 'function' ? Binance : (Binance as any)?.default;
    this.client = binanceFactory({ apiKey, apiSecret, httpBase });
  }

  async connect(): Promise<void> {
    // Ping to check connection
    await this.client.ping();
  }

  async disconnect(): Promise<void> {
    // No explicit disconnect for REST
  }

  async submitOrder(order: Order): Promise<Order> {
    // Submit to Binance
    const res = await this.client.order({
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      price: order.price,
      newClientOrderId: order.clientOrderId
    });

    return {
      ...order,
      id: res.orderId.toString(),
      status: 'FILLED', // Simplified
      filledQuantity: parseFloat(res.executedQty)
    };
  }

  async cancelOrder(clientOrderId: string, symbol: string): Promise<boolean> {
    await this.client.cancelOrder({
      symbol,
      origClientOrderId: clientOrderId
    });
    return true;
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const raw = await this.client.openOrders({ symbol });
    return raw.map((o: any) => ({
      id: o.orderId.toString(),
      clientOrderId: o.clientOrderId,
      symbol: o.symbol,
      side: o.side as any,
      type: o.type as any,
      status: 'SUBMITTED',
      quantity: parseFloat(o.origQty),
      filledQuantity: parseFloat(o.executedQty)
    }));
  }

  async getBalance(): Promise<Record<string, number>> {
    const account = await this.client.accountInfo();
    const balances: Record<string, number> = {};
    for (const b of account.balances) {
      const free = parseFloat(b.free);
      if (free > 0) balances[b.asset] = free;
    }
    return balances;
  }

  async getPositions(): Promise<any[]> {
    // For spot, position = balance
    return [];
  }
}
