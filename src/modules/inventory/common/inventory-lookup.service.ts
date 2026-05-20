import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  InventoryMovementType,
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

  async getStock(businessId: string, warehouseId: string, variantId: string) {
    return this.prisma.inventoryStock.findUnique({
      where: {
        businessId_warehouseId_variantId: {
          businessId,
          warehouseId,
          variantId,
        },
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

    const existingStock = await tx.inventoryStock.findUnique({
      where: {
        businessId_warehouseId_variantId: {
          businessId: params.businessId,
          warehouseId: params.warehouseId,
          variantId: params.variantId,
        },
      },
    });

    const currentTotal = existingStock?.totalQuantity ?? new Prisma.Decimal(0);
    const currentReserved =
      existingStock?.quantityReserved ?? new Prisma.Decimal(0);
    const nextTotal = currentTotal.plus(quantityDelta);

    if (nextTotal.lessThan(0)) {
      throw new BadRequestException("Stock cannot be negative");
    }

    if (quantityDelta.lessThan(0)) {
      const availableQuantity = currentTotal.minus(currentReserved);

      if (availableQuantity.plus(quantityDelta).lessThan(0)) {
        throw new BadRequestException("Available stock is insufficient");
      }
    }

    const stock = existingStock
      ? await tx.inventoryStock.update({
          where: { id: existingStock.id },
          data: { totalQuantity: nextTotal },
        })
      : await tx.inventoryStock.create({
          data: {
            businessId: params.businessId,
            warehouseId: params.warehouseId,
            productId: params.productId,
            variantId: params.variantId,
            totalQuantity: nextTotal,
          },
        });

    await tx.inventoryStockMovement.create({
      data: {
        businessId: params.businessId,
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

    return stock;
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
}
