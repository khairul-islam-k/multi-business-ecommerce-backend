import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  isNull,
  or,
} from "drizzle-orm";

import {
  customer,
  financeTax,
  Invoice,
  invoice,
  invoiceItem,
  order,
  orderPayment,
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
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import { DatabaseService } from "../../../database/database.service";
import {
  InvoiceSortBy,
  QueryCustomerInvoiceDto,
  QueryInvoiceDto,
} from "../dto/order.dto";

import type { CurrentCustomerPayload } from "../../customer-auth/strategies/customer-jwt.strategy";

@Injectable()
export class InvoiceQueryService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async findAll(businessId: string, query: QueryInvoiceDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);
    const where = and(
      eq(invoice.businessId, businessId),
      isNull(invoice.deletedAt),
      query.status ? eq(invoice.status, query.status) : undefined,
      query.customerId ? eq(invoice.customerId, query.customerId) : undefined,
      query.orderId ? eq(invoice.orderId, query.orderId) : undefined,
      search
        ? or(
            searchUuid ? eq(invoice.id, searchUuid) : undefined,
            searchUuid ? eq(invoice.orderId, searchUuid) : undefined,
            searchUuid ? eq(invoice.customerId, searchUuid) : undefined,
            ilike(invoice.invoiceNo, `%${search}%`),
            ilike(invoice.customerName, `%${search}%`),
            ilike(invoice.customerPhone, `%${search}%`),
            ilike(invoice.customerEmail, `%${search}%`),
            ilike(invoice.note, `%${search}%`),
            exists(
              this.db
                .select({ id: order.id })
                .from(order)
                .where(
                  and(
                    eq(order.id, invoice.orderId),
                    eq(order.businessId, businessId),
                    ilike(order.orderNo, `%${search}%`),
                    isNull(order.deletedAt),
                  ),
                ),
            ),
          )
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(invoice)
        .where(where)
        .orderBy(this.getOrderBy(query))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(invoice)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      await Promise.all(rows.map((row) => this.hydrate(row))),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Invoices were loaded successfully. The response includes the requested page of invoice records and pagination metadata for browsing more results.",
    );
  }

  async findOne(businessId: string, invoiceId: string) {
    const invoiceRow = await this.findInvoiceRow(businessId, invoiceId);

    return apiResponse(await this.hydrate(invoiceRow));
  }

  async findCustomerInvoices(
    currentCustomer: CurrentCustomerPayload,
    query: QueryCustomerInvoiceDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);
    const where = and(
      eq(invoice.businessId, currentCustomer.businessId),
      eq(invoice.customerId, currentCustomer.customerId),
      isNull(invoice.deletedAt),
      query.status ? eq(invoice.status, query.status) : undefined,
      search
        ? or(
            searchUuid ? eq(invoice.id, searchUuid) : undefined,
            searchUuid ? eq(invoice.orderId, searchUuid) : undefined,
            ilike(invoice.invoiceNo, `%${search}%`),
            ilike(invoice.note, `%${search}%`),
            exists(
              this.db
                .select({ id: order.id })
                .from(order)
                .where(
                  and(
                    eq(order.id, invoice.orderId),
                    eq(order.businessId, currentCustomer.businessId),
                    eq(order.customerId, currentCustomer.customerId),
                    ilike(order.orderNo, `%${search}%`),
                    isNull(order.deletedAt),
                  ),
                ),
            ),
          )
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(invoice)
        .where(where)
        .orderBy(this.getOrderBy(query))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(invoice)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      await Promise.all(rows.map((row) => this.hydrate(row))),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Customer invoices were loaded successfully. The response includes the requested page of storefront invoices for this customer and pagination metadata for browsing more results.",
    );
  }

  async findCustomerInvoice(
    currentCustomer: CurrentCustomerPayload,
    invoiceId: string,
  ) {
    const [invoiceRow] = await this.db
      .select()
      .from(invoice)
      .where(
        and(
          eq(invoice.id, invoiceId),
          eq(invoice.businessId, currentCustomer.businessId),
          eq(invoice.customerId, currentCustomer.customerId),
          isNull(invoice.deletedAt),
        ),
      )
      .limit(1);

    if (!invoiceRow) {
      throw new NotFoundException(
        "Invoice could not be found. It may not exist, may have been deleted, or may not belong to the current storefront customer account.",
      );
    }

    return apiResponse(await this.hydrate(invoiceRow));
  }

  private async findInvoiceRow(businessId: string, invoiceId: string) {
    const [invoiceRow] = await this.db
      .select()
      .from(invoice)
      .where(
        and(
          eq(invoice.id, invoiceId),
          eq(invoice.businessId, businessId),
          isNull(invoice.deletedAt),
        ),
      )
      .limit(1);

    if (!invoiceRow) {
      throw new NotFoundException(
        "Invoice could not be found. It may not exist, may have been deleted, or may not belong to the current business.",
      );
    }

    return invoiceRow;
  }

  private getOrderBy(query: Pick<QueryInvoiceDto, "sortBy" | "sortOrder">) {
    return buildOrderBy(
      resolveSortColumn(
        query.sortBy,
        {
          [InvoiceSortBy.INVOICE_NO]: invoice.invoiceNo,
          [InvoiceSortBy.INVOICE_DATE]: invoice.invoiceDate,
          [InvoiceSortBy.DUE_DATE]: invoice.dueDate,
          [InvoiceSortBy.TOTAL_AMOUNT]: invoice.totalAmount,
          [InvoiceSortBy.CREATED_AT]: invoice.createdAt,
          [InvoiceSortBy.UPDATED_AT]: invoice.updatedAt,
        },
        InvoiceSortBy.CREATED_AT,
      ),
      query.sortOrder,
    );
  }

  private async hydrate(invoiceRow: Invoice) {
    const [orderRow, customerRow, tax, items, payments] = await Promise.all([
      invoiceRow.orderId
        ? this.db
            .select()
            .from(order)
            .where(eq(order.id, invoiceRow.orderId))
            .then(([row]) => row ?? null)
        : Promise.resolve(null),
      invoiceRow.customerId
        ? this.db
            .select()
            .from(customer)
            .where(eq(customer.id, invoiceRow.customerId))
            .then(([row]) => row ?? null)
        : Promise.resolve(null),
      invoiceRow.taxId
        ? this.db
            .select()
            .from(financeTax)
            .where(eq(financeTax.id, invoiceRow.taxId))
            .then(([row]) => row ?? null)
        : Promise.resolve(null),
      this.db
        .select()
        .from(invoiceItem)
        .where(eq(invoiceItem.invoiceId, invoiceRow.id))
        .orderBy(asc(invoiceItem.createdAt)),
      invoiceRow.orderId
        ? this.db
            .select()
            .from(orderPayment)
            .where(eq(orderPayment.orderId, invoiceRow.orderId))
            .orderBy(desc(orderPayment.createdAt))
        : Promise.resolve([]),
    ]);

    return {
      ...invoiceRow,
      order: orderRow,
      customer: customerRow,
      tax,
      items,
      payments,
    };
  }
}
