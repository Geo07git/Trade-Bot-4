import { ExchangeAdapter, Order } from '../adapters/ExchangeAdapter';
import { db } from '../database/Database';
import { logger } from '../../../src/utils/logger';

export class OrderManager {
  private adapter: ExchangeAdapter | null = null;
  private orders: Map<string, Order> = new Map();

  setAdapter(adapter: ExchangeAdapter) {
    this.adapter = adapter;
  }

  async submitOrder(orderReq: Omit<Order, 'status' | 'filledQuantity' | 'id'>): Promise<Order> {
    if (!this.adapter) throw new Error('No exchange adapter configured.');

    const order: Order = {
      ...orderReq,
      id: '', // Will be assigned by adapter
      status: 'CREATED',
      filledQuantity: 0
    };

    logger.info(`[OrderManager] Creating order ${order.side} ${order.quantity} ${order.symbol}`);
    
    try {
      order.status = 'SUBMITTED';
      const submittedOrder = await this.adapter.submitOrder(order);
      this.orders.set(submittedOrder.clientOrderId, submittedOrder);
      
      await db.logEvent('ORDER_SUBMITTED', submittedOrder, submittedOrder.symbol, 'scalping', submittedOrder.side);
      return submittedOrder;
    } catch (err: any) {
      logger.error(`[OrderManager] Order rejection: ${err.message}`);
      order.status = 'REJECTED';
      await db.logEvent('ORDER_REJECTED', { error: err.message }, order.symbol, 'scalping', order.side);
      throw err;
    }
  }

  async cancelOrder(clientOrderId: string, symbol: string): Promise<boolean> {
    if (!this.adapter) return false;
    const order = this.orders.get(clientOrderId);
    if (!order) return false;

    order.status = 'CANCEL_REQUESTED';
    try {
      const result = await this.adapter.cancelOrder(clientOrderId, symbol);
      if (result) {
        order.status = 'CANCELLED';
        await db.logEvent('ORDER_CANCELLED', { clientOrderId }, symbol, 'scalping');
      }
      return result;
    } catch (err) {
      logger.error(`[OrderManager] Cancel failed: ${err}`);
      return false;
    }
  }

  getOrder(clientOrderId: string): Order | undefined {
    return this.orders.get(clientOrderId);
  }
}

export const orderManager = new OrderManager();
