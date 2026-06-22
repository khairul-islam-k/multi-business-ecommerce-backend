import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type Warehouse,
  WarehouseStatus,
  inventoryStockMovement,
  inventoryWarehouseStock,
  supplierPurchaseOrder,
  warehouse,
} from "@/database/schema";
import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import {
  CreateWarehouseDto,
  QueryWarehouseDto,
  UpdateWarehouseDto,
} from "./dto/warehouse.dto";
import { DatabaseService } from "../../../database/database.service";
import { InventoryLookupService } from "../common/inventory-lookup.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";

@Injectable()
export class WarehouseService {
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
    dto: CreateWarehouseDto,
  ) {
    try {
      const [createdWarehouse] = await this.db
        .insert(warehouse)
        .values({
          businessId,
          name: this.lookup.normalizeName(dto.name),
          phone: this.lookup.normalizeNullableText(dto.phone),
          address: this.lookup.normalizeNullableText(dto.address),
          status: dto.status ?? WarehouseStatus.ACTIVE,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        })
        .returning();

      return apiResponse(
        await this.withWarehouseCount(createdWarehouse),
        "Warehouse created successfully",
      );
    } catch (error) {
      this.lookup.handleUniqueError(error, "Warehouse name already exists");
    }
  }

  async findAll(businessId: string, query: QueryWarehouseDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(warehouse.businessId, businessId),
      isNull(warehouse.deletedAt),
      query.status ? eq(warehouse.status, query.status) : undefined,
      query.search
        ? or(
            ilike(warehouse.name, `%${query.search}%`),
            ilike(warehouse.phone, `%${query.search}%`),
            ilike(warehouse.address, `%${query.search}%`),
          )
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(warehouse)
        .where(where)
        .orderBy(
          query.sortOrder === "asc"
            ? asc(warehouse.createdAt)
            : desc(warehouse.createdAt),
        )
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(warehouse)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);
    const items = await Promise.all(
      rows.map((warehouseRow) => this.withWarehouseCount(warehouseRow)),
    );

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, warehouseId: string) {
    const warehouseRow = await this.findWarehouseRow(businessId, warehouseId);

    if (!warehouseRow) {
      throw new NotFoundException("Warehouse not found");
    }

    return apiResponse(await this.withWarehouseCount(warehouseRow));
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    warehouseId: string,
    dto: UpdateWarehouseDto,
  ) {
    await this.findWarehouseOrThrow(businessId, warehouseId);

    try {
      const [updatedWarehouse] = await this.db
        .update(warehouse)
        .set({
          ...(dto.name !== undefined && {
            name: this.lookup.normalizeName(dto.name),
          }),
          ...(dto.phone !== undefined && {
            phone: this.lookup.normalizeNullableText(dto.phone),
          }),
          ...(dto.address !== undefined && {
            address: this.lookup.normalizeNullableText(dto.address),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          updatedBy: currentUser.id,
        })
        .where(eq(warehouse.id, warehouseId))
        .returning();

      return apiResponse(
        await this.withWarehouseCount(updatedWarehouse),
        "Warehouse updated successfully",
      );
    } catch (error) {
      this.lookup.handleUniqueError(error, "Warehouse name already exists");
    }
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    warehouseId: string,
  ) {
    await this.findWarehouseOrThrow(businessId, warehouseId);
    await this.assertWarehouseCanBeDeleted(businessId, warehouseId);

    await this.db
      .update(warehouse)
      .set({
        status: WarehouseStatus.INACTIVE,
        deletedAt: new Date(),
        deletedBy: currentUser.id,
        updatedBy: currentUser.id,
      })
      .where(eq(warehouse.id, warehouseId));

    return apiResponse(null, "Warehouse deleted successfully");
  }

  private async findWarehouseRow(businessId: string, warehouseId: string) {
    const [warehouseRow] = await this.db
      .select()
      .from(warehouse)
      .where(
        and(
          eq(warehouse.id, warehouseId),
          eq(warehouse.businessId, businessId),
          isNull(warehouse.deletedAt),
        ),
      );

    return warehouseRow ?? null;
  }

  private async findWarehouseOrThrow(businessId: string, warehouseId: string) {
    const warehouseRow = await this.findWarehouseRow(businessId, warehouseId);

    if (!warehouseRow) {
      throw new NotFoundException("Warehouse not found");
    }
  }

  private async assertWarehouseCanBeDeleted(
    businessId: string,
    warehouseId: string,
  ) {
    const referenceCounts = await Promise.all([
      this.countRows(inventoryWarehouseStock, businessId, warehouseId),
      this.countRows(inventoryStockMovement, businessId, warehouseId),
      this.countRows(supplierPurchaseOrder, businessId, warehouseId),
    ]);

    if (referenceCounts.some((count) => count > 0)) {
      throw new BadRequestException(
        "Warehouse cannot be deleted while referenced by stock or purchase records",
      );
    }
  }

  private async countRows(
    table:
      | typeof inventoryWarehouseStock
      | typeof inventoryStockMovement
      | typeof supplierPurchaseOrder,
    businessId: string,
    warehouseId: string,
  ) {
    const [{ value }] = await this.db
      .select({ value: count() })
      .from(table)
      .where(
        and(
          eq(table.businessId, businessId),
          eq(table.warehouseId, warehouseId),
        ),
      );

    return value;
  }

  private async withWarehouseCount(warehouseRow: Warehouse) {
    const [stocks, movements] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(inventoryWarehouseStock)
        .where(eq(inventoryWarehouseStock.warehouseId, warehouseRow.id))
        .then(([row]) => row?.value ?? 0),
      this.db
        .select({ value: count() })
        .from(inventoryStockMovement)
        .where(eq(inventoryStockMovement.warehouseId, warehouseRow.id))
        .then(([row]) => row?.value ?? 0),
    ]);

    return {
      ...warehouseRow,
      _count: {
        stocks,
        movements,
      },
    };
  }
}
