import { and, asc, count, eq, exists, ilike, isNull, or } from "drizzle-orm";

import {
  customer,
  invoice,
  Order,
  order,
  orderItem,
  orderPayment,
  orderStatusLog,
} from "@/database/schema";
import { Injectable, NotFoundException } from "@nestjs/common";

import {
  buildOrderBy,
  resolveSortColumn,
} from "../../../common/http/sort.util";
import {
  normalizeSearch,
  normalizeSearchUuid,
} from "../../../common/http/search.util";
import {
  Database,
  DatabaseService,
  DatabaseTransaction,
} from "../../../database/database.service";
import { OrderSortBy, QueryOrderDto } from "../dto/order.dto";

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
    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);
    const where = and(
      eq(order.businessId, businessId),
      isNull(order.deletedAt),
      query.status ? eq(order.status, query.status) : undefined,
      query.paymentStatus
        ? eq(order.paymentStatus, query.paymentStatus)
        : undefined,
      query.orderType ? eq(order.orderType, query.orderType) : undefined,
      search
        ? or(
            searchUuid ? eq(order.id, searchUuid) : undefined,
            searchUuid ? eq(order.customerId, searchUuid) : undefined,
            searchUuid ? eq(order.warehouseId, searchUuid) : undefined,
            ilike(order.orderNo, `%${search}%`),
            ilike(order.customerName, `%${search}%`),
            ilike(order.customerPhone, `%${search}%`),
            ilike(order.customerEmail, `%${search}%`),
            ilike(order.note, `%${search}%`),
            exists(
              this.db
                .select({ id: invoice.id })
                .from(invoice)
                .where(
                  and(
                    eq(invoice.businessId, businessId),
                    eq(invoice.orderId, order.id),
                    ilike(invoice.invoiceNo, `%${search}%`),
                    isNull(invoice.deletedAt),
                  ),
                ),
            ),
            exists(
              this.db
                .select({ id: orderPayment.id })
                .from(orderPayment)
                .where(
                  and(
                    eq(orderPayment.orderId, order.id),
                    ilike(orderPayment.paymentNo, `%${search}%`),
                  ),
                ),
            ),
          )
        : undefined,
    );

    const orderBy = buildOrderBy(
      resolveSortColumn(
        query.sortBy,
        {
          [OrderSortBy.ORDER_NO]: order.orderNo,
          [OrderSortBy.TOTAL_AMOUNT]: order.totalAmount,
          [OrderSortBy.CREATED_AT]: order.createdAt,
          [OrderSortBy.UPDATED_AT]: order.updatedAt,
        },
        OrderSortBy.CREATED_AT,
      ),
      query.sortOrder,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(order)
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(order)
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
    const [fetchedOrder] = await this.db
      .select()
      .from(order)
      .where(
        and(
          eq(order.id, orderId),
          eq(order.businessId, businessId),
          isNull(order.deletedAt),
        ),
      );

    return fetchedOrder ? this.hydrate(fetchedOrder) : null;
  }

  async getByIdOrThrow(businessId: string, orderId: string) {
    const [fetchedOrder] = await this.db
      .select()
      .from(order)
      .where(
        and(
          eq(order.id, orderId),
          eq(order.businessId, businessId),
          isNull(order.deletedAt),
        ),
      );

    if (!fetchedOrder) {
      throw new NotFoundException(
        "Order could not be found. It may not exist, may have been deleted, or may not belong to the current business or customer account.",
      );
    }

    return fetchedOrder;
  }

  async hydrate(
    order: Order,
    client: Database | DatabaseTransaction = this.db,
  ) {
    const [existingCustomer, items, payments, statusLogs] = await Promise.all([
      order.customerId
        ? client
            .select()
            .from(customer)
            .where(eq(customer.id, order.customerId))
            .then(([row]) => row ?? null)
        : Promise.resolve(null),
      client.select().from(orderItem).where(eq(orderItem.orderId, order.id)),
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
      existingCustomer,
      items,
      payments,
      statusLogs,
    };
  }
}
