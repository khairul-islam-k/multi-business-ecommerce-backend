import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CatalogProductStatus,
  InventoryMovementType,
  InventoryReferenceType,
  Prisma,
  WarehouseStatus,
} from "@prisma/client";

import { normalizeOptionalText } from "../../../common/text/normalizers";
import { generateRandomCode } from "../../../common/utils/code-generator.util";
import { PrismaService } from "../../../prisma/prisma.service";
import { ProductCatalogLookupService } from "../../product-catalog/common/product-catalog-lookup.service";
import { StockMutationService } from "../application/stock-mutation.service";
import { StockReservationService } from "../application/stock-reservation.service";
import { buildStockItemKey } from "../domain/stock-item-key";
import { StockItemRef } from "./inventory.types";

const INVENTORY_CODE_RETRY_LIMIT = 5;

@Injectable()
export class InventoryLookupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogLookup: ProductCatalogLookupService,
    private readonly stockMutation: StockMutationService,
    private readonly stockReservation: StockReservationService,
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

  async assertStockItem(
    businessId: string,
    productId: string,
    variantId?: string | null,
  ) {
    const product = await this.catalogLookup.assertProductExists(
      businessId,
      productId,
    );

    if (product.status !== CatalogProductStatus.ACTIVE) {
      throw new BadRequestException("Product is not active");
    }

    if (variantId) {
      return this.catalogLookup.assertVariantExists(
        businessId,
        productId,
        variantId,
      );
    }

    const variantCount = await this.prisma.productVariant.count({
      where: {
        businessId,
        productId,
        deletedAt: null,
      },
    });

    if (variantCount > 0) {
      throw new BadRequestException(
        "Variant must be selected for a product that has variants",
      );
    }

    return product;
  }

  async assertVariantForStock(
    businessId: string,
    productId: string,
    variantId?: string | null,
  ) {
    return this.assertStockItem(businessId, productId, variantId);
  }

  async getStock(
    businessId: string,
    productIdOrVariantId: string,
    variantId?: string | null,
  ) {
    const productId = variantId === undefined ? "" : productIdOrVariantId;
    const itemVariantId =
      variantId === undefined ? productIdOrVariantId : variantId;

    return this.prisma.inventoryStock.findFirst({
      where:
        variantId === undefined
          ? { businessId, variantId: itemVariantId }
          : {
              businessId,
              productId,
              variantId: itemVariantId ?? null,
              stockItemKey: buildStockItemKey(productId, itemVariantId),
            },
    });
  }

  async getWarehouseStock(
    businessId: string,
    warehouseId: string,
    productIdOrVariantId: string,
    variantId?: string | null,
  ) {
    const productId = variantId === undefined ? "" : productIdOrVariantId;
    const itemVariantId =
      variantId === undefined ? productIdOrVariantId : variantId;

    return this.prisma.inventoryWarehouseStock.findFirst({
      where:
        variantId === undefined
          ? { businessId, warehouseId, variantId: itemVariantId }
          : {
              businessId,
              warehouseId,
              productId,
              variantId: itemVariantId ?? null,
              stockItemKey: buildStockItemKey(productId, itemVariantId),
            },
    });
  }

  async createZeroStock(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      productId: string;
      variantId?: string | null;
    },
  ) {
    const stockItemKey = buildStockItemKey(params.productId, params.variantId);

    return tx.inventoryStock.upsert({
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
  }

  async generateUniqueAdjustmentNo(businessId: string) {
    for (let attempt = 0; attempt < INVENTORY_CODE_RETRY_LIMIT; attempt++) {
      const adjustmentNo = generateRandomCode("ADJ");

      const existingAdjustment =
        await this.prisma.inventoryStockAdjustment.findFirst({
          where: { businessId, adjustmentNo },
          select: { id: true },
        });

      if (!existingAdjustment) {
        return adjustmentNo;
      }
    }

    throw new BadRequestException("Could not generate stock adjustment number");
  }

  async generateUniqueTransferNo(businessId: string) {
    for (let attempt = 0; attempt < INVENTORY_CODE_RETRY_LIMIT; attempt++) {
      const transferNo = generateRandomCode("TRF");

      const existingTransfer =
        await this.prisma.inventoryStockTransfer.findFirst({
          where: { businessId, transferNo },
          select: { id: true },
        });

      if (!existingTransfer) {
        return transferNo;
      }
    }

    throw new BadRequestException("Could not generate stock transfer number");
  }

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
    return this.stockMutation.applyStockDelta(tx, params);
  }

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
    return this.stockReservation.reserveForOrder(tx, params);
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
    return this.stockReservation.reserveStock(tx, params);
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
    return this.stockReservation.releaseStockReservation(tx, params);
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
    return this.stockReservation.deductReservedStock(tx, params);
  }

  async releaseOrderReservation(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      allocationId: string;
    },
    userId?: string,
  ) {
    return this.stockReservation.releaseOrderReservation(tx, params, userId);
  }

  async fulfillOrderAllocation(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      allocationId: string;
    },
    userId?: string,
  ) {
    return this.stockReservation.fulfillOrderAllocation(tx, params, userId);
  }

  buildStockItemKey(productId: string, variantId?: string | null) {
    return buildStockItemKey(productId, variantId);
  }

  normalizeName(value: string) {
    return value.trim();
  }

  normalizeNullableText(value?: string | null) {
    return normalizeOptionalText(value);
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
}
