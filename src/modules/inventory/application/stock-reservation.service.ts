import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type InventoryStock,
  type InventoryWarehouseStock,
  InventoryMovementType,
  InventoryOrderAllocationStatus,
  InventoryReferenceType,
  WarehouseStatus,
  inventoryOrderAllocation,
  inventoryStock,
  inventoryStockMovement,
  inventoryWarehouseStock,
  warehouse,
} from "@/database/schema";
import Decimal from "decimal.js";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../../../database/database.service";
import { buildStockItemKey } from "../domain/stock-item-key";
import { normalizeOptionalText } from "../../../common/text/normalizers";
import { StockItemRef } from "../common/inventory.types";

@Injectable()
export class StockReservationService {
  async reserveForOrder(
    tx: DatabaseTransaction,
    params: StockItemRef & {
      orderId: string;
      orderItemId: string;
      quantity: Decimal.Value;
      warehouseId?: string | null;
      createdBy?: string;
    },
  ) {
    const quantity = new Decimal(params.quantity);
    const stockItemKey = buildStockItemKey(params.productId, params.variantId);

    if (quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Reservation quantity is required");
    }

    const stock = await this.getStockByItemKey(tx, {
      businessId: params.businessId,
      stockItemKey,
    });

    const warehouseStock = params.warehouseId
      ? await this.findManualWarehouseStock(tx, {
          businessId: params.businessId,
          warehouseId: params.warehouseId,
          stockItemKey,
          quantity,
        })
      : await this.findAutoWarehouseStock(tx, {
          businessId: params.businessId,
          stockItemKey,
          quantity,
        });

    const [allocation] = await tx
      .insert(inventoryOrderAllocation)
      .values({
        businessId: params.businessId,
        orderId: params.orderId,
        orderItemId: params.orderItemId,
        stockId: stock.id,
        warehouseId: warehouseStock.warehouseId,
        productId: params.productId,
        variantId: params.variantId ?? null,
        stockItemKey,
        quantity,
        status: InventoryOrderAllocationStatus.RESERVED,
        createdBy: params.createdBy,
      })
      .returning();

    await this.reserveAvailableQuantity(
      tx,
      stock.id,
      warehouseStock.id,
      quantity,
    );

    await tx.insert(inventoryStockMovement).values({
      businessId: params.businessId,
      stockId: stock.id,
      warehouseId: warehouseStock.warehouseId,
      productId: params.productId,
      variantId: params.variantId ?? null,
      stockItemKey,
      movementType: InventoryMovementType.RESERVED,
      quantity,
      referenceType: InventoryReferenceType.ORDER,
      referenceId: params.orderId,
      createdBy: params.createdBy,
    });

    return allocation;
  }

