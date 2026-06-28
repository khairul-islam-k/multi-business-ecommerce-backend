import Decimal from "decimal.js";
import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

import {
  InventoryAdjustmentStatus,
  InventoryAdjustmentType,
  InventoryMovementType,
  InventoryReferenceType,
  InventoryStockAdjustment,
  inventoryStockAdjustment,
  inventoryStockAdjustmentItem,
  warehouse,
} from "@/database/schema";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import { DatabaseService } from "../../../database/database.service";
import { InventoryLookupService } from "../common/inventory-lookup.service";
import {
  CreateStockAdjustmentDto,
  QueryStockAdjustmentDto,
} from "./dto/stock-adjustment.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import type {
  Database,
  DatabaseTransaction,
} from "../../../database/database.service";

@Injectable()
export class StockAdjustmentService {
  constructor(
    private readonly database: DatabaseService,
    private readonly lookup: InventoryLookupService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateStockAdjustmentDto,
  ) {
    this.assertItems(dto.items);
    await this.lookup.assertWarehouseExists(businessId, dto.warehouseId);
    const adjustmentNo =
      await this.lookup.generateUniqueAdjustmentNo(businessId);

    const items = await Promise.all(
      dto.items.map(async (item) => {
        await this.lookup.assertStockItem(
          businessId,
          item.productId,
          item.variantId ?? null,
        );

        const warehouseStock = await this.lookup.getWarehouseStock(
          businessId,
          dto.warehouseId,
          item.productId,
          item.variantId ?? null,
        );

        return {
          productId: item.productId,
          variantId: item.variantId ?? null,
          oldQuantity: warehouseStock?.totalQuantity ?? new Decimal(0),
          adjustmentQty: new Decimal(item.adjustmentQty),
          reason: this.lookup.normalizeNullableText(item.reason),
        };
      }),
    );

    try {
      const adjustment = await this.db.transaction(async (tx) => {
        const [createdAdjustment] = await tx
          .insert(inventoryStockAdjustment)
          .values({
            businessId,
            warehouseId: dto.warehouseId,
            adjustmentNo,
            adjustmentType: dto.adjustmentType,
            reason: this.lookup.normalizeNullableText(dto.reason),
            status: InventoryAdjustmentStatus.DRAFT,
            createdBy: currentUser.id,
          })
          .returning();

        await tx.insert(inventoryStockAdjustmentItem).values(
          items.map((item) => ({
            adjustmentId: createdAdjustment.id,
            ...item,
          })),
        );

        return this.findAdjustmentWithRelations(
          createdAdjustment.id,
          undefined,
          undefined,
          tx,
        );
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
    const where = and(
      eq(inventoryStockAdjustment.businessId, businessId),
      isNull(inventoryStockAdjustment.deletedAt),
      query.warehouseId
        ? eq(inventoryStockAdjustment.warehouseId, query.warehouseId)
        : undefined,
      query.search
        ? or(
            ilike(inventoryStockAdjustment.adjustmentNo, `%${query.search}%`),
            ilike(inventoryStockAdjustment.reason, `%${query.search}%`),
          )
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(inventoryStockAdjustment)
        .where(where)
        .orderBy(desc(inventoryStockAdjustment.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(inventoryStockAdjustment)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);
    const items = await Promise.all(
      rows.map((adjustment) => this.withAdjustmentRelations(adjustment)),
    );

    return paginatedResponse(
      items,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Stock adjustments were loaded successfully. The response includes the requested page of adjustment records for this business and pagination metadata for browsing more results.",
    );
  }

  async findOne(businessId: string, adjustmentId: string) {
    const adjustment = await this.findAdjustmentWithRelations(
      adjustmentId,
      businessId,
    );

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

    const approvedAdjustment = await this.db.transaction(async (tx) => {
      for (const item of adjustment.items) {
        const quantityDelta =
          adjustment.adjustmentType === InventoryAdjustmentType.INCREASE
            ? item.adjustmentQty
            : new Decimal(item.adjustmentQty).negated();

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

      const [updatedAdjustment] = await tx
        .update(inventoryStockAdjustment)
        .set({
          status: InventoryAdjustmentStatus.APPROVED,
          approvedBy: currentUser.id,
          approvedAt: new Date(),
        })
        .where(eq(inventoryStockAdjustment.id, adjustmentId))
        .returning();

      return this.withAdjustmentRelations(updatedAdjustment);
    });

    return apiResponse(approvedAdjustment, "Stock adjustment approved");
  }

  async cancel(
    currentUser: CurrentUserPayload,
    businessId: string,
    adjustmentId: string,
  ) {
    await this.getDraftAdjustmentOrThrow(businessId, adjustmentId);

    const [adjustment] = await this.db
      .update(inventoryStockAdjustment)
      .set({
        status: InventoryAdjustmentStatus.CANCELLED,
        approvedBy: currentUser.id,
      })
      .where(eq(inventoryStockAdjustment.id, adjustmentId))
      .returning();

    return apiResponse(
      await this.withAdjustmentRelations(adjustment),
      "Stock adjustment cancelled",
    );
  }

  private async getDraftAdjustmentOrThrow(
    businessId: string,
    adjustmentId: string,
  ) {
    const adjustment = await this.findAdjustmentWithRelations(
      adjustmentId,
      businessId,
      InventoryAdjustmentStatus.DRAFT,
    );

    if (!adjustment) {
      throw new NotFoundException("Draft stock adjustment not found");
    }

    return adjustment;
  }

  private async findAdjustmentWithRelations(
    adjustmentId: string,
    businessId?: string,
    status?: InventoryAdjustmentStatus,
    client: Database | DatabaseTransaction = this.db,
  ) {
    const [adjustment] = await client
      .select()
      .from(inventoryStockAdjustment)
      .where(
        and(
          eq(inventoryStockAdjustment.id, adjustmentId),
          businessId
            ? eq(inventoryStockAdjustment.businessId, businessId)
            : undefined,
          isNull(inventoryStockAdjustment.deletedAt),
          status ? eq(inventoryStockAdjustment.status, status) : undefined,
        ),
      );

    return adjustment ? this.withAdjustmentRelations(adjustment, client) : null;
  }

  private async withAdjustmentRelations(
    adjustment: InventoryStockAdjustment,
    client: Database | DatabaseTransaction = this.db,
  ) {
    const [warehouseRow, items] = await Promise.all([
      client
        .select()
        .from(warehouse)
        .where(eq(warehouse.id, adjustment.warehouseId))
        .then(([row]) => row ?? null),
      client
        .select()
        .from(inventoryStockAdjustmentItem)
        .where(eq(inventoryStockAdjustmentItem.adjustmentId, adjustment.id))
        .orderBy(asc(inventoryStockAdjustmentItem.createdAt)),
    ]);

    return {
      ...adjustment,
      warehouse: warehouseRow,
      items,
    };
  }

  private assertItems(
    items: { productId: string; variantId?: string | null }[],
  ) {
    if (items.length === 0) {
      throw new BadRequestException(
        "At least one stock adjustment item is required",
      );
    }

    const itemKeys = new Set(
      items.map((item) =>
        this.lookup.buildStockItemKey(item.productId, item.variantId),
      ),
    );

    if (itemKeys.size !== items.length) {
      throw new BadRequestException(
        "Stock adjustment cannot contain duplicate items",
      );
    }
  }
}
