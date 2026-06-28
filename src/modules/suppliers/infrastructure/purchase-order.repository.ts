import { and, asc, desc, eq, isNull } from "drizzle-orm";

import {
  financeTax,
  inventoryStock,
  product,
  productVariant,
  supplier,
  supplierInvoice,
  SupplierPurchaseOrder,
  supplierPurchaseOrder,
  supplierPurchaseOrderItem,
  warehouse,
} from "@/database/schema";
import { Injectable, NotFoundException } from "@nestjs/common";

import { DatabaseService } from "../../../database/database.service";

@Injectable()
export class PurchaseOrderRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async getPurchaseOrderOrThrow(businessId: string, purchaseOrderId: string) {
    const [purchaseOrder] = await this.db
      .select()
      .from(supplierPurchaseOrder)
      .where(
        and(
          eq(supplierPurchaseOrder.id, purchaseOrderId),
          eq(supplierPurchaseOrder.businessId, businessId),
          isNull(supplierPurchaseOrder.deletedAt),
        ),
      );

    if (!purchaseOrder) {
      throw new NotFoundException(
        "Purchase order could not be found. It may not exist, may have been deleted, or may not belong to the current business.",
      );
    }

    return this.hydrate(purchaseOrder);
  }

  async hydrate(purchaseOrder: SupplierPurchaseOrder) {
    const [supplierRow, tax, items, invoices, warehouseRow] = await Promise.all(
      [
        this.db
          .select()
          .from(supplier)
          .where(eq(supplier.id, purchaseOrder.supplierId))
          .then(([row]) => row ?? null),
        purchaseOrder.taxId
          ? this.db
              .select()
              .from(financeTax)
              .where(eq(financeTax.id, purchaseOrder.taxId))
              .then(([row]) => row ?? null)
          : Promise.resolve(null),
        this.db
          .select()
          .from(supplierPurchaseOrderItem)
          .where(
            eq(supplierPurchaseOrderItem.purchaseOrderId, purchaseOrder.id),
          )
          .orderBy(asc(supplierPurchaseOrderItem.createdAt)),
        this.db
          .select()
          .from(supplierInvoice)
          .where(eq(supplierInvoice.purchaseOrderId, purchaseOrder.id))
          .orderBy(desc(supplierInvoice.createdAt)),
        this.db
          .select()
          .from(warehouse)
          .where(eq(warehouse.id, purchaseOrder.warehouseId))
          .then(([row]) => row ?? null),
      ],
    );

    const hydratedItems = await Promise.all(
      items.map(async (item) => {
        const [productRow, variantRow] = await Promise.all([
          this.db
            .select()
            .from(product)
            .where(eq(product.id, item.productId))
            .then(([row]) => row ?? null),
          item.variantId
            ? this.db
                .select()
                .from(productVariant)
                .where(eq(productVariant.id, item.variantId))
                .then(([row]) => row ?? null)
            : Promise.resolve(null),
        ]);
        const [productStocks, variantStocks] = await Promise.all([
          this.db
            .select()
            .from(inventoryStock)
            .where(eq(inventoryStock.productId, item.productId)),
          item.variantId
            ? this.db
                .select()
                .from(inventoryStock)
                .where(eq(inventoryStock.variantId, item.variantId))
            : Promise.resolve([]),
        ]);

        return {
          ...item,
          product: productRow ? { ...productRow, productStocks } : null,
          variant: variantRow ? { ...variantRow, variantStocks } : null,
        };
      }),
    );

    return {
      ...purchaseOrder,
      supplier: supplierRow,
      tax,
      warehouse: warehouseRow,
      items: hydratedItems,
      invoices,
    };
  }
}
