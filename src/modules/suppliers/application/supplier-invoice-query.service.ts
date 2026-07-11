import { and, count, desc, eq, exists, ilike, isNull, or } from "drizzle-orm";

import {
  supplier,
  supplierInvoice,
  supplierPurchaseOrder,
} from "@/database/schema";
import { Injectable, NotFoundException } from "@nestjs/common";

import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import {
  normalizeSearch,
  normalizeSearchUuid,
} from "../../../common/http/search.util";
import { DatabaseService } from "../../../database/database.service";
import { QuerySupplierInvoiceDto } from "../dto/supplier.dto";
import { SupplierInvoiceRepository } from "../infrastructure/supplier-invoice.repository";

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
    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);
    const where = and(
      eq(supplierInvoice.businessId, businessId),
      isNull(supplierInvoice.deletedAt),
      query.supplierId
        ? eq(supplierInvoice.supplierId, query.supplierId)
        : undefined,
      query.status ? eq(supplierInvoice.status, query.status) : undefined,
      search
        ? or(
            searchUuid ? eq(supplierInvoice.id, searchUuid) : undefined,
            searchUuid ? eq(supplierInvoice.supplierId, searchUuid) : undefined,
            searchUuid
              ? eq(supplierInvoice.purchaseOrderId, searchUuid)
              : undefined,
            ilike(supplierInvoice.invoiceNo, `%${search}%`),
            ilike(supplierInvoice.note, `%${search}%`),
            exists(
              this.db
                .select({ id: supplierPurchaseOrder.id })
                .from(supplierPurchaseOrder)
                .where(
                  and(
                    eq(
                      supplierPurchaseOrder.id,
                      supplierInvoice.purchaseOrderId,
                    ),
                    eq(supplierPurchaseOrder.businessId, businessId),
                    ilike(supplierPurchaseOrder.purchaseOrderNo, `%${search}%`),
                    isNull(supplierPurchaseOrder.deletedAt),
                  ),
                ),
            ),
            exists(
              this.db
                .select({ id: supplier.id })
                .from(supplier)
                .where(
                  and(
                    eq(supplier.id, supplierInvoice.supplierId),
                    eq(supplier.businessId, businessId),
                    isNull(supplier.deletedAt),
                    or(
                      ilike(supplier.name, `%${search}%`),
                      ilike(supplier.companyName, `%${search}%`),
                      ilike(supplier.email, `%${search}%`),
                      ilike(supplier.phone, `%${search}%`),
                    ),
                  ),
                ),
            ),
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

    return paginatedResponse(
      items,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Supplier invoices were loaded successfully. The response includes the requested page of supplier invoice records and pagination metadata for browsing more results.",
    );
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
