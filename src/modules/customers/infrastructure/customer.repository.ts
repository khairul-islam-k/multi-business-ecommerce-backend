import { Injectable } from "@nestjs/common";
import {
  type NewOrderCustomer,
  type NewOrderCustomerAddress,
  type OrderCart,
  type OrderCustomer,
  type OrderCustomerAddress,
  OrderCustomerStatus,
  type OrderOrder,
  type OrderOrderItem,
  type OrderPayment,
  orderCart,
  orderCustomer,
  orderCustomerAddress,
  orderOrder,
  orderOrderItem,
  orderPayment,
} from "@/database/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  type SQL,
} from "drizzle-orm";

import {
  type DatabaseTransaction,
  DatabaseService,
} from "../../../database/database.service";
import {
  CustomerOrderSortBy,
  CustomerSortBy,
} from "../dto/customer.dto";

type SortDirection = "asc" | "desc";

type CustomerPageWhere = {
  businessId: string;
  status?: OrderCustomer["status"];
  search?: string;
};

type CustomerOrderBy = {
  field: CustomerSortBy;
  direction: SortDirection;
};

type CustomerOrderPageWhere = {
  businessId: string;
  customerId: string;
  status?: OrderOrder["status"];
  paymentStatus?: OrderOrder["paymentStatus"];
  search?: string;
};

type CustomerOrderOrderBy = {
  field: CustomerOrderSortBy;
  direction: SortDirection;
};

type CustomerWithDetails = OrderCustomer & {
  addresses: OrderCustomerAddress[];
  _count: {
    carts: number;
    orders: number;
  };
};

type OrderWithDetails = OrderOrder & {
  items: OrderOrderItem[];
  payments: OrderPayment[];
};

