import { Injectable, NotFoundException } from "@nestjs/common";
import {
  type OrderOrder,
  orderCustomer,
  orderOrder,
  orderOrderItem,
  orderPayment,
  orderStatusLog,
} from "@/database/schema";
import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

import type { QueryOrderDto } from "../dto/order.dto";
import {
  DatabaseService,
  type Database,
  type DatabaseTransaction,
} from "../../../database/database.service";

@Injectable()
export class OrderRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async findPaginated(businessId: string, query: QueryOrderDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(orderOrder.businessId, businessId),
      isNull(orderOrder.deletedAt),
      query.status ? eq(orderOrder.status, query.status) : undefined,
      query.paymentStatus
        ? eq(orderOrder.paymentStatus, query.paymentStatus)
        : undefined,
      query.orderType ? eq(orderOrder.orderType, query.orderType) : undefined,
      query.search
        ? or(
            ilike(orderOrder.orderNo, `%${query.search}%`),
            ilike(orderOrder.customerName, `%${query.search}%`),
            ilike(orderOrder.customerPhone, `%${query.search}%`),
          )
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(orderOrder)
        .where(where)
        .orderBy(desc(orderOrder.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(orderOrder)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);
    const items = await Promise.all(rows.map((order) => this.hydrate(order)));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(businessId: string, orderId: string) {
    const [order] = await this.db
      .select()
      .from(orderOrder)
      .where(
        and(
          eq(orderOrder.id, orderId),
          eq(orderOrder.businessId, businessId),
          isNull(orderOrder.deletedAt),
        ),
      );

    return order ? this.hydrate(order) : null;
  }

  async getByIdOrThrow(businessId: string, orderId: string) {
    const [order] = await this.db
      .select()
      .from(orderOrder)
      .where(
        and(
          eq(orderOrder.id, orderId),
          eq(orderOrder.businessId, businessId),
          isNull(orderOrder.deletedAt),
        ),
      );

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  async hydrate(order: OrderOrder, client: Database | DatabaseTransaction = this.db) {
    const [customer, items, payments, statusLogs] = await Promise.all([
      order.customerId
        ? client
            .select()
            .from(orderCustomer)
            .where(eq(orderCustomer.id, order.customerId))
            .then(([row]) => row ?? null)
        : Promise.resolve(null),
      client
        .select()
        .from(orderOrderItem)
        .where(eq(orderOrderItem.orderId, order.id)),
      client
        .select()
        .from(orderPayment)
        .where(eq(orderPayment.orderId, order.id)),
      client
        .select()
        .from(orderStatusLog)
        .where(eq(orderStatusLog.orderId, order.id))
        .orderBy(asc(orderStatusLog.createdAt)),
    ]);

    return {
      ...order,
      customer,
      items,
      payments,
      statusLogs,
    };
  }
}
