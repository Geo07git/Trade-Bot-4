import path from 'path';
import fs from 'fs';
import { logger } from '../../../src/utils/logger';

export interface AuditEvent {
  id: number;
  timestamp: number;
  eventType: string;
  symbol?: string;
  strategy?: string;
  action?: string;
  details: any;
}

export interface StoredOrder {
  id: string;
  clientOrderId: string;
  symbol: string;
  side: string;
  type: string;
  status: string;
  price?: number;
  quantity?: number;
  filledQuantity?: number;
  fee?: number;
  timestamp: number;
  updatedAt?: number;
}

export interface StoredPosition {
  id: string;
  symbol: string;
  side: string;
  status: string;
  entryPrice: number;
  quantity: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
  openedAt: number;
  closedAt?: number;
}

export interface AuditEventFilter {
  eventType?: string;
  symbol?: string;
  strategy?: string;
  search?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
  offset?: number;
}

export class Database {
  private auditEvents: AuditEvent[] = [];
  private orders: Map<string, StoredOrder> = new Map();
  private positions: Map<string, StoredPosition> = new Map();
  private readonly dataDir = path.join(process.cwd(), 'data');
  private readonly eventsFile = path.join(process.cwd(), 'data', 'tradebot_events.json');
  private readonly ordersFile = path.join(process.cwd(), 'data', 'tradebot_orders.json');
  private nextEventId = 1;

  async connect() {
    await this.initSchema();
  }

  private async initSchema() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.eventsFile)) {
        const raw = fs.readFileSync(this.eventsFile, 'utf8');
        this.auditEvents = JSON.parse(raw);
        if (this.auditEvents.length > 0) {
          this.nextEventId = Math.max(...this.auditEvents.map(e => e.id || 0)) + 1;
        }
      }

      if (fs.existsSync(this.ordersFile)) {
        const raw = fs.readFileSync(this.ordersFile, 'utf8');
        const list: StoredOrder[] = JSON.parse(raw);
        for (const o of list) {
          this.orders.set(o.clientOrderId || o.id, o);
        }
      }

      logger.info('✅ TradeBot Database storage initialized successfully.');
    } catch (err) {
      logger.warn(`[Database initSchema warning] ${err}`);
    }
  }

  private saveEvents() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      // Cap audit events to last 2000 items
      if (this.auditEvents.length > 2000) {
        this.auditEvents = this.auditEvents.slice(0, 2000);
      }
      fs.writeFileSync(this.eventsFile, JSON.stringify(this.auditEvents, null, 2), 'utf8');
    } catch (err) {
      logger.warn(`[Database saveEvents warning] ${err}`);
    }
  }

  private saveOrders() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const list = Array.from(this.orders.values());
      fs.writeFileSync(this.ordersFile, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      logger.warn(`[Database saveOrders warning] ${err}`);
    }
  }

  async logEvent(eventType: string, details: any, symbol?: string, strategy: string = 'TradeBot', action?: string) {
    const event: AuditEvent = {
      id: this.nextEventId++,
      timestamp: Date.now(),
      eventType,
      symbol,
      strategy,
      action,
      details
    };
    this.auditEvents.unshift(event);
    this.saveEvents();
    return event;
  }

  async saveOrder(order: StoredOrder) {
    this.orders.set(order.clientOrderId || order.id, order);
    this.saveOrders();
  }

  getAuditEvents(filter: AuditEventFilter = {}): { events: AuditEvent[]; total: number; eventTypes: string[] } {
    let filtered = [...this.auditEvents];

    if (filter.eventType && filter.eventType !== 'ALL') {
      filtered = filtered.filter(e => e.eventType === filter.eventType);
    }
    if (filter.symbol && filter.symbol !== 'ALL') {
      const symUpper = filter.symbol.toUpperCase();
      filtered = filtered.filter(e => e.symbol && e.symbol.toUpperCase().includes(symUpper));
    }
    if (filter.strategy && filter.strategy !== 'ALL') {
      filtered = filtered.filter(e => e.strategy === filter.strategy);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      filtered = filtered.filter(e => 
        e.eventType.toLowerCase().includes(q) ||
        (e.symbol && e.symbol.toLowerCase().includes(q)) ||
        (e.action && e.action.toLowerCase().includes(q)) ||
        JSON.stringify(e.details).toLowerCase().includes(q)
      );
    }
    if (filter.fromTimestamp) {
      filtered = filtered.filter(e => e.timestamp >= filter.fromTimestamp!);
    }
    if (filter.toTimestamp) {
      filtered = filtered.filter(e => e.timestamp <= filter.toTimestamp!);
    }

    const total = filtered.length;
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;
    const paginated = filtered.slice(offset, offset + limit);

    // Extract unique event types for filters
    const eventTypes = Array.from(new Set(this.auditEvents.map(e => e.eventType))).sort();

    return {
      events: paginated,
      total,
      eventTypes
    };
  }

  getAuditStats() {
    const totalEvents = this.auditEvents.length;
    const typeCounts: Record<string, number> = {};
    for (const e of this.auditEvents) {
      typeCounts[e.eventType] = (typeCounts[e.eventType] || 0) + 1;
    }
    return {
      totalEvents,
      typeCounts,
      lastEventTimestamp: this.auditEvents[0]?.timestamp || null
    };
  }

  clearAuditEvents() {
    this.auditEvents = [];
    this.saveEvents();
  }

  getOrders(): StoredOrder[] {
    return Array.from(this.orders.values()).sort((a, b) => b.timestamp - a.timestamp);
  }
}

export const db = new Database();