@Injectable()
export class CustomerRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  transaction<T>(callback: (tx: DatabaseTransaction) => Promise<T>) {
    return this.db.transaction(callback);
  }

  async create(data: NewOrderCustomer) {
    const [customer] = await this.db
      .insert(orderCustomer)
      .values(data)
      .returning();

    return this.withCustomerDetails(customer);
  }

  findById(businessId: string, customerId: string) {
    return this.findCustomerByConditions([
      eq(orderCustomer.id, customerId),
      eq(orderCustomer.businessId, businessId),
      isNull(orderCustomer.deletedAt),
    ]);
  }

  findPage(args: {
    where: CustomerPageWhere;
    skip: number;
    take: number;
    orderBy: CustomerOrderBy[];
  }) {
    const where = this.buildCustomerWhere(args.where);

    return Promise.all([
      this.db
        .select()
        .from(orderCustomer)
        .where(where)
        .orderBy(...args.orderBy.map((order) => this.customerOrderBy(order)))
        .limit(args.take)
        .offset(args.skip)
        .then((rows) => this.withCustomersDetails(rows)),
      this.db
        .select({ value: count() })
        .from(orderCustomer)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);
  }

  async update(customerId: string, data: Partial<NewOrderCustomer>) {
    const [customer] = await this.db
      .update(orderCustomer)
      .set(data)
      .where(eq(orderCustomer.id, customerId))
      .returning();

    return this.withCustomerDetails(customer);
  }

  softDeleteCustomer(
    tx: DatabaseTransaction,
    customerId: string,
    userId: string,
    deletedAt: Date,
  ) {
    return tx
      .update(orderCustomer)
      .set({
        status: OrderCustomerStatus.INACTIVE,
        deletedAt,
        updatedBy: userId,
      })
      .where(eq(orderCustomer.id, customerId));
  }

  softDeleteAddresses(
    tx: DatabaseTransaction,
    customerId: string,
    deletedAt: Date,
  ) {
    return tx
      .update(orderCustomerAddress)
      .set({ deletedAt })
      .where(
        and(
          eq(orderCustomerAddress.customerId, customerId),
          isNull(orderCustomerAddress.deletedAt),
        ),
      );
  }

  findExistingContact(
    businessId: string,
    contact: { email?: string | null; phone?: string | null },
    excludeCustomerId?: string,
  ) {
    const contactConditions: SQL[] = [];

    if (contact.email) {
      contactConditions.push(eq(orderCustomer.email, contact.email));
    }

    if (contact.phone) {
      contactConditions.push(eq(orderCustomer.phone, contact.phone));
    }

    if (contactConditions.length === 0) {
      return Promise.resolve(null);
    }

    return this.db
      .select({ id: orderCustomer.id })
      .from(orderCustomer)
      .where(
        and(
          eq(orderCustomer.businessId, businessId),
          isNull(orderCustomer.deletedAt),
          or(...contactConditions),
          excludeCustomerId
            ? ne(orderCustomer.id, excludeCustomerId)
            : undefined,
        ),
      )
      .limit(1)
      .then(([customer]) => customer ?? null);
  }

  countAddresses(customerId: string) {
    return this.db
      .select({ value: count() })
      .from(orderCustomerAddress)
      .where(
        and(
          eq(orderCustomerAddress.customerId, customerId),
          isNull(orderCustomerAddress.deletedAt),
        ),
      )
      .then(([row]) => row?.value ?? 0);
  }

  unsetDefaultAddresses(
    tx: DatabaseTransaction,
    customerId: string,
    excludeAddressId?: string,
  ) {
    return tx
      .update(orderCustomerAddress)
      .set({ isDefault: false })
      .where(
        and(
          eq(orderCustomerAddress.customerId, customerId),
          isNull(orderCustomerAddress.deletedAt),
          eq(orderCustomerAddress.isDefault, true),
          excludeAddressId
            ? ne(orderCustomerAddress.id, excludeAddressId)
            : undefined,
        ),
      );
  }

  createAddress(
    tx: DatabaseTransaction,
    data: NewOrderCustomerAddress,
  ) {
    return tx.insert(orderCustomerAddress).values(data).returning().then(([address]) => address);
  }

  findAddresses(customerId: string) {
    return this.db
      .select()
      .from(orderCustomerAddress)
      .where(
        and(
          eq(orderCustomerAddress.customerId, customerId),
          isNull(orderCustomerAddress.deletedAt),
        ),
      )
      .orderBy(desc(orderCustomerAddress.isDefault), desc(orderCustomerAddress.createdAt));
  }

  findAddressById(customerId: string, addressId: string) {
    return this.db
      .select()
      .from(orderCustomerAddress)
      .where(
        and(
          eq(orderCustomerAddress.id, addressId),
          eq(orderCustomerAddress.customerId, customerId),
          isNull(orderCustomerAddress.deletedAt),
        ),
      )
      .limit(1)
      .then(([address]) => address ?? null);
  }

  updateAddress(
    tx: DatabaseTransaction,
    addressId: string,
    data: Partial<NewOrderCustomerAddress>,
  ) {
    return tx
      .update(orderCustomerAddress)
      .set(data)
      .where(eq(orderCustomerAddress.id, addressId))
      .returning()
      .then(([address]) => address);
  }

  findNextDefaultAddress(tx: DatabaseTransaction, customerId: string) {
    return tx
      .select({ id: orderCustomerAddress.id })
      .from(orderCustomerAddress)
      .where(
        and(
          eq(orderCustomerAddress.customerId, customerId),
          isNull(orderCustomerAddress.deletedAt),
        ),
      )
      .orderBy(desc(orderCustomerAddress.createdAt))
      .limit(1)
      .then(([address]) => address ?? null);
  }

  findOrdersPage(args: {
    where: CustomerOrderPageWhere;
    skip: number;
    take: number;
    orderBy: CustomerOrderOrderBy[];
  }) {
    const where = this.buildCustomerOrderWhere(args.where);

    return Promise.all([
      this.db
        .select()
        .from(orderOrder)
        .where(where)
        .orderBy(...args.orderBy.map((order) => this.orderOrderBy(order)))
        .limit(args.take)
        .offset(args.skip)
        .then((orders) => this.withOrdersDetails(orders)),
      this.db
        .select({ value: count() })
        .from(orderOrder)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);
  }

  private async findCustomerByConditions(conditions: SQL[]) {
    const [customer] = await this.db
      .select()
      .from(orderCustomer)
      .where(and(...conditions))
      .limit(1);

    return customer ? this.withCustomerDetails(customer) : null;
  }

  private buildCustomerWhere(args: CustomerPageWhere) {
    return and(
      eq(orderCustomer.businessId, args.businessId),
      isNull(orderCustomer.deletedAt),
      args.status ? eq(orderCustomer.status, args.status) : undefined,
      args.search
        ? or(
            ilike(orderCustomer.name, `%${args.search}%`),
            ilike(orderCustomer.email, `%${args.search}%`),
            ilike(orderCustomer.phone, `%${args.search}%`),
            ilike(orderCustomer.note, `%${args.search}%`),
            exists(
              this.db
                .select({ id: orderCustomerAddress.id })
                .from(orderCustomerAddress)
                .where(
                  and(
                    eq(orderCustomerAddress.customerId, orderCustomer.id),
                    isNull(orderCustomerAddress.deletedAt),
                    or(
                      ilike(orderCustomerAddress.address, `%${args.search}%`),
                      ilike(orderCustomerAddress.city, `%${args.search}%`),
                      ilike(orderCustomerAddress.country, `%${args.search}%`),
                    ),
                  ),
                ),
            ),
          )
        : undefined,
    );
  }

  private buildCustomerOrderWhere(args: CustomerOrderPageWhere) {
    return and(
      eq(orderOrder.businessId, args.businessId),
      eq(orderOrder.customerId, args.customerId),
      isNull(orderOrder.deletedAt),
      args.status ? eq(orderOrder.status, args.status) : undefined,
      args.paymentStatus
        ? eq(orderOrder.paymentStatus, args.paymentStatus)
        : undefined,
      args.search
        ? or(
            ilike(orderOrder.orderNo, `%${args.search}%`),
            ilike(orderOrder.note, `%${args.search}%`),
          )
        : undefined,
    );
  }

  private customerOrderBy(order: CustomerOrderBy) {
    const column =
      order.field === CustomerSortBy.NAME
        ? orderCustomer.name
        : order.field === CustomerSortBy.UPDATED_AT
          ? orderCustomer.updatedAt
          : orderCustomer.createdAt;

    return order.direction === "asc" ? asc(column) : desc(column);
  }

  private orderOrderBy(order: CustomerOrderOrderBy) {
    const column =
      order.field === CustomerOrderSortBy.ORDER_NO
        ? orderOrder.orderNo
        : order.field === CustomerOrderSortBy.TOTAL_AMOUNT
          ? orderOrder.totalAmount
          : orderOrder.createdAt;

    return order.direction === "asc" ? asc(column) : desc(column);
  }

  private async withCustomerDetails(customer: OrderCustomer) {
    const [customerWithDetails] = await this.withCustomersDetails([customer]);

    return customerWithDetails;
  }

  private async withCustomersDetails(
    customers: OrderCustomer[],
  ): Promise<CustomerWithDetails[]> {
    const customerIds = customers.map((customer) => customer.id);

    if (customerIds.length === 0) {
      return [];
    }

    const [addresses, cartCounts, orderCounts] = await Promise.all([
      this.db
        .select()
        .from(orderCustomerAddress)
        .where(
          and(
            inArray(orderCustomerAddress.customerId, customerIds),
            isNull(orderCustomerAddress.deletedAt),
          ),
        )
        .orderBy(
          desc(orderCustomerAddress.isDefault),
          desc(orderCustomerAddress.createdAt),
        ),
      this.db
        .select({ customerId: orderCart.customerId, value: count() })
        .from(orderCart)
        .where(inArray(orderCart.customerId, customerIds))
        .groupBy(orderCart.customerId),
      this.db
        .select({ customerId: orderOrder.customerId, value: count() })
        .from(orderOrder)
        .where(inArray(orderOrder.customerId, customerIds))
        .groupBy(orderOrder.customerId),
    ]);

    const addressesByCustomerId = new Map<string, OrderCustomerAddress[]>();
    const cartCountByCustomerId = new Map(
      cartCounts.map((row) => [row.customerId, row.value]),
    );
    const orderCountByCustomerId = new Map(
      orderCounts.map((row) => [row.customerId, row.value]),
    );

    for (const address of addresses) {
      const current = addressesByCustomerId.get(address.customerId) ?? [];
      current.push(address);
      addressesByCustomerId.set(address.customerId, current);
    }

    return customers.map((customer) => ({
      ...customer,
      addresses: addressesByCustomerId.get(customer.id) ?? [],
      _count: {
        carts: cartCountByCustomerId.get(customer.id) ?? 0,
        orders: orderCountByCustomerId.get(customer.id) ?? 0,
      },
    }));
  }

  private async withOrdersDetails(
    orders: OrderOrder[],
  ): Promise<OrderWithDetails[]> {
    const orderIds = orders.map((order) => order.id);

    if (orderIds.length === 0) {
      return [];
    }

    const [items, payments] = await Promise.all([
      this.db
        .select()
        .from(orderOrderItem)
        .where(inArray(orderOrderItem.orderId, orderIds))
        .orderBy(asc(orderOrderItem.createdAt)),
      this.db
        .select()
        .from(orderPayment)
        .where(inArray(orderPayment.orderId, orderIds))
        .orderBy(desc(orderPayment.createdAt)),
    ]);

    const itemsByOrderId = new Map<string, OrderOrderItem[]>();
    const paymentsByOrderId = new Map<string, OrderPayment[]>();

    for (const item of items) {
      const current = itemsByOrderId.get(item.orderId) ?? [];
      current.push(item);
      itemsByOrderId.set(item.orderId, current);
    }

    for (const payment of payments) {
      const current = paymentsByOrderId.get(payment.orderId) ?? [];
      current.push(payment);
      paymentsByOrderId.set(payment.orderId, current);
    }

    return orders.map((order) => ({
      ...order,
      items: itemsByOrderId.get(order.id) ?? [],
      payments: paymentsByOrderId.get(order.id) ?? [],
    }));
  }
}
