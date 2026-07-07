import Decimal from "decimal.js";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  SQL,
} from "drizzle-orm";

import {
  InventoryStock,
  inventoryStock,
  InventoryStockMovement,
  inventoryStockMovement,
  inventoryWarehouseStock,
  order as orderTable,
  orderItem as orderItemTable,
  product,
  productVariant,
  warehouse,
} from "@/database/schema";
import { Injectable, NotFoundException } from "@nestjs/common";

import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import {
  normalizeSearch,
  normalizeSearchUuid,
} from "../../../common/http/search.util";
import { DatabaseService } from "../../../database/database.service";
import { InventoryLookupService } from "../common/inventory-lookup.service";
import {
  FulfillOrderAllocationDto,
  QueryStockDto,
  ReleaseOrderAllocationDto,
  ReserveOrderStockDto,
  UpdateStockAlertDto,
} from "./dto/stock.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@Injectable()
export class StockService {
  constructor(
    private readonly database: DatabaseService,
    private readonly lookup: InventoryLookupService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async findAll(businessId: string, query: QueryStockDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = await this.buildStockWhere(businessId, query);

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(inventoryStock)
        .where(where)
        .orderBy(desc(inventoryStock.updatedAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(inventoryStock)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);
    const items = await Promise.all(
      rows.map((stock) => this.withStockRelations(stock)),
    );

    return paginatedResponse(
      items,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Stock records were loaded successfully. The response includes the requested page of stock balances for this business and pagination metadata for browsing more results.",
    );
  }

  async findOne(businessId: string, stockId: string) {
    const stock = await this.findStockRow(businessId, stockId);

    if (!stock) {
      throw new NotFoundException(
        "Stock record could not be found. It may not exist yet, may have been deleted, or may not belong to the requested product, variant, or warehouse.",
      );
    }

    return apiResponse(await this.withStockRelations(stock));
  }

  async updateAlert(
    _currentUser: CurrentUserPayload,
    businessId: string,
    stockId: string,
    dto: UpdateStockAlertDto,
  ) {
    await this.findStockOrThrow(businessId, stockId);

    const [stock] = await this.db
      .update(inventoryStock)
      .set({ lowStockAlertQty: new Decimal(dto.lowStockAlertQty) })
      .where(eq(inventoryStock.id, stockId))
      .returning();

    return apiResponse(
      await this.withStockRelations(stock),
      "Stock alert updated successfully",
    );
  }

  async findMovements(businessId: string, query: QueryStockDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = await this.buildMovementWhere(businessId, query);

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(inventoryStockMovement)
        .where(where)
        .orderBy(desc(inventoryStockMovement.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(inventoryStockMovement)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);
    const items = await Promise.all(
      rows.map((movement) => this.withMovementRelations(movement)),
    );

    return paginatedResponse(
      items,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Warehouse stock records were loaded successfully. The response includes the requested page of warehouse-level stock balances and pagination metadata for browsing more results.",
    );
  }

  async reserveForOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: ReserveOrderStockDto,
  ) {
    await this.assertOrderItemMatchesRequest(businessId, dto);

    const allocation = await this.db.transaction((tx) =>
      this.lookup.reserveForOrder(tx, {
        businessId,
        orderId: dto.orderId,
        orderItemId: dto.orderItemId,
        productId: dto.productId,
        variantId: dto.variantId ?? null,
        quantity: dto.quantity,
        warehouseId: dto.warehouseId,
        createdBy: currentUser.id,
      }),
    );

    return apiResponse(allocation, "Order stock reserved successfully");
  }

  async releaseOrderAllocation(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: ReleaseOrderAllocationDto,
  ) {
    const allocation = await this.db.transaction((tx) =>
      this.lookup.releaseOrderReservation(
        tx,
        { businessId, allocationId: dto.allocationId },
        currentUser.id,
      ),
    );

    return apiResponse(allocation, "Order stock reservation released");
  }

  async fulfillOrderAllocation(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: FulfillOrderAllocationDto,
  ) {
    const allocation = await this.db.transaction((tx) =>
      this.lookup.fulfillOrderAllocation(
        tx,
        { businessId, allocationId: dto.allocationId },
        currentUser.id,
      ),
    );

    return apiResponse(allocation, "Order stock allocation fulfilled");
  }

  private async buildStockWhere(businessId: string, query: QueryStockDto) {
    const conditions: (SQL | undefined)[] = [
      eq(inventoryStock.businessId, businessId),
      query.productId
        ? eq(inventoryStock.productId, query.productId)
        : undefined,
      query.variantId
        ? eq(inventoryStock.variantId, query.variantId)
        : undefined,
    ];

    if (query.warehouseId) {
      const stockIds = await this.findStockIdsForWarehouse(
        businessId,
        query.warehouseId,
      );
      conditions.push(
        stockIds.length > 0 ? inArray(inventoryStock.id, stockIds) : sql`false`,
      );
    }

    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);

    if (search) {
      const stockIds = await this.findStockIdsForSearch(businessId, search);
      conditions.push(
        or(
          searchUuid ? eq(inventoryStock.id, searchUuid) : undefined,
          stockIds.length > 0
            ? inArray(inventoryStock.id, stockIds)
            : undefined,
        ) ?? sql`false`,
      );
    }

    return and(...conditions);
  }

  private async buildMovementWhere(businessId: string, query: QueryStockDto) {
    const conditions: (SQL | undefined)[] = [
      eq(inventoryStockMovement.businessId, businessId),
      query.warehouseId
        ? eq(inventoryStockMovement.warehouseId, query.warehouseId)
        : undefined,
      query.productId
        ? eq(inventoryStockMovement.productId, query.productId)
        : undefined,
      query.variantId
        ? eq(inventoryStockMovement.variantId, query.variantId)
        : undefined,
    ];

    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);

    if (search) {
      const ids = await this.findEntityIdsForSearch(businessId, search);
      conditions.push(
        or(
          searchUuid ? eq(inventoryStockMovement.id, searchUuid) : undefined,
          ids.productIds.length > 0
            ? inArray(inventoryStockMovement.productId, ids.productIds)
            : undefined,
          ids.variantIds.length > 0
            ? inArray(inventoryStockMovement.variantId, ids.variantIds)
            : undefined,
          ids.warehouseIds.length > 0
            ? inArray(inventoryStockMovement.warehouseId, ids.warehouseIds)
            : undefined,
        ) ?? sql`false`,
      );
    }

    return and(...conditions);
  }

