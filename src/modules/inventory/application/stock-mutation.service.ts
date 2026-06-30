import Decimal from "decimal.js";
import { and, eq } from "drizzle-orm";

import {
  businessSetting,
  InventoryMovementType,
  InventoryReferenceType,
  InventoryStock,
  inventoryStock,
  inventoryStockMovement,
  inventoryWarehouseStock,
} from "@/database/schema";
import { BadRequestException, Injectable } from "@nestjs/common";

import { normalizeOptionalText } from "../../../common/text/normalizers";
import { StockItemRef } from "../common/inventory.types";
import { buildStockItemKey } from "../domain/stock-item-key";

import type { DatabaseTransaction } from "../../../database/database.service";

@Injectable()
export class StockMutationService {
  async applyStockDelta(
    tx: DatabaseTransaction,
    params: StockItemRef & {
      warehouseId: string;
      quantityDelta: Decimal.Value;
      movementType: InventoryMovementType;
      referenceType?: InventoryReferenceType;
      referenceId?: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    const quantityDelta = new Decimal(params.quantityDelta);
    const stockItemKey = buildStockItemKey(params.productId, params.variantId);

    if (quantityDelta.isZero()) {
      throw new BadRequestException("Stock movement quantity is required");
    }

    const stock = await this.getOrCreateStock(tx, {
      businessId: params.businessId,
      productId: params.productId,
      variantId: params.variantId,
      stockItemKey,
    });

    const [existingWarehouseStock] = await tx
      .select()
      .from(inventoryWarehouseStock)
      .where(
        and(
          eq(inventoryWarehouseStock.businessId, params.businessId),
          eq(inventoryWarehouseStock.warehouseId, params.warehouseId),
          eq(inventoryWarehouseStock.stockItemKey, stockItemKey),
        ),
      );

    const nextStockTotal = new Decimal(stock.totalQuantity).plus(quantityDelta);
    const currentWarehouseTotal =
      existingWarehouseStock?.totalQuantity ?? new Decimal(0);
    const currentWarehouseReserved =
      existingWarehouseStock?.quantityReserved ?? new Decimal(0);
    const nextWarehouseTotal = new Decimal(currentWarehouseTotal).plus(
      quantityDelta,
    );

    if (nextStockTotal.lessThan(0) || nextWarehouseTotal.lessThan(0)) {
      throw new BadRequestException("Stock cannot be negative");
    }

    if (quantityDelta.lessThan(0)) {
      const availableStockQuantity = new Decimal(stock.totalQuantity).minus(
        stock.quantityReserved,
      );
      const availableWarehouseQuantity = new Decimal(
        currentWarehouseTotal,
      ).minus(currentWarehouseReserved);

      if (
        availableStockQuantity.plus(quantityDelta).lessThan(0) ||
        availableWarehouseQuantity.plus(quantityDelta).lessThan(0)
      ) {
        throw new BadRequestException("Available stock is insufficient");
      }
    }

    const [updatedStock] = await tx
      .update(inventoryStock)
      .set({ totalQuantity: nextStockTotal })
      .where(eq(inventoryStock.id, stock.id))
      .returning();

    if (existingWarehouseStock) {
      await tx
        .update(inventoryWarehouseStock)
        .set({ totalQuantity: nextWarehouseTotal })
        .where(eq(inventoryWarehouseStock.id, existingWarehouseStock.id));
    } else {
      await tx.insert(inventoryWarehouseStock).values({
        businessId: params.businessId,
        stockId: stock.id,
        warehouseId: params.warehouseId,
        productId: params.productId,
        variantId: params.variantId ?? null,
        stockItemKey,
        totalQuantity: nextWarehouseTotal,
        quantityReserved: new Decimal(0),
      });
    }

    await tx.insert(inventoryStockMovement).values({
      businessId: params.businessId,
      stockId: stock.id,
      warehouseId: params.warehouseId,
      productId: params.productId,
      variantId: params.variantId ?? null,
      stockItemKey,
      movementType: params.movementType,
      quantity: quantityDelta.abs(),
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      note: normalizeOptionalText(params.note),
      createdBy: params.createdBy,
    });

    return updatedStock;
  }

  private async getOrCreateStock(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      productId: string;
      variantId?: string | null;
      stockItemKey: string;
    },
  ): Promise<InventoryStock> {
    const lowStockAlertQty = await this.resolveLowStockThreshold(
      tx,
      params.businessId,
    );
    const [stock] = await tx
      .insert(inventoryStock)
      .values({
        businessId: params.businessId,
        productId: params.productId,
        variantId: params.variantId ?? null,
        stockItemKey: params.stockItemKey,
        lowStockAlertQty,
        quantityReserved: new Decimal(0),
        totalQuantity: new Decimal(0),
      })
      .onConflictDoUpdate({
        target: [inventoryStock.businessId, inventoryStock.stockItemKey],
        set: { stockItemKey: params.stockItemKey },
      })
      .returning();

    return stock;
  }

  private async resolveLowStockThreshold(
    tx: DatabaseTransaction,
    businessId: string,
  ) {
    const [settings] = await tx
      .select({ lowStockThreshold: businessSetting.lowStockThreshold })
      .from(businessSetting)
      .where(eq(businessSetting.businessId, businessId))
      .limit(1);

    return new Decimal(settings?.lowStockThreshold ?? 0);
  }
}
