import Decimal from "decimal.js";
import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

import {
  InventoryMovementType,
  InventoryReferenceType,
  InventoryStockTransfer,
  inventoryStockTransfer,
  inventoryStockTransferItem,
  InventoryTransferStatus,
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
  CreateStockTransferDto,
  QueryStockTransferDto,
} from "./dto/stock-transfer.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import type {
  Database,
  DatabaseTransaction,
} from "../../../database/database.service";

@Injectable()
export class StockTransferService {
  constructor(
    private readonly database: DatabaseService,
    private readonly inventoryLookupService: InventoryLookupService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateStockTransferDto,
  ) {
    this.assertItems(dto.items);

    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException(
        "Source and destination warehouses must be different",
      );
    }

    await Promise.all([
      this.inventoryLookupService.assertWarehouseExists(
        businessId,
        dto.fromWarehouseId,
      ),
      this.inventoryLookupService.assertWarehouseExists(
        businessId,
        dto.toWarehouseId,
      ),
      ...dto.items.map((item) =>
        this.inventoryLookupService.assertStockItem(
          businessId,
          item.productId,
          item.variantId ?? null,
        ),
      ),
    ]);

    const transferNo =
      await this.inventoryLookupService.generateUniqueTransferNo(businessId);

    try {
      const transfer = await this.db.transaction(async (tx) => {
        const [createdTransfer] = await tx
          .insert(inventoryStockTransfer)
          .values({
            businessId,
            transferNo,
            fromWarehouseId: dto.fromWarehouseId,
            toWarehouseId: dto.toWarehouseId,
            status: InventoryTransferStatus.DRAFT,
            note: this.inventoryLookupService.normalizeNullableText(dto.note),
            createdBy: currentUser.id,
          })
          .returning();

        await tx.insert(inventoryStockTransferItem).values(
          dto.items.map((item) => ({
            transferId: createdTransfer.id,
            productId: item.productId,
            variantId: item.variantId ?? null,
            requestedQuantity: new Decimal(item.requestedQuantity),
            transferredQuantity: new Decimal(0),
            receivedQuantity: new Decimal(0),
          })),
        );

        return this.findTransferWithRelations(
          createdTransfer.id,
          undefined,
          undefined,
          tx,
        );
      });

      return apiResponse(transfer, "Stock transfer created successfully");
    } catch (error) {
      this.inventoryLookupService.handleUniqueError(
        error,
        "Stock transfer number already exists",
      );
    }
  }

  async findAll(businessId: string, query: QueryStockTransferDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(inventoryStockTransfer.businessId, businessId),
      isNull(inventoryStockTransfer.deletedAt),
      query.warehouseId
        ? or(
            eq(inventoryStockTransfer.fromWarehouseId, query.warehouseId),
            eq(inventoryStockTransfer.toWarehouseId, query.warehouseId),
          )
        : undefined,
      query.search
        ? ilike(inventoryStockTransfer.transferNo, `%${query.search}%`)
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(inventoryStockTransfer)
        .where(where)
        .orderBy(desc(inventoryStockTransfer.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(inventoryStockTransfer)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);
    const items = await Promise.all(
      rows.map((transfer) => this.withTransferRelations(transfer)),
    );

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, transferId: string) {
    const transfer = await this.findTransferWithRelations(
      transferId,
      businessId,
    );

    if (!transfer) {
      throw new NotFoundException("Stock transfer not found");
    }

    return apiResponse(transfer);
  }

  async ship(
    currentUser: CurrentUserPayload,
    businessId: string,
    transferId: string,
  ) {
    const transfer = await this.getTransferOrThrow(
      businessId,
      transferId,
      InventoryTransferStatus.DRAFT,
    );

    const shippedTransfer = await this.db.transaction(async (tx) => {
      for (const item of transfer.items) {
        await this.inventoryLookupService.applyStockDelta(tx, {
          businessId,
          warehouseId: transfer.fromWarehouseId,
          productId: item.productId,
          variantId: item.variantId,
          quantityDelta: new Decimal(item.requestedQuantity).negated(),
          movementType: InventoryMovementType.TRANSFER_OUT,
          referenceType: InventoryReferenceType.STOCK_TRANSFER,
          referenceId: transfer.id,
          note: transfer.note,
          createdBy: currentUser.id,
        });

        await tx
          .update(inventoryStockTransferItem)
          .set({ transferredQuantity: item.requestedQuantity })
          .where(eq(inventoryStockTransferItem.id, item.id));
      }

      const [updatedTransfer] = await tx
        .update(inventoryStockTransfer)
        .set({
          status: InventoryTransferStatus.SHIPPED,
          approvedBy: currentUser.id,
          shippedAt: new Date(),
        })
        .where(eq(inventoryStockTransfer.id, transferId))
        .returning();

      return this.withTransferRelations(updatedTransfer);
    });

    return apiResponse(shippedTransfer, "Stock transfer shipped");
  }

  async receive(
    currentUser: CurrentUserPayload,
    businessId: string,
    transferId: string,
  ) {
    const transfer = await this.getTransferOrThrow(
      businessId,
      transferId,
      InventoryTransferStatus.SHIPPED,
    );

    const receivedTransfer = await this.db.transaction(async (tx) => {
      for (const item of transfer.items) {
        await this.inventoryLookupService.applyStockDelta(tx, {
          businessId,
          warehouseId: transfer.toWarehouseId,
          productId: item.productId,
          variantId: item.variantId,
          quantityDelta: item.transferredQuantity,
          movementType: InventoryMovementType.TRANSFER_IN,
          referenceType: InventoryReferenceType.STOCK_TRANSFER,
          referenceId: transfer.id,
          note: transfer.note,
          createdBy: currentUser.id,
        });

        await tx
          .update(inventoryStockTransferItem)
          .set({ receivedQuantity: item.transferredQuantity })
          .where(eq(inventoryStockTransferItem.id, item.id));
      }

      const [updatedTransfer] = await tx
        .update(inventoryStockTransfer)
        .set({
          status: InventoryTransferStatus.RECEIVED,
          receivedAt: new Date(),
        })
        .where(eq(inventoryStockTransfer.id, transferId))
        .returning();

      return this.withTransferRelations(updatedTransfer);
    });

    return apiResponse(receivedTransfer, "Stock transfer received");
  }

  async cancel(
    _currentUser: CurrentUserPayload,
    businessId: string,
    transferId: string,
  ) {
    await this.getTransferOrThrow(
      businessId,
      transferId,
      InventoryTransferStatus.DRAFT,
    );

    const [transfer] = await this.db
      .update(inventoryStockTransfer)
      .set({ status: InventoryTransferStatus.CANCELLED })
      .where(eq(inventoryStockTransfer.id, transferId))
      .returning();

    return apiResponse(
      await this.withTransferRelations(transfer),
      "Stock transfer cancelled",
    );
  }

  private async getTransferOrThrow(
    businessId: string,
    transferId: string,
    status: InventoryTransferStatus,
  ) {
    const transfer = await this.findTransferWithRelations(
      transferId,
      businessId,
      status,
    );

    if (!transfer) {
      throw new NotFoundException("Stock transfer not found");
    }

    return transfer;
  }

  private async findTransferWithRelations(
    transferId: string,
    businessId?: string,
    status?: InventoryTransferStatus,
    client: Database | DatabaseTransaction = this.db,
  ) {
    const [transfer] = await client
      .select()
      .from(inventoryStockTransfer)
      .where(
        and(
          eq(inventoryStockTransfer.id, transferId),
          businessId
            ? eq(inventoryStockTransfer.businessId, businessId)
            : undefined,
          isNull(inventoryStockTransfer.deletedAt),
          status ? eq(inventoryStockTransfer.status, status) : undefined,
        ),
      );

    return transfer ? this.withTransferRelations(transfer, client) : null;
  }

  private async withTransferRelations(
    transfer: InventoryStockTransfer,
    client: Database | DatabaseTransaction = this.db,
  ) {
    const [fromWarehouse, toWarehouse, items] = await Promise.all([
      client
        .select()
        .from(warehouse)
        .where(eq(warehouse.id, transfer.fromWarehouseId))
        .then(([row]) => row ?? null),
      client
        .select()
        .from(warehouse)
        .where(eq(warehouse.id, transfer.toWarehouseId))
        .then(([row]) => row ?? null),
      client
        .select()
        .from(inventoryStockTransferItem)
        .where(eq(inventoryStockTransferItem.transferId, transfer.id))
        .orderBy(asc(inventoryStockTransferItem.createdAt)),
    ]);

    return {
      ...transfer,
      fromWarehouse,
      toWarehouse,
      items,
    };
  }

  private assertItems(
    items: { productId: string; variantId?: string | null }[],
  ) {
    if (items.length === 0) {
      throw new BadRequestException(
        "At least one stock transfer item is required",
      );
    }

    const itemKeys = new Set(
      items.map((item) =>
        this.inventoryLookupService.buildStockItemKey(
          item.productId,
          item.variantId,
        ),
      ),
    );

    if (itemKeys.size !== items.length) {
      throw new BadRequestException(
        "Stock transfer cannot contain duplicate items",
      );
    }
  }
}