  private async findStockIdsForWarehouse(
    businessId: string,
    warehouseId: string,
  ) {
    const rows = await this.db
      .select({ stockId: inventoryWarehouseStock.stockId })
      .from(inventoryWarehouseStock)
      .where(
        and(
          eq(inventoryWarehouseStock.businessId, businessId),
          eq(inventoryWarehouseStock.warehouseId, warehouseId),
        ),
      );

    return rows.map((row) => row.stockId);
  }

  private async findStockIdsForSearch(businessId: string, search: string) {
    const ids = await this.findEntityIdsForSearch(businessId, search);
    const stockRows = await this.db
      .select({ id: inventoryStock.id })
      .from(inventoryStock)
      .where(
        and(
          eq(inventoryStock.businessId, businessId),
          or(
            ids.productIds.length > 0
              ? inArray(inventoryStock.productId, ids.productIds)
              : undefined,
            ids.variantIds.length > 0
              ? inArray(inventoryStock.variantId, ids.variantIds)
              : undefined,
            ids.warehouseStockIds.length > 0
              ? inArray(inventoryStock.id, ids.warehouseStockIds)
              : undefined,
          ) ?? sql`false`,
        ),
      );

    return stockRows.map((row) => row.id);
  }

  private async findEntityIdsForSearch(businessId: string, search: string) {
    const searchUuid = normalizeSearchUuid(search);
    const [productRows, variantRows, warehouseRows] = await Promise.all([
      this.db
        .select({ id: product.id })
        .from(product)
        .where(
          and(
            eq(product.businessId, businessId),
            isNull(product.deletedAt),
            or(
              searchUuid ? eq(product.id, searchUuid) : undefined,
              ilike(product.name, `%${search}%`),
              ilike(product.slug, `%${search}%`),
              ilike(product.sku, `%${search}%`),
              ilike(product.barcode, `%${search}%`),
            ),
          ),
        ),
      this.db
        .select({ id: productVariant.id })
        .from(productVariant)
        .where(
          and(
            eq(productVariant.businessId, businessId),
            isNull(productVariant.deletedAt),
            or(
              searchUuid ? eq(productVariant.id, searchUuid) : undefined,
              ilike(productVariant.title, `%${search}%`),
              ilike(productVariant.sku, `%${search}%`),
              ilike(productVariant.barcode, `%${search}%`),
            ),
          ),
        ),
      this.db
        .select({ id: warehouse.id })
        .from(warehouse)
        .where(
          and(
            eq(warehouse.businessId, businessId),
            isNull(warehouse.deletedAt),
            or(
              searchUuid ? eq(warehouse.id, searchUuid) : undefined,
              ilike(warehouse.name, `%${search}%`),
              ilike(warehouse.phone, `%${search}%`),
              ilike(warehouse.address, `%${search}%`),
            ),
          ),
        ),
    ]);
    const warehouseIds = warehouseRows.map((row) => row.id);
    const warehouseStockRows =
      warehouseIds.length > 0
        ? await this.db
            .select({ stockId: inventoryWarehouseStock.stockId })
            .from(inventoryWarehouseStock)
            .where(
              and(
                eq(inventoryWarehouseStock.businessId, businessId),
                inArray(inventoryWarehouseStock.warehouseId, warehouseIds),
              ),
            )
        : [];

    return {
      productIds: productRows.map((row) => row.id),
      variantIds: variantRows.map((row) => row.id),
      warehouseIds,
      warehouseStockIds: warehouseStockRows.map((row) => row.stockId),
    };
  }

