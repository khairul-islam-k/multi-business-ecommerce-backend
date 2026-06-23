import { and, eq } from "drizzle-orm";

import { supplierProductMap } from "@/database/schema";
import { Injectable, NotFoundException } from "@nestjs/common";

import { DatabaseService } from "../../../database/database.service";

@Injectable()
export class SupplierProductRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async assertSupplierProductMapExists(
    businessId: string,
    supplierId: string,
    productMapId: string,
  ) {
    const [productMap] = await this.db
      .select({
        id: supplierProductMap.id,
        productId: supplierProductMap.productId,
        variantId: supplierProductMap.variantId,
      })
      .from(supplierProductMap)
      .where(
        and(
          eq(supplierProductMap.id, productMapId),
          eq(supplierProductMap.businessId, businessId),
          eq(supplierProductMap.supplierId, supplierId),
        ),
      );

    if (!productMap) {
      throw new NotFoundException("Supplier product not found");
    }

    return productMap;
  }
}
