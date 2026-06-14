import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { QuerySupplierInvoiceDto } from "../dto/supplier.dto";
import { SUPPLIER_INVOICE_INCLUDE } from "../infrastructure/supplier.selects";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";

@Injectable()
export class SupplierInvoiceQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findSupplierInvoices(
    businessId: string,
    query: QuerySupplierInvoiceDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierInvoiceWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { invoiceNo: { contains: query.search, mode: "insensitive" } },
              { note: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.supplierInvoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: SUPPLIER_INVOICE_INCLUDE,
      }),
      this.prisma.supplierInvoice.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findSupplierInvoice(businessId: string, supplierInvoiceId: string) {
    const invoice = await this.prisma.supplierInvoice.findFirst({
      where: { id: supplierInvoiceId, businessId, deletedAt: null },
      include: SUPPLIER_INVOICE_INCLUDE,
    });

    if (!invoice) {
      throw new NotFoundException("Supplier invoice not found");
    }

    return apiResponse(invoice);
  }
}
