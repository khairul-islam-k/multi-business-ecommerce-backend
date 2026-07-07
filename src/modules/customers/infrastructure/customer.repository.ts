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
  SQL,
} from "drizzle-orm";

import {
  Customer,
  customer,
  CustomerAddress,
  customerAddress,
  CustomerStatus,
  NewCustomer,
  NewCustomerAddress,
  Order,
  order as orderTable,
  orderCart,
  OrderItem,
  orderItem as orderItemTable,
  OrderPayment,
  orderPayment,
  product,
  productVariant,
} from "@/database/schema";
import { Injectable } from "@nestjs/common";

import {
  DatabaseService,
  DatabaseTransaction,
} from "../../../database/database.service";
import {
  normalizeSearch,
  normalizeSearchUuid,
} from "../../../common/http/search.util";
import { CustomerOrderSortBy, CustomerSortBy } from "../dto/customer.dto";

type SortDirection = "asc" | "desc";

type CustomerPageWhere = {
  businessId: string;
  status?: Customer["status"];
  search?: string;
};

type CustomerOrderBy = {
  field: CustomerSortBy;
  direction: SortDirection;
};

type CustomerOrderPageWhere = {
  businessId: string;
  customerId: string;
  status?: Order["status"];
  paymentStatus?: Order["paymentStatus"];
  search?: string;
};

type CustomerOrderListOrderBy = {
  field: CustomerOrderSortBy;
  direction: SortDirection;
};

type CustomerWithDetails = Customer & {
  addresses: CustomerAddress[];
  _count: {
    carts: number;
    orders: number;
  };
};