  async reserveStock(
    tx: DatabaseTransaction,
    params: StockItemRef & {
      warehouseId: string;
      quantity: Decimal.Value;
      referenceType: InventoryReferenceType;
      referenceId: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    const quantity = new Decimal(params.quantity);
    const stockItemKey = buildStockItemKey(params.productId, params.variantId);

    if (quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Reservation quantity is required");
    }

    const stock = await this.getStockByItemKey(tx, {
      businessId: params.businessId,
      stockItemKey,
    });

    const warehouseStock = await this.findManualWarehouseStock(tx, {
      businessId: params.businessId,
      warehouseId: params.warehouseId,
      stockItemKey,
      quantity,
    });

    await this.reserveAvailableQuantity(
      tx,
      stock.id,
      warehouseStock.id,
      quantity,
    );

    await tx.insert(inventoryStockMovement).values({
      businessId: params.businessId,
      stockId: stock.id,
      warehouseId: warehouseStock.warehouseId,
      productId: params.productId,
      variantId: params.variantId ?? null,
      stockItemKey,
      movementType: InventoryMovementType.RESERVED,
      quantity,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      note: normalizeOptionalText(params.note),
      createdBy: params.createdBy,
    });

    return stock;
  }

  async releaseStockReservation(
    tx: DatabaseTransaction,
    params: StockItemRef & {
      warehouseId: string;
      quantity: Decimal.Value;
      referenceType: InventoryReferenceType;
      referenceId: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    const quantity = new Decimal(params.quantity);
    const stockItemKey = buildStockItemKey(params.productId, params.variantId);

    if (quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Reservation quantity is required");
    }

    const { stock, warehouseStock } = await this.getReservedStockPair(tx, {
      businessId: params.businessId,
      warehouseId: params.warehouseId,
      stockItemKey,
      quantity,
    });

    await this.releaseReservedQuantity(tx, stock, warehouseStock, quantity);

    await tx.insert(inventoryStockMovement).values({
      businessId: params.businessId,
      stockId: stock.id,
      warehouseId: warehouseStock.warehouseId,
      productId: params.productId,
      variantId: params.variantId ?? null,
      stockItemKey,
      movementType: InventoryMovementType.RESERVATION_RELEASED,
      quantity,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      note: normalizeOptionalText(params.note),
      createdBy: params.createdBy,
    });

    return stock;
  }

  async deductReservedStock(
    tx: DatabaseTransaction,
    params: StockItemRef & {
      warehouseId: string;
      quantity: Decimal.Value;
      movementType: InventoryMovementType;
      referenceType: InventoryReferenceType;
      referenceId: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    const quantity = new Decimal(params.quantity);
    const stockItemKey = buildStockItemKey(params.productId, params.variantId);

    if (quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Stock movement quantity is required");
    }

    const { stock, warehouseStock } = await this.getReservedStockPair(tx, {
      businessId: params.businessId,
      warehouseId: params.warehouseId,
      stockItemKey,
      quantity,
    });

    if (
      new Decimal(stock.totalQuantity).lessThan(quantity) ||
      new Decimal(warehouseStock.totalQuantity).lessThan(quantity)
    ) {
      throw new BadRequestException("Reserved stock is insufficient");
    }

    const updatedStock = await this.deductReservedQuantity(
      tx,
      stock.id,
      warehouseStock.id,
      quantity,
    );

    await tx.insert(inventoryStockMovement).values({
      businessId: params.businessId,
      stockId: stock.id,
      warehouseId: warehouseStock.warehouseId,
      productId: params.productId,
      variantId: params.variantId ?? null,
      stockItemKey,
      movementType: params.movementType,
      quantity,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      note: normalizeOptionalText(params.note),
      createdBy: params.createdBy,
    });

    return updatedStock;
  }

  async releaseOrderReservation(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      allocationId: string;
    },
    userId?: string,
  ) {
    const { allocation, stock } = await this.getReservedAllocation(tx, params);
    const warehouseStock = await this.getWarehouseStockByItemKey(tx, {
      businessId: allocation.businessId,
      warehouseId: allocation.warehouseId,
      stockItemKey: allocation.stockItemKey,
    });

    await this.releaseReservedQuantity(
      tx,
      stock,
      warehouseStock,
      allocation.quantity,
    );

    await tx.insert(inventoryStockMovement).values({
      businessId: allocation.businessId,
      stockId: allocation.stockId,
      warehouseId: allocation.warehouseId,
      productId: allocation.productId,
      variantId: allocation.variantId,
      stockItemKey: allocation.stockItemKey,
      movementType: InventoryMovementType.RESERVATION_RELEASED,
      quantity: allocation.quantity,
      referenceType: InventoryReferenceType.ORDER,
      referenceId: allocation.orderId,
      createdBy: userId,
    });

    const [updatedAllocation] = await tx
      .update(inventoryOrderAllocation)
      .set({
        status: InventoryOrderAllocationStatus.RELEASED,
        releasedAt: new Date(),
      })
      .where(eq(inventoryOrderAllocation.id, allocation.id))
      .returning();

    return updatedAllocation;
  }

  async fulfillOrderAllocation(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      allocationId: string;
    },
    userId?: string,
  ) {
    const { allocation, stock } = await this.getReservedAllocation(tx, params);
    const warehouseStock = await this.getWarehouseStockByItemKey(tx, {
      businessId: allocation.businessId,
      warehouseId: allocation.warehouseId,
      stockItemKey: allocation.stockItemKey,
    });

    await this.deductReservedQuantity(
      tx,
      allocation.stockId,
      warehouseStock.id,
      allocation.quantity,
    );

    await tx.insert(inventoryStockMovement).values({
      businessId: allocation.businessId,
      stockId: allocation.stockId,
      warehouseId: allocation.warehouseId,
      productId: allocation.productId,
      variantId: allocation.variantId,
      stockItemKey: allocation.stockItemKey,
      movementType: InventoryMovementType.SALE_OUT,
      quantity: allocation.quantity,
      referenceType: InventoryReferenceType.ORDER,
      referenceId: allocation.orderId,
      createdBy: userId,
    });

    const [updatedAllocation] = await tx
      .update(inventoryOrderAllocation)
      .set({
        status: InventoryOrderAllocationStatus.FULFILLED,
        fulfilledAt: new Date(),
      })
      .where(eq(inventoryOrderAllocation.id, allocation.id))
      .returning();

    return updatedAllocation;
  }

  private async getStockByItemKey(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      stockItemKey: string;
    },
  ) {
    const [stock] = await tx
      .select()
      .from(inventoryStock)
      .where(
        and(
          eq(inventoryStock.businessId, params.businessId),
          eq(inventoryStock.stockItemKey, params.stockItemKey),
        ),
      );

    if (!stock) {
      throw new BadRequestException("Stock is not available for this item");
    }

    return stock;
  }

