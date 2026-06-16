import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type Supplier,
  SupplierStatus,
  supplier,
  supplierInvoice,
  supplierProductMap,
  supplierPurchaseOrder,
} from "@/database/schema";
import { and, count, eq, isNull } from "drizzle-orm";

import { DatabaseService } from "../../../database/database.service";

@Injectable()
export class SupplierRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async assertSupplierExists(
    businessId: string,
    supplierId: string,
    requireActive = false,
  ) {
    const [supplierRow] = await this.db
      .select({ id: supplier.id })
      .from(supplier)
      .where(
        and(
          eq(supplier.id, supplierId),
          eq(supplier.businessId, businessId),
          isNull(supplier.deletedAt),
          requireActive ? eq(supplier.status, SupplierStatus.ACTIVE) : undefined,
        ),
      );

    if (!supplierRow) {
      throw new NotFoundException("Supplier not found");
    }
  }

  async assertSupplierCanBeDeleted(businessId: string, supplierId: string) {
    const referenceCounts = await Promise.all([
      this.db
        .select({ value: count() })
        .from(supplierPurchaseOrder)
        .where(
          and(
            eq(supplierPurchaseOrder.businessId, businessId),
            eq(supplierPurchaseOrder.supplierId, supplierId),
            isNull(supplierPurchaseOrder.deletedAt),
          ),
        )
        .then(([row]) => row?.value ?? 0),
      this.db
        .select({ value: count() })
        .from(supplierInvoice)
        .where(
          and(
            eq(supplierInvoice.businessId, businessId),
            eq(supplierInvoice.supplierId, supplierId),
            isNull(supplierInvoice.deletedAt),
          ),
        )
        .then(([row]) => row?.value ?? 0),
    ]);

    if (referenceCounts.some((count) => count > 0)) {
      throw new BadRequestException(
        "Supplier cannot be deleted while referenced by purchase records",
      );
    }
  }

  async withCounts(supplierRow: Supplier) {
    const [products, orders] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(supplierProductMap)
        .where(eq(supplierProductMap.supplierId, supplierRow.id))
        .then(([row]) => row?.value ?? 0),
      this.db
        .select({ value: count() })
        .from(supplierPurchaseOrder)
        .where(eq(supplierPurchaseOrder.supplierId, supplierRow.id))
        .then(([row]) => row?.value ?? 0),
    ]);

    return {
      ...supplierRow,
      _count: {
        products,
        orders,
      },
    };
  }
}