type OrderWithDetails = Order & {
  items: OrderItem[];
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

  async create(data: NewCustomer) {
    const [newCustomer] = await this.db
      .insert(customer)
      .values(data)
      .returning();

    return this.withCustomerDetails(newCustomer);
  }

  findById(businessId: string, customerId: string) {
    return this.findCustomerByConditions([
      eq(customer.id, customerId),
      eq(customer.businessId, businessId),
      isNull(customer.deletedAt),
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
        .from(customer)
        .where(where)
        .orderBy(...args.orderBy.map((order) => this.customerOrderBy(order)))
        .limit(args.take)
        .offset(args.skip)
        .then((rows) => this.withCustomersDetails(rows)),
      this.db
        .select({ value: count() })
        .from(customer)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);
  }

  async update(customerId: string, data: Partial<NewCustomer>) {
    const [updatedCustomer] = await this.db
      .update(customer)
      .set(data)
      .where(eq(customer.id, customerId))
      .returning();

    return this.withCustomerDetails(updatedCustomer);
  }

  softDeleteCustomer(
    tx: DatabaseTransaction,
    customerId: string,
    userId: string,
    deletedAt: Date,
  ) {
    return tx
      .update(customer)
      .set({
        status: CustomerStatus.INACTIVE,
        deletedAt,
        deletedBy: userId,
        updatedBy: userId,
      })
      .where(eq(customer.id, customerId));
  }

  softDeleteAddresses(
    tx: DatabaseTransaction,
    customerId: string,
    userId: string,
    deletedAt: Date,
  ) {
    return tx
      .update(customerAddress)
      .set({ deletedAt, deletedBy: userId })
      .where(
        and(
          eq(customerAddress.customerId, customerId),
          isNull(customerAddress.deletedAt),
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
      contactConditions.push(eq(customer.email, contact.email));
    }

    if (contact.phone) {
      contactConditions.push(eq(customer.phone, contact.phone));
    }

    if (contactConditions.length === 0) {
      return Promise.resolve(null);
    }

    return this.db
      .select({ id: customer.id })
      .from(customer)
      .where(
        and(
          eq(customer.businessId, businessId),
          isNull(customer.deletedAt),
          or(...contactConditions),
          excludeCustomerId ? ne(customer.id, excludeCustomerId) : undefined,
        ),
      )
      .limit(1)
      .then(([customer]) => customer ?? null);
  }

  countAddresses(customerId: string) {
    return this.db
      .select({ value: count() })
      .from(customerAddress)
      .where(
        and(
          eq(customerAddress.customerId, customerId),
          isNull(customerAddress.deletedAt),
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
      .update(customerAddress)
      .set({ isDefault: false })
      .where(
        and(
          eq(customerAddress.customerId, customerId),
          isNull(customerAddress.deletedAt),
          eq(customerAddress.isDefault, true),
          excludeAddressId
            ? ne(customerAddress.id, excludeAddressId)
            : undefined,
        ),
      );
  }

  createAddress(tx: DatabaseTransaction, data: NewCustomerAddress) {
    return tx
      .insert(customerAddress)
      .values(data)
      .returning()
      .then(([address]) => address);
  }

  findAddresses(customerId: string) {
    return this.db
      .select()
      .from(customerAddress)
      .where(
        and(
          eq(customerAddress.customerId, customerId),
          isNull(customerAddress.deletedAt),
        ),
      )
      .orderBy(
        desc(customerAddress.isDefault),
        desc(customerAddress.createdAt),
      );
  }

  findAddressById(customerId: string, addressId: string) {
    return this.db
      .select()
      .from(customerAddress)
      .where(
        and(
          eq(customerAddress.id, addressId),
          eq(customerAddress.customerId, customerId),
          isNull(customerAddress.deletedAt),
        ),
      )
      .limit(1)
      .then(([address]) => address ?? null);
  }

  updateAddress(
    tx: DatabaseTransaction,
    addressId: string,
    data: Partial<NewCustomerAddress>,
  ) {
    return tx
      .update(customerAddress)
      .set(data)
      .where(eq(customerAddress.id, addressId))
      .returning()
      .then(([address]) => address);
  }

  findNextDefaultAddress(tx: DatabaseTransaction, customerId: string) {
    return tx
      .select({ id: customerAddress.id })
      .from(customerAddress)
      .where(
        and(
          eq(customerAddress.customerId, customerId),
          isNull(customerAddress.deletedAt),
        ),
      )
      .orderBy(desc(customerAddress.createdAt))
      .limit(1)
      .then(([address]) => address ?? null);
  }

  findOrdersPage(args: {
    where: CustomerOrderPageWhere;
    skip: number;
    take: number;
    orderBy: CustomerOrderListOrderBy[];
  }) {
    const where = this.buildCustomerOrderWhere(args.where);

    return Promise.all([
      this.db
        .select()
        .from(orderTable)
        .where(where)
        .orderBy(...args.orderBy.map((order) => this.orderListOrderBy(order)))
        .limit(args.take)
        .offset(args.skip)
        .then((orders) => this.withOrdersDetails(orders)),
      this.db
        .select({ value: count() })
        .from(orderTable)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);
  }

  private async findCustomerByConditions(conditions: SQL[]) {
    const [existingCustomer] = await this.db
      .select()
      .from(customer)
      .where(and(...conditions))
      .limit(1);

    return customer ? this.withCustomerDetails(existingCustomer) : null;
  }

  private buildCustomerWhere(args: CustomerPageWhere) {
    const search = normalizeSearch(args.search);
    const searchUuid = normalizeSearchUuid(search);

    return and(
      eq(customer.businessId, args.businessId),
      isNull(customer.deletedAt),
      args.status ? eq(customer.status, args.status) : undefined,
      search
        ? or(
            searchUuid ? eq(customer.id, searchUuid) : undefined,
            ilike(customer.name, `%${search}%`),
            ilike(customer.email, `%${search}%`),
            ilike(customer.phone, `%${search}%`),
            ilike(customer.note, `%${search}%`),
            exists(
              this.db
                .select({ id: customerAddress.id })
                .from(customerAddress)
                .where(
                  and(
                    eq(customerAddress.customerId, customer.id),
                    isNull(customerAddress.deletedAt),
                    or(
                      searchUuid
                        ? eq(customerAddress.id, searchUuid)
                        : undefined,
                      ilike(customerAddress.address, `%${search}%`),
                      ilike(customerAddress.city, `%${search}%`),
                      ilike(customerAddress.country, `%${search}%`),
                    ),
                  ),
                ),
            ),
          )
        : undefined,
    );
  }

  private buildCustomerOrderWhere(args: CustomerOrderPageWhere) {
    const search = normalizeSearch(args.search);
    const searchUuid = normalizeSearchUuid(search);

    return and(
      eq(orderTable.businessId, args.businessId),
      eq(orderTable.customerId, args.customerId),
      isNull(orderTable.deletedAt),
      args.status ? eq(orderTable.status, args.status) : undefined,
      args.paymentStatus
        ? eq(orderTable.paymentStatus, args.paymentStatus)
        : undefined,
      search
        ? or(
            searchUuid ? eq(orderTable.id, searchUuid) : undefined,
            ilike(orderTable.orderNo, `%${search}%`),
            ilike(orderTable.note, `%${search}%`),
            exists(
              this.db
                .select({ id: orderPayment.id })
                .from(orderPayment)
                .where(
                  and(
                    eq(orderPayment.orderId, orderTable.id),
                    or(
                      searchUuid ? eq(orderPayment.id, searchUuid) : undefined,
                      ilike(orderPayment.paymentNo, `%${search}%`),
                    ),
                  ),
                ),
            ),
            exists(
              this.db
                .select({ id: orderItemTable.id })
                .from(orderItemTable)
                .innerJoin(product, eq(product.id, orderItemTable.productId))
                .leftJoin(
                  productVariant,
                  eq(productVariant.id, orderItemTable.variantId),
                )
                .where(
                  and(
                    eq(orderItemTable.orderId, orderTable.id),
                    or(
                      searchUuid
                        ? eq(orderItemTable.id, searchUuid)
                        : undefined,
                      searchUuid ? eq(product.id, searchUuid) : undefined,
                      searchUuid
                        ? eq(productVariant.id, searchUuid)
                        : undefined,
                      ilike(product.name, `%${search}%`),
                      ilike(product.slug, `%${search}%`),
                      ilike(product.sku, `%${search}%`),
                      ilike(product.barcode, `%${search}%`),
                      ilike(productVariant.title, `%${search}%`),
                      ilike(productVariant.sku, `%${search}%`),
                      ilike(productVariant.barcode, `%${search}%`),
                    ),
                  ),
                ),
            ),
          )
        : undefined,
    );
  }

  private customerOrderBy(order: CustomerOrderBy) {
    const column =
      order.field === CustomerSortBy.NAME
        ? customer.name
        : order.field === CustomerSortBy.UPDATED_AT
          ? customer.updatedAt
          : customer.createdAt;

    return order.direction === "asc" ? asc(column) : desc(column);
  }

  private orderListOrderBy(order: CustomerOrderListOrderBy) {
    const column =
      order.field === CustomerOrderSortBy.ORDER_NO
        ? orderTable.orderNo
        : order.field === CustomerOrderSortBy.TOTAL_AMOUNT
          ? orderTable.totalAmount
          : orderTable.createdAt;

    return order.direction === "asc" ? asc(column) : desc(column);
  }

  private async withCustomerDetails(customer: Customer) {
    const [customerWithDetails] = await this.withCustomersDetails([customer]);

    return customerWithDetails;
  }

  private async withCustomersDetails(
    customers: Customer[],
  ): Promise<CustomerWithDetails[]> {
    const customerIds = customers.map((customer) => customer.id);

    if (customerIds.length === 0) {
      return [];
    }

    const [addresses, cartCounts, orderCounts] = await Promise.all([
      this.db
        .select()
        .from(customerAddress)
        .where(
          and(
            inArray(customerAddress.customerId, customerIds),
            isNull(customerAddress.deletedAt),
          ),
        )
        .orderBy(
          desc(customerAddress.isDefault),
          desc(customerAddress.createdAt),
        ),
      this.db
        .select({ customerId: orderCart.customerId, value: count() })
        .from(orderCart)
        .where(inArray(orderCart.customerId, customerIds))
        .groupBy(orderCart.customerId),
      this.db
        .select({ customerId: orderTable.customerId, value: count() })
        .from(orderTable)
        .where(inArray(orderTable.customerId, customerIds))
        .groupBy(orderTable.customerId),
    ]);

    const addressesByCustomerId = new Map<string, CustomerAddress[]>();
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
    orders: Order[],
  ): Promise<OrderWithDetails[]> {
    const orderIds = orders.map((order) => order.id);

    if (orderIds.length === 0) {
      return [];
    }

    const [items, payments] = await Promise.all([
      this.db
        .select()
        .from(orderItemTable)
        .where(inArray(orderItemTable.orderId, orderIds))
        .orderBy(asc(orderItemTable.createdAt)),
      this.db
        .select()
        .from(orderPayment)
        .where(inArray(orderPayment.orderId, orderIds))
        .orderBy(desc(orderPayment.createdAt)),
    ]);

    const itemsByOrderId = new Map<string, OrderItem[]>();
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
