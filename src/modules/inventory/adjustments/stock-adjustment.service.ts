import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  InventoryAdjustmentStatus,
  InventoryAdjustmentType,
  InventoryMovementType,
  InventoryReferenceType,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { InventoryLookupService } from "../common/inventory-lookup.service";
import {
  CreateStockAdjustmentDto,
  QueryStockAdjustmentDto,
} from "./dto/stock-adjustment.dto";

const ADJUSTMENT_INCLUDE = {
  warehouse: true,
  items: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.InventoryStockAdjustmentInclude;

@Injectable()
export class StockAdjustmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: InventoryLookupService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateStockAdjustmentDto,
  ) {
    this.assertItems(dto.items);
    await this.lookup.assertWarehouseExists(businessId, dto.warehouseId);

    const items = await Promise.all(
      dto.items.map(async (item) => {
        await this.lookup.assertVariantForStock(
          businessId,
          item.productId,
          item.variantId,
        );

        const warehouseStock = await this.lookup.getWarehouseStock(
          businessId,
          dto.warehouseId,
          item.variantId,
        );

        return {
          productId: item.productId,
          variantId: item.variantId,
          oldQuantity: warehouseStock?.totalQuantity ?? 0,
          adjustmentQty: item.adjustmentQty,
          reason: this.lookup.normalizeNullableText(item.reason),
        };
      }),
    );

    try {
      const adjustment = await this.prisma.inventoryStockAdjustment.create({
        data: {
          businessId,
          warehouseId: dto.warehouseId,
          adjustmentNo: this.lookup.normalizeName(dto.adjustmentNo),
          adjustmentType: dto.adjustmentType,
          reason: this.lookup.normalizeNullableText(dto.reason),
          status: InventoryAdjustmentStatus.DRAFT,
          createdBy: currentUser.id,
          items: { create: items },
        },
        include: ADJUSTMENT_INCLUDE,
      });

      return apiResponse(adjustment, "Stock adjustment created successfully");
    } catch (error) {
      this.lookup.handleUniqueError(
        error,
        "Stock adjustment number already exists",
      );
    }
  }

  async findAll(businessId: string, query: QueryStockAdjustmentDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryStockAdjustmentWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.search
        ? {
            OR: [
              {
                adjustmentNo: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              { reason: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const items = await this.prisma.inventoryStockAdjustment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: ADJUSTMENT_INCLUDE,
    });

    const total = await this.prisma.inventoryStockAdjustment.count({ where });

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, adjustmentId: string) {
    const adjustment = await this.prisma.inventoryStockAdjustment.findFirst({
      where: { id: adjustmentId, businessId, deletedAt: null },
      include: ADJUSTMENT_INCLUDE,
    });

    if (!adjustment) {
      throw new NotFoundException("Stock adjustment not found");
    }

    return apiResponse(adjustment);
  }

  async approve(
    currentUser: CurrentUserPayload,
    businessId: string,
    adjustmentId: string,
  ) {
    const adjustment = await this.getDraftAdjustmentOrThrow(
      businessId,
      adjustmentId,
    );

    const approvedAdjustment = await this.prisma.$transaction(async (tx) => {
      for (const item of adjustment.items) {
        const quantityDelta =
          adjustment.adjustmentType === InventoryAdjustmentType.INCREASE
            ? item.adjustmentQty
            : new Prisma.Decimal(item.adjustmentQty).negated();

        await this.lookup.applyStockDelta(tx, {
          businessId,
          warehouseId: adjustment.warehouseId,
          productId: item.productId,
          variantId: item.variantId,
          quantityDelta,
          movementType:
            adjustment.adjustmentType === InventoryAdjustmentType.INCREASE
              ? InventoryMovementType.ADJUSTMENT_IN
              : InventoryMovementType.ADJUSTMENT_OUT,
          referenceType: InventoryReferenceType.STOCK_ADJUSTMENT,
          referenceId: adjustment.id,
          note: adjustment.reason ?? item.reason,
          createdBy: currentUser.id,
        });
      }

      return tx.inventoryStockAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: InventoryAdjustmentStatus.APPROVED,
          approvedBy: currentUser.id,
          approvedAt: new Date(),
        },
        include: ADJUSTMENT_INCLUDE,
      });
    });

    return apiResponse(approvedAdjustment, "Stock adjustment approved");
  }

  async cancel(
    currentUser: CurrentUserPayload,
    businessId: string,
    adjustmentId: string,
  ) {
    await this.getDraftAdjustmentOrThrow(businessId, adjustmentId);

    const adjustment = await this.prisma.inventoryStockAdjustment.update({
      where: { id: adjustmentId },
      data: {
        status: InventoryAdjustmentStatus.CANCELLED,
        approvedBy: currentUser.id,
      },
      include: ADJUSTMENT_INCLUDE,
    });

    return apiResponse(adjustment, "Stock adjustment cancelled");
  }

  private async getDraftAdjustmentOrThrow(
    businessId: string,
    adjustmentId: string,
  ) {
    const adjustment = await this.prisma.inventoryStockAdjustment.findFirst({
      where: {
        id: adjustmentId,
        businessId,
        deletedAt: null,
        status: InventoryAdjustmentStatus.DRAFT,
      },
      include: { items: true },
    });

    if (!adjustment) {
      throw new NotFoundException("Draft stock adjustment not found");
    }

    return adjustment;
  }

  private assertItems(items: { variantId: string }[]) {
    if (items.length === 0) {
      throw new BadRequestException(
        "At least one stock adjustment item is required",
      );
    }

    const variantIds = new Set(items.map((item) => item.variantId));

    if (variantIds.size !== items.length) {
      throw new BadRequestException(
        "Stock adjustment cannot contain duplicate variants",
      );
    }
  }
}
