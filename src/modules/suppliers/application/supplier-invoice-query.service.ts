import { Injectable, NotFoundException } from "@nestjs/common";
import { supplierInvoice } from "@/database/schema";
import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

import { QuerySupplierInvoiceDto } from "../dto/supplier.dto";
import { SupplierInvoiceRepository } from "../infrastructure/supplier-invoice.repository";
import { DatabaseService } from "../../../database/database.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";

@Injectable()
export class SupplierInvoiceQueryService {
  constructor(
    private readonly database: DatabaseService,
    private readonly invoices: SupplierInvoiceRepository,
  ) {}

  private get db() {
    return this.database.db;
  }

  async findSupplierInvoices(
    businessId: string,
    query: QuerySupplierInvoiceDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(supplierInvoice.businessId, businessId),
      isNull(supplierInvoice.deletedAt),
      query.supplierId
        ? eq(supplierInvoice.supplierId, query.supplierId)
        : undefined,
      query.status ? eq(supplierInvoice.status, query.status) : undefined,
      query.search
        ? or(
            ilike(supplierInvoice.invoiceNo, `%${query.search}%`),
            ilike(supplierInvoice.note, `%${query.search}%`),
          )
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(supplierInvoice)
        .where(where)
        .orderBy(desc(supplierInvoice.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(supplierInvoice)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);
    const items = await Promise.all(
      rows.map((invoice) => this.invoices.hydrate(invoice)),
    );

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findSupplierInvoice(businessId: string, supplierInvoiceId: string) {
    const [invoice] = await this.db
      .select()
      .from(supplierInvoice)
      .where(
        and(
          eq(supplierInvoice.id, supplierInvoiceId),
          eq(supplierInvoice.businessId, businessId),
          isNull(supplierInvoice.deletedAt),
        ),
      );

    if (!invoice) {
      throw new NotFoundException("Supplier invoice not found");
    }

    return apiResponse(await this.invoices.hydrate(invoice));
  }
}
