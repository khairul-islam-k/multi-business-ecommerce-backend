import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  InventoryMovementType,
  InventoryOrderAllocationStatus,
  InventoryReferenceType,
  Prisma,
  WarehouseStatus,
} from "@prisma/client";

import { normalizeOptionalText } from "../../../common/text/normalizers";
import { StockItemRef } from "../common/inventory.types";
import { buildStockItemKey } from "../domain/stock-item-key";

@Injectable()
export class StockReservationService {
  async reserveForOrder(
    tx: Prisma.TransactionClient,
    params: StockItemRef & {
      orderId: string;
      orderItemId: string;
      quantity: Prisma.Decimal.Value;
      warehouseId?: string | null;
      createdBy?: string;
    },
  ) {
    const quantity = new Prisma.Decimal(params.quantity);
    const stockItemKey = buildStockItemKey(params.productId, params.variantId);

    if (quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Reservation quantity is required");
    }

    const stock = await tx.inventoryStock.findUnique({
      where: {
        businessId_stockItemKey: {
          businessId: params.businessId,
          stockItemKey,
        },
      },
    });

    if (!stock) {
      throw new BadRequestException("Stock is not available for this item");
    }

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

    const allocation = await tx.inventoryOrderAllocation.create({
      data: {
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
      },
    });

    await tx.inventoryStock.update({
      where: { id: stock.id },
      data: {
        quantityReserved: stock.quantityReserved.plus(quantity),
      },
    });

    await tx.inventoryWarehouseStock.update({
      where: { id: warehouseStock.id },
      data: {
        quantityReserved: warehouseStock.quantityReserved.plus(quantity),
      },
    });

    await tx.inventoryStockMovement.create({
      data: {
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
      },
    });

    return allocation;
  }

  async reserveStock(
    tx: Prisma.TransactionClient,
    params: StockItemRef & {
      warehouseId: string;
      quantity: Prisma.Decimal.Value;
      referenceType: InventoryReferenceType;
      referenceId: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    const quantity = new Prisma.Decimal(params.quantity);
    const stockItemKey = buildStockItemKey(params.productId, params.variantId);

    if (quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Reservation quantity is required");
    }

    const stock = await tx.inventoryStock.findUnique({
      where: {
        businessId_stockItemKey: {
          businessId: params.businessId,
          stockItemKey,
        },
      },
    });

    if (!stock) {
      throw new BadRequestException("Stock is not available for this item");
    }

    const warehouseStock = await this.findManualWarehouseStock(tx, {
      businessId: params.businessId,
      warehouseId: params.warehouseId,
      stockItemKey,
      quantity,
    });

    await tx.inventoryStock.update({
      where: { id: stock.id },
      data: {
        quantityReserved: stock.quantityReserved.plus(quantity),
      },
    });

    await tx.inventoryWarehouseStock.update({
      where: { id: warehouseStock.id },
      data: {
        quantityReserved: warehouseStock.quantityReserved.plus(quantity),
      },
    });

    await tx.inventoryStockMovement.create({
      data: {
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
      },
    });

    return stock;
  }

  async releaseStockReservation(
    tx: Prisma.TransactionClient,
    params: StockItemRef & {
      warehouseId: string;
      quantity: Prisma.Decimal.Value;
      referenceType: InventoryReferenceType;
      referenceId: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    const quantity = new Prisma.Decimal(params.quantity);
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

    await tx.inventoryStock.update({
      where: { id: stock.id },
      data: {
        quantityReserved: stock.quantityReserved.minus(quantity),
      },
    });

    await tx.inventoryWarehouseStock.update({
      where: { id: warehouseStock.id },
      data: {
        quantityReserved: warehouseStock.quantityReserved.minus(quantity),
      },
    });

    await tx.inventoryStockMovement.create({
      data: {
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
      },
    });

    return stock;
  }

  async deductReservedStock(
    tx: Prisma.TransactionClient,
    params: StockItemRef & {
      warehouseId: string;
      quantity: Prisma.Decimal.Value;
      movementType: InventoryMovementType;
      referenceType: InventoryReferenceType;
      referenceId: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    const quantity = new Prisma.Decimal(params.quantity);
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
      stock.totalQuantity.lessThan(quantity) ||
      warehouseStock.totalQuantity.lessThan(quantity)
    ) {
      throw new BadRequestException("Reserved stock is insufficient");
    }

    const updatedStock = await tx.inventoryStock.update({
      where: { id: stock.id },
      data: {
        totalQuantity: stock.totalQuantity.minus(quantity),
        quantityReserved: stock.quantityReserved.minus(quantity),
      },
    });

    await tx.inventoryWarehouseStock.update({
      where: { id: warehouseStock.id },
      data: {
        totalQuantity: warehouseStock.totalQuantity.minus(quantity),
        quantityReserved: warehouseStock.quantityReserved.minus(quantity),
      },
    });

    await tx.inventoryStockMovement.create({
      data: {
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
      },
    });

    return updatedStock;
  }

  async releaseOrderReservation(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      allocationId: string;
    },
    userId?: string,
  ) {
    const allocation = await tx.inventoryOrderAllocation.findUnique({
      where: { id: params.allocationId },
      include: { stock: true },
    });

    if (
      !allocation ||
      allocation.businessId !== params.businessId ||
      allocation.status !== InventoryOrderAllocationStatus.RESERVED
    ) {
      throw new NotFoundException("Reserved allocation not found");
    }

    const warehouseStock = await tx.inventoryWarehouseStock.findUnique({
      where: {
        businessId_warehouseId_stockItemKey: {
          businessId: allocation.businessId,
          warehouseId: allocation.warehouseId,
          stockItemKey: allocation.stockItemKey,
        },
      },
    });

    if (!warehouseStock) {
      throw new NotFoundException("Warehouse stock not found");
    }

    await tx.inventoryStock.update({
      where: { id: allocation.stockId },
      data: {
        quantityReserved: allocation.stock.quantityReserved.minus(
          allocation.quantity,
        ),
      },
    });

    await tx.inventoryWarehouseStock.update({
      where: { id: warehouseStock.id },
      data: {
        quantityReserved: warehouseStock.quantityReserved.minus(
          allocation.quantity,
        ),
      },
    });

    await tx.inventoryStockMovement.create({
      data: {
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
      },
    });

    return tx.inventoryOrderAllocation.update({
      where: { id: allocation.id },
      data: {
        status: InventoryOrderAllocationStatus.RELEASED,
        releasedAt: new Date(),
      },
    });
  }

  async fulfillOrderAllocation(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      allocationId: string;
    },
    userId?: string,
  ) {
    const allocation = await tx.inventoryOrderAllocation.findUnique({
      where: { id: params.allocationId },
      include: { stock: true },
    });

    if (
      !allocation ||
      allocation.businessId !== params.businessId ||
      allocation.status !== InventoryOrderAllocationStatus.RESERVED
    ) {
      throw new NotFoundException("Reserved allocation not found");
    }

    const warehouseStock = await tx.inventoryWarehouseStock.findUnique({
      where: {
        businessId_warehouseId_stockItemKey: {
          businessId: allocation.businessId,
          warehouseId: allocation.warehouseId,
          stockItemKey: allocation.stockItemKey,
        },
      },
    });

    if (!warehouseStock) {
      throw new NotFoundException("Warehouse stock not found");
    }

    await tx.inventoryStock.update({
      where: { id: allocation.stockId },
      data: {
        totalQuantity: allocation.stock.totalQuantity.minus(
          allocation.quantity,
        ),
        quantityReserved: allocation.stock.quantityReserved.minus(
          allocation.quantity,
        ),
      },
    });

    await tx.inventoryWarehouseStock.update({
      where: { id: warehouseStock.id },
      data: {
        totalQuantity: warehouseStock.totalQuantity.minus(allocation.quantity),
        quantityReserved: warehouseStock.quantityReserved.minus(
          allocation.quantity,
        ),
      },
    });

    await tx.inventoryStockMovement.create({
      data: {
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
      },
    });

    return tx.inventoryOrderAllocation.update({
      where: { id: allocation.id },
      data: {
        status: InventoryOrderAllocationStatus.FULFILLED,
        fulfilledAt: new Date(),
      },
    });
  }

