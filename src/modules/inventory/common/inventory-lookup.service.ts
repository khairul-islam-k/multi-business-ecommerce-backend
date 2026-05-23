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

import { PrismaService } from "../../../prisma/prisma.service";
import { ProductCatalogLookupService } from "../../product-catalog/common/product-catalog-lookup.service";

@Injectable()
export class InventoryLookupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogLookup: ProductCatalogLookupService,
  ) {}

  async assertWarehouseExists(businessId: string, warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id: warehouseId,
        businessId,
        deletedAt: null,
        status: WarehouseStatus.ACTIVE,
      },
    });

    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }

    return warehouse;
  }

  async assertVariantForStock(
    businessId: string,
    productId: string,
    variantId: string,
  ) {
    await this.catalogLookup.assertProductExists(businessId, productId);
    return this.catalogLookup.assertVariantExists(
      businessId,
      productId,
      variantId,
    );
  }

  async getStock(businessId: string, variantId: string) {
    return this.prisma.inventoryStock.findUnique({
      where: {
        businessId_variantId: {
          businessId,
          variantId,
        },
      },
    });
  }

  async getWarehouseStock(
    businessId: string,
    warehouseId: string,
    variantId: string,
  ) {
    return this.prisma.inventoryWarehouseStock.findUnique({
      where: {
        businessId_warehouseId_variantId: {
          businessId,
          warehouseId,
          variantId,
        },
      },
    });
  }

  async createZeroStock(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      productId: string;
      variantId: string;
    },
  ) {
    return tx.inventoryStock.upsert({
      where: {
        businessId_variantId: {
          businessId: params.businessId,
          variantId: params.variantId,
        },
      },
      update: {},
      create: {
        businessId: params.businessId,
        productId: params.productId,
        variantId: params.variantId,
      },
    });
  }

  async applyStockDelta(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      warehouseId: string;
      productId: string;
      variantId: string;
      quantityDelta: Prisma.Decimal.Value;
      movementType: InventoryMovementType;
      referenceType?: InventoryReferenceType;
      referenceId?: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    const quantityDelta = new Prisma.Decimal(params.quantityDelta);

    if (quantityDelta.isZero()) {
      throw new BadRequestException("Stock movement quantity is required");
    }

    const stock = await tx.inventoryStock.upsert({
      where: {
        businessId_variantId: {
          businessId: params.businessId,
          variantId: params.variantId,
        },
      },
      update: {},
      create: {
        businessId: params.businessId,
        productId: params.productId,
        variantId: params.variantId,
      },
    });

    const existingWarehouseStock = await tx.inventoryWarehouseStock.findUnique({
      where: {
        businessId_warehouseId_variantId: {
          businessId: params.businessId,
          warehouseId: params.warehouseId,
          variantId: params.variantId,
        },
      },
    });

    const currentStockTotal = stock.totalQuantity;
    const currentStockReserved = stock.quantityReserved;
    const nextStockTotal = currentStockTotal.plus(quantityDelta);

    const currentWarehouseTotal =
      existingWarehouseStock?.totalQuantity ?? new Prisma.Decimal(0);
    const currentWarehouseReserved =
      existingWarehouseStock?.quantityReserved ?? new Prisma.Decimal(0);
    const nextWarehouseTotal = currentWarehouseTotal.plus(quantityDelta);

    if (nextStockTotal.lessThan(0) || nextWarehouseTotal.lessThan(0)) {
      throw new BadRequestException("Stock cannot be negative");
    }

    if (quantityDelta.lessThan(0)) {
      const availableStockQuantity =
        currentStockTotal.minus(currentStockReserved);
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
        businessId_warehouseId_variantId: {
          businessId: params.businessId,
          warehouseId: params.warehouseId,
          variantId: params.variantId,
        },
      },
      update: { totalQuantity: nextWarehouseTotal },
      create: {
        businessId: params.businessId,
        stockId: stock.id,
        warehouseId: params.warehouseId,
        productId: params.productId,
        variantId: params.variantId,
        totalQuantity: nextWarehouseTotal,
      },
    });

    await tx.inventoryStockMovement.create({
      data: {
        businessId: params.businessId,
        stockId: stock.id,
        warehouseId: params.warehouseId,
        productId: params.productId,
        variantId: params.variantId,
        movementType: params.movementType,
        quantity: quantityDelta.abs(),
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        note: this.normalizeNullableText(params.note),
        createdBy: params.createdBy,
      },
    });

    return updatedStock;
  }

  async reserveForOrder(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      orderId: string;
      orderItemId: string;
      productId: string;
      variantId: string;
      quantity: Prisma.Decimal.Value;
      warehouseId?: string | null;
      createdBy?: string;
    },
  ) {
    const quantity = new Prisma.Decimal(params.quantity);

    if (quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Reservation quantity is required");
    }

    const stock = await tx.inventoryStock.findUnique({
      where: {
        businessId_variantId: {
          businessId: params.businessId,
          variantId: params.variantId,
        },
      },
    });

    if (!stock) {
      throw new BadRequestException("Stock is not available for this variant");
    }

    const warehouseStock = params.warehouseId
      ? await this.findManualWarehouseStock(tx, {
          businessId: params.businessId,
          warehouseId: params.warehouseId,
          variantId: params.variantId,
          quantity,
        })
      : await this.findAutoWarehouseStock(tx, {
          businessId: params.businessId,
          variantId: params.variantId,
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
        variantId: params.variantId,
        quantity,
        status: InventoryOrderAllocationStatus.RESERVED,
        createdBy: params.createdBy,
      },
    });

    await tx.inventoryStock.update({
      where: { id: stock.id },
      data: {
        quantityReserved: new Prisma.Decimal(stock.quantityReserved).plus(
          quantity,
        ),
      },
    });

    await tx.inventoryWarehouseStock.update({
      where: { id: warehouseStock.id },
      data: {
        quantityReserved: new Prisma.Decimal(
          warehouseStock.quantityReserved,
        ).plus(quantity),
      },
    });

    await tx.inventoryStockMovement.create({
      data: {
        businessId: params.businessId,
        stockId: stock.id,
        warehouseId: warehouseStock.warehouseId,
        productId: params.productId,
        variantId: params.variantId,
        movementType: InventoryMovementType.RESERVED,
        quantity,
        referenceType: InventoryReferenceType.ORDER,
        referenceId: params.orderId,
        createdBy: params.createdBy,
      },
    });

    return allocation;
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
        businessId_warehouseId_variantId: {
          businessId: allocation.businessId,
          warehouseId: allocation.warehouseId,
          variantId: allocation.variantId,
        },
      },
    });

    if (!warehouseStock) {
      throw new NotFoundException("Warehouse stock not found");
    }

    await tx.inventoryStock.update({
      where: { id: allocation.stockId },
      data: {
        quantityReserved: new Prisma.Decimal(
          allocation.stock.quantityReserved,
        ).minus(allocation.quantity),
      },
    });

    await tx.inventoryWarehouseStock.update({
      where: { id: warehouseStock.id },
      data: {
        quantityReserved: new Prisma.Decimal(
          warehouseStock.quantityReserved,
        ).minus(allocation.quantity),
      },
    });

    await tx.inventoryStockMovement.create({
      data: {
        businessId: allocation.businessId,
        stockId: allocation.stockId,
        warehouseId: allocation.warehouseId,
        productId: allocation.productId,
        variantId: allocation.variantId,
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
        businessId_warehouseId_variantId: {
          businessId: allocation.businessId,
          warehouseId: allocation.warehouseId,
          variantId: allocation.variantId,
        },
      },
    });

    if (!warehouseStock) {
      throw new NotFoundException("Warehouse stock not found");
    }

    await tx.inventoryStock.update({
      where: { id: allocation.stockId },
      data: {
        totalQuantity: new Prisma.Decimal(allocation.stock.totalQuantity).minus(
          allocation.quantity,
        ),
        quantityReserved: new Prisma.Decimal(
          allocation.stock.quantityReserved,
        ).minus(allocation.quantity),
      },
    });

    await tx.inventoryWarehouseStock.update({
      where: { id: warehouseStock.id },
      data: {
        totalQuantity: new Prisma.Decimal(warehouseStock.totalQuantity).minus(
          allocation.quantity,
        ),
        quantityReserved: new Prisma.Decimal(
          warehouseStock.quantityReserved,
        ).minus(allocation.quantity),
      },
    });

    await tx.inventoryStockMovement.create({
      data: {
        businessId: allocation.businessId,
        stockId: allocation.stockId,
        warehouseId: allocation.warehouseId,
        productId: allocation.productId,
        variantId: allocation.variantId,
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

  normalizeName(value: string) {
    return value.trim();
  }

  normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }

  handleUniqueError(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new BadRequestException(message);
    }

    throw error;
  }

  private async findManualWarehouseStock(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      warehouseId: string;
      variantId: string;
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
        businessId_warehouseId_variantId: {
          businessId: params.businessId,
          warehouseId: params.warehouseId,
          variantId: params.variantId,
        },
      },
    });

    if (!warehouseStock) {
      throw new BadRequestException("Selected warehouse has no stock");
    }

    const availableQuantity = new Prisma.Decimal(
      warehouseStock.totalQuantity,
    ).minus(warehouseStock.quantityReserved);

    if (availableQuantity.lessThan(params.quantity)) {
      throw new BadRequestException(
        "Selected warehouse has insufficient available stock",
      );
    }

    return warehouseStock;
  }

  private async findAutoWarehouseStock(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      variantId: string;
      quantity: Prisma.Decimal;
    },
  ) {
    const warehouseStocks = await tx.inventoryWarehouseStock.findMany({
      where: {
        businessId: params.businessId,
        variantId: params.variantId,
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
        availableQuantity: new Prisma.Decimal(
          warehouseStock.totalQuantity,
        ).minus(warehouseStock.quantityReserved),
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
