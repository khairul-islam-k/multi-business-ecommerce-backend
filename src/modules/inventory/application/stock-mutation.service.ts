import { BadRequestException, Injectable } from "@nestjs/common";
import {
  InventoryMovementType,
  InventoryReferenceType,
  Prisma,
} from "@prisma/client";

import { normalizeOptionalText } from "../../../common/text/normalizers";
import { StockItemRef } from "../common/inventory.types";
import { buildStockItemKey } from "../domain/stock-item-key";

@Injectable()
export class StockMutationService {
  async applyStockDelta(
    tx: Prisma.TransactionClient,
    params: StockItemRef & {
      warehouseId: string;
      quantityDelta: Prisma.Decimal.Value;
      movementType: InventoryMovementType;
      referenceType?: InventoryReferenceType;
      referenceId?: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    const quantityDelta = new Prisma.Decimal(params.quantityDelta);
    const stockItemKey = buildStockItemKey(params.productId, params.variantId);

    if (quantityDelta.isZero()) {
      throw new BadRequestException("Stock movement quantity is required");
    }

    const stock = await tx.inventoryStock.upsert({
      where: {
        businessId_stockItemKey: {
          businessId: params.businessId,
          stockItemKey,
        },
      },
      update: {},
      create: {
        businessId: params.businessId,
        productId: params.productId,
        variantId: params.variantId ?? null,
        stockItemKey,
      },
    });

    const existingWarehouseStock = await tx.inventoryWarehouseStock.findUnique({
      where: {
        businessId_warehouseId_stockItemKey: {
          businessId: params.businessId,
          warehouseId: params.warehouseId,
          stockItemKey,
        },
      },
    });

    const nextStockTotal = stock.totalQuantity.plus(quantityDelta);
    const currentWarehouseTotal =
      existingWarehouseStock?.totalQuantity ?? new Prisma.Decimal(0);
    const currentWarehouseReserved =
      existingWarehouseStock?.quantityReserved ?? new Prisma.Decimal(0);
    const nextWarehouseTotal = currentWarehouseTotal.plus(quantityDelta);

    if (nextStockTotal.lessThan(0) || nextWarehouseTotal.lessThan(0)) {
      throw new BadRequestException("Stock cannot be negative");
    }

    if (quantityDelta.lessThan(0)) {
      const availableStockQuantity = stock.totalQuantity.minus(
        stock.quantityReserved,
      );
      const availableWarehouseQuantity = currentWarehouseTotal.minus(
        currentWarehouseReserved,
      );

      if (
        availableStockQuantity.plus(quantityDelta).lessThan(0) ||
        availableWarehouseQuantity.plus(quantityDelta).lessThan(0)
      ) {
        throw new BadRequestException("Available stock is insufficient");
      }
    }

    const updatedStock = await tx.inventoryStock.update({
      where: { id: stock.id },
      data: { totalQuantity: nextStockTotal },
    });

    await tx.inventoryWarehouseStock.upsert({
      where: {
        businessId_warehouseId_stockItemKey: {
          businessId: params.businessId,
          warehouseId: params.warehouseId,
          stockItemKey,
        },
      },
      update: { totalQuantity: nextWarehouseTotal },
      create: {
        businessId: params.businessId,
        stockId: stock.id,
        warehouseId: params.warehouseId,
        productId: params.productId,
        variantId: params.variantId ?? null,
        stockItemKey,
        totalQuantity: nextWarehouseTotal,
      },
    });

    await tx.inventoryStockMovement.create({
      data: {
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
      },
    });

    return updatedStock;
  }
}