  private async findManualWarehouseStock(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      warehouseId: string;
      stockItemKey: string;
      quantity: Prisma.Decimal;
    },
  ) {
    const warehouse = await tx.warehouse.findFirst({
      where: {
        id: params.warehouseId,
        businessId: params.businessId,
        deletedAt: null,
        status: WarehouseStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }

    const warehouseStock = await tx.inventoryWarehouseStock.findUnique({
      where: {
        businessId_warehouseId_stockItemKey: {
          businessId: params.businessId,
          warehouseId: params.warehouseId,
          stockItemKey: params.stockItemKey,
        },
      },
    });

    if (!warehouseStock) {
      throw new BadRequestException("Selected warehouse has no stock");
    }

    const availableQuantity = warehouseStock.totalQuantity.minus(
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
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      warehouseId: string;
      stockItemKey: string;
      quantity: Prisma.Decimal;
    },
  ) {
    const stock = await tx.inventoryStock.findUnique({
      where: {
        businessId_stockItemKey: {
          businessId: params.businessId,
          stockItemKey: params.stockItemKey,
        },
      },
    });

    if (!stock) {
      throw new BadRequestException("Stock is not available for this item");
    }

    const warehouseStock = await tx.inventoryWarehouseStock.findUnique({
      where: {
        businessId_warehouseId_stockItemKey: {
          businessId: params.businessId,
          warehouseId: params.warehouseId,
          stockItemKey: params.stockItemKey,
        },
      },
    });

    if (!warehouseStock) {
      throw new NotFoundException("Warehouse stock not found");
    }

    if (
      stock.quantityReserved.lessThan(params.quantity) ||
      warehouseStock.quantityReserved.lessThan(params.quantity)
    ) {
      throw new BadRequestException("Reserved stock is insufficient");
    }

    return { stock, warehouseStock };
  }

  private async findAutoWarehouseStock(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      stockItemKey: string;
      quantity: Prisma.Decimal;
    },
  ) {
    const warehouseStocks = await tx.inventoryWarehouseStock.findMany({
      where: {
        businessId: params.businessId,
        stockItemKey: params.stockItemKey,
        warehouse: {
          deletedAt: null,
          status: WarehouseStatus.ACTIVE,
        },
      },
      include: {
        warehouse: {
          select: {
            createdAt: true,
          },
        },
      },
    });

    const eligibleWarehouseStocks = warehouseStocks
      .map((warehouseStock) => ({
        ...warehouseStock,
        availableQuantity: warehouseStock.totalQuantity.minus(
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
          left.warehouse.createdAt.getTime() -
          right.warehouse.createdAt.getTime()
        );
      });

    const selectedWarehouseStock = eligibleWarehouseStocks[0];

    if (!selectedWarehouseStock) {
      throw new BadRequestException("No warehouse has enough available stock");
    }

    return selectedWarehouseStock;
  }
}