  private async findManualWarehouseStock(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      warehouseId: string;
      stockItemKey: string;
      quantity: Decimal;
    },
  ) {
    const [warehouseRow] = await tx
      .select({ id: warehouse.id })
      .from(warehouse)
      .where(
        and(
          eq(warehouse.id, params.warehouseId),
          eq(warehouse.businessId, params.businessId),
          isNull(warehouse.deletedAt),
          eq(warehouse.status, WarehouseStatus.ACTIVE),
        ),
      );

    if (!warehouseRow) {
      throw new NotFoundException("Warehouse not found");
    }

    const warehouseStock = await this.getWarehouseStockByItemKey(tx, params);
    const availableQuantity = new Decimal(warehouseStock.totalQuantity).minus(
      warehouseStock.quantityReserved,
    );

    if (availableQuantity.lessThan(params.quantity)) {
      throw new BadRequestException(
        "Selected warehouse has insufficient available stock",
      );
    }

    return warehouseStock;
  }

  private async getReservedStockPair(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      warehouseId: string;
      stockItemKey: string;
      quantity: Decimal;
    },
  ) {
    const stock = await this.getStockByItemKey(tx, params);
    const warehouseStock = await this.getWarehouseStockByItemKey(tx, params);

    if (
      new Decimal(stock.quantityReserved).lessThan(params.quantity) ||
      new Decimal(warehouseStock.quantityReserved).lessThan(params.quantity)
    ) {
      throw new BadRequestException("Reserved stock is insufficient");
    }

    return { stock, warehouseStock };
  }

  private async findAutoWarehouseStock(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      stockItemKey: string;
      quantity: Decimal;
    },
  ) {
    const warehouseStocks = await tx
      .select({
        warehouseStock: inventoryWarehouseStock,
        warehouseCreatedAt: warehouse.createdAt,
      })
      .from(inventoryWarehouseStock)
      .innerJoin(
        warehouse,
        eq(warehouse.id, inventoryWarehouseStock.warehouseId),
      )
      .where(
        and(
          eq(inventoryWarehouseStock.businessId, params.businessId),
          eq(inventoryWarehouseStock.stockItemKey, params.stockItemKey),
          isNull(warehouse.deletedAt),
          eq(warehouse.status, WarehouseStatus.ACTIVE),
        ),
      )
      .orderBy(asc(warehouse.createdAt));

    const selectedWarehouseStock = warehouseStocks
      .map(({ warehouseStock, warehouseCreatedAt }) => ({
        ...warehouseStock,
        warehouseCreatedAt,
        availableQuantity: new Decimal(warehouseStock.totalQuantity).minus(
          warehouseStock.quantityReserved,
        ),
      }))
      .filter((warehouseStock) =>
        warehouseStock.availableQuantity.greaterThanOrEqualTo(params.quantity),
      )
      .sort((left, right) => {
        const quantityComparison = right.availableQuantity.comparedTo(
          left.availableQuantity,
        );

        if (quantityComparison !== 0) {
          return quantityComparison;
        }

        return (
          left.warehouseCreatedAt.getTime() - right.warehouseCreatedAt.getTime()
        );
      })[0];

    if (!selectedWarehouseStock) {
      throw new BadRequestException("No warehouse has enough available stock");
    }

    return selectedWarehouseStock;
  }

  private async getWarehouseStockByItemKey(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      warehouseId: string;
      stockItemKey: string;
    },
  ) {
    const [warehouseStock] = await tx
      .select()
      .from(inventoryWarehouseStock)
      .where(
        and(
          eq(inventoryWarehouseStock.businessId, params.businessId),
          eq(inventoryWarehouseStock.warehouseId, params.warehouseId),
          eq(inventoryWarehouseStock.stockItemKey, params.stockItemKey),
        ),
      );

    if (!warehouseStock) {
      throw new NotFoundException("Warehouse stock not found");
    }

    return warehouseStock;
  }

  private async getReservedAllocation(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      allocationId: string;
    },
  ) {
    const [row] = await tx
      .select({
        allocation: inventoryOrderAllocation,
        stock: inventoryStock,
      })
      .from(inventoryOrderAllocation)
      .innerJoin(
        inventoryStock,
        eq(inventoryStock.id, inventoryOrderAllocation.stockId),
      )
      .where(
        and(
          eq(inventoryOrderAllocation.id, params.allocationId),
          eq(inventoryOrderAllocation.businessId, params.businessId),
          eq(
            inventoryOrderAllocation.status,
            InventoryOrderAllocationStatus.RESERVED,
          ),
        ),
      );

    if (!row) {
      throw new NotFoundException("Reserved allocation not found");
    }

    return row;
  }

  private async releaseReservedQuantity(
    tx: DatabaseTransaction,
    stock: InventoryStock,
    warehouseStock: InventoryWarehouseStock,
    quantity: Decimal.Value,
  ) {
    const [updatedStock] = await tx
      .update(inventoryStock)
      .set({
        quantityReserved: sql`${inventoryStock.quantityReserved} - ${new Decimal(quantity).toString()}`,
      })
      .where(
        and(
          eq(inventoryStock.id, stock.id),
          sql`${inventoryStock.quantityReserved} >= ${new Decimal(quantity).toString()}`,
        ),
      )
      .returning({ id: inventoryStock.id });

    if (!updatedStock) {
      throw new BadRequestException("Reserved stock is insufficient");
    }

    const [updatedWarehouseStock] = await tx
      .update(inventoryWarehouseStock)
      .set({
        quantityReserved: sql`${inventoryWarehouseStock.quantityReserved} - ${new Decimal(quantity).toString()}`,
      })
      .where(
        and(
          eq(inventoryWarehouseStock.id, warehouseStock.id),
          sql`${inventoryWarehouseStock.quantityReserved} >= ${new Decimal(quantity).toString()}`,
        ),
      )
      .returning({ id: inventoryWarehouseStock.id });

    if (!updatedWarehouseStock) {
      throw new BadRequestException("Reserved warehouse stock is insufficient");
    }
  }

  private async reserveAvailableQuantity(
    tx: DatabaseTransaction,
    stockId: string,
    warehouseStockId: string,
    quantity: Decimal,
  ) {
    const [updatedWarehouseStock] = await tx
      .update(inventoryWarehouseStock)
      .set({
        quantityReserved: sql`${inventoryWarehouseStock.quantityReserved} + ${quantity.toString()}`,
      })
      .where(
        and(
          eq(inventoryWarehouseStock.id, warehouseStockId),
          sql`${inventoryWarehouseStock.totalQuantity} - ${inventoryWarehouseStock.quantityReserved} >= ${quantity.toString()}`,
        ),
      )
      .returning({ id: inventoryWarehouseStock.id });

    if (!updatedWarehouseStock) {
      throw new BadRequestException(
        "Selected warehouse has insufficient available stock",
      );
    }

    const [updatedStock] = await tx
      .update(inventoryStock)
      .set({
        quantityReserved: sql`${inventoryStock.quantityReserved} + ${quantity.toString()}`,
      })
      .where(
        and(
          eq(inventoryStock.id, stockId),
          sql`${inventoryStock.totalQuantity} - ${inventoryStock.quantityReserved} >= ${quantity.toString()}`,
        ),
      )
      .returning({ id: inventoryStock.id });

    if (!updatedStock) {
      throw new BadRequestException("Available stock is insufficient");
    }
  }

  private async deductReservedQuantity(
    tx: DatabaseTransaction,
    stockId: string,
    warehouseStockId: string,
    quantity: Decimal.Value,
  ) {
    const amount = new Decimal(quantity).toString();
    const [updatedWarehouseStock] = await tx
      .update(inventoryWarehouseStock)
      .set({
        totalQuantity: sql`${inventoryWarehouseStock.totalQuantity} - ${amount}`,
        quantityReserved: sql`${inventoryWarehouseStock.quantityReserved} - ${amount}`,
      })
      .where(
        and(
          eq(inventoryWarehouseStock.id, warehouseStockId),
          sql`${inventoryWarehouseStock.totalQuantity} >= ${amount}`,
          sql`${inventoryWarehouseStock.quantityReserved} >= ${amount}`,
        ),
      )
      .returning({ id: inventoryWarehouseStock.id });

    if (!updatedWarehouseStock) {
      throw new BadRequestException("Reserved warehouse stock is insufficient");
    }

    const [updatedStock] = await tx
      .update(inventoryStock)
      .set({
        totalQuantity: sql`${inventoryStock.totalQuantity} - ${amount}`,
        quantityReserved: sql`${inventoryStock.quantityReserved} - ${amount}`,
      })
      .where(
        and(
          eq(inventoryStock.id, stockId),
          sql`${inventoryStock.totalQuantity} >= ${amount}`,
          sql`${inventoryStock.quantityReserved} >= ${amount}`,
        ),
      )
      .returning();

    if (!updatedStock) {
      throw new BadRequestException("Reserved stock is insufficient");
    }

    return updatedStock;
  }
}