  private async findStockRow(businessId: string, stockId: string) {
    const [stock] = await this.db
      .select()
      .from(inventoryStock)
      .where(
        and(
          eq(inventoryStock.id, stockId),
          eq(inventoryStock.businessId, businessId),
        ),
      );

    return stock ?? null;
  }

  private async findStockOrThrow(businessId: string, stockId: string) {
    const stock = await this.findStockRow(businessId, stockId);

    if (!stock) {
      throw new NotFoundException(
        "Stock record could not be found. It may not exist yet, may have been deleted, or may not belong to the requested product, variant, or warehouse.",
      );
    }
  }

  private async withStockRelations(stock: InventoryStock) {
    const [productRow, variantRow, warehouseStockRows] = await Promise.all([
      this.db
        .select()
        .from(product)
        .where(eq(product.id, stock.productId))
        .then(([row]) => row ?? null),
      stock.variantId
        ? this.db
            .select()
            .from(productVariant)
            .where(eq(productVariant.id, stock.variantId))
            .then(([row]) => row ?? null)
        : Promise.resolve(null),
      this.db
        .select({
          warehouseStock: inventoryWarehouseStock,
          warehouse,
        })
        .from(inventoryWarehouseStock)
        .leftJoin(
          warehouse,
          eq(warehouse.id, inventoryWarehouseStock.warehouseId),
        )
        .where(eq(inventoryWarehouseStock.stockId, stock.id))
        .orderBy(desc(inventoryWarehouseStock.updatedAt)),
    ]);

    return {
      ...stock,
      product: productRow,
      variant: variantRow,
      warehouseStocks: warehouseStockRows.map(
        ({ warehouseStock, warehouse }) => ({
          ...warehouseStock,
          warehouse,
        }),
      ),
    };
  }

  private async withMovementRelations(movement: InventoryStockMovement) {
    const [stock, warehouseRow, productRow, variantRow] = await Promise.all([
      this.db
        .select()
        .from(inventoryStock)
        .where(eq(inventoryStock.id, movement.stockId))
        .then(([row]) => row ?? null),
      this.db
        .select()
        .from(warehouse)
        .where(eq(warehouse.id, movement.warehouseId))
        .then(([row]) => row ?? null),
      this.db
        .select()
        .from(product)
        .where(eq(product.id, movement.productId))
        .then(([row]) => row ?? null),
      movement.variantId
        ? this.db
            .select()
            .from(productVariant)
            .where(eq(productVariant.id, movement.variantId))
            .then(([row]) => row ?? null)
        : Promise.resolve(null),
    ]);

    return {
      ...movement,
      stock,
      warehouse: warehouseRow,
      product: productRow,
      variant: variantRow,
    };
  }

  private async assertOrderItemMatchesRequest(
    businessId: string,
    dto: ReserveOrderStockDto,
  ) {
    const [orderItem] = await this.db
      .select({ id: orderItemTable.id })
      .from(orderItemTable)
      .innerJoin(orderTable, eq(orderTable.id, orderItemTable.orderId))
      .where(
        and(
          eq(orderItemTable.id, dto.orderItemId),
          eq(orderItemTable.orderId, dto.orderId),
          eq(orderItemTable.productId, dto.productId),
          dto.variantId
            ? eq(orderItemTable.variantId, dto.variantId)
            : isNull(orderItemTable.variantId),
          eq(orderTable.businessId, businessId),
          isNull(orderTable.deletedAt),
        ),
      );

    if (!orderItem) {
      throw new NotFoundException("Order item not found");
    }
  }
}
