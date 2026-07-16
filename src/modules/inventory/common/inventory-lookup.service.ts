import Decimal from "decimal.js";
import { and, count, eq, isNull } from "drizzle-orm";

import {
  CatalogProductStatus,
  businessSetting,
  InventoryMovementType,
  InventoryReferenceType,
  inventoryStock,
  inventoryStockAdjustment,
  inventoryStockTransfer,
  inventoryWarehouseStock,
  productVariant,
  warehouse,
  WarehouseStatus,
} from "@/database/schema";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { BusinessCodePrefixService } from "../../../common/code/business-code-prefix.service";
import { isUniqueConstraintError } from "../../../common/database/db-error.util";
import { normalizeOptionalText } from "../../../common/text/normalizers";
import { generateRandomCode } from "../../../common/utils/code-generator.util";
import { DatabaseService } from "../../../database/database.service";
import { ProductCatalogLookupService } from "../../product-catalog/common/product-catalog-lookup.service";
import { StockMutationService } from "../application/stock-mutation.service";
import { StockReservationService } from "../application/stock-reservation.service";
import { buildStockItemKey } from "../domain/stock-item-key";
import { StockItemRef } from "./inventory.types";

import type { DatabaseTransaction } from "../../../database/database.service";
const INVENTORY_CODE_RETRY_LIMIT = 5;

@Injectable()
export class InventoryLookupService {
  constructor(
    private readonly database: DatabaseService,
    private readonly catalogLookup: ProductCatalogLookupService,
    private readonly stockMutation: StockMutationService,
    private readonly stockReservation: StockReservationService,
    private readonly prefixes: BusinessCodePrefixService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async assertWarehouseExists(businessId: string, warehouseId: string) {
    const [warehouseRow] = await this.db
      .select()
      .from(warehouse)
      .where(
        and(
          eq(warehouse.id, warehouseId),
          eq(warehouse.businessId, businessId),
          isNull(warehouse.deletedAt),
          eq(warehouse.status, WarehouseStatus.ACTIVE),
        ),
      );

    if (!warehouseRow) {
      throw new NotFoundException(
        "Warehouse could not be found. It may not exist, may have been deleted, or may not belong to the current business.",
      );
    }

    return warehouseRow;
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

    const [{ value: variantCount }] = await this.db
      .select({ value: count() })
      .from(productVariant)
      .where(
        and(
          eq(productVariant.businessId, businessId),
          eq(productVariant.productId, productId),
          isNull(productVariant.deletedAt),
        ),
      );

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
    productId: string,
    variantId?: string | null,
  ) {
    const [stock] = await this.db
      .select()
      .from(inventoryStock)
      .where(
        variantId
          ? and(
              eq(inventoryStock.businessId, businessId),
              eq(inventoryStock.productId, productId),
              eq(inventoryStock.variantId, variantId),
              eq(
                inventoryStock.stockItemKey,
                buildStockItemKey(productId, variantId),
              ),
            )
          : and(
              eq(inventoryStock.businessId, businessId),
              eq(inventoryStock.productId, productId),
              isNull(inventoryStock.variantId),
            ),
      );

    return stock ?? null;
  }

  async getWarehouseStock(
    businessId: string,
    warehouseId: string,
    productId: string,
    variantId?: string | null,
  ) {
    const [warehouseStock] = await this.db
      .select()
      .from(inventoryWarehouseStock)
      .where(
        variantId
          ? and(
              eq(inventoryWarehouseStock.businessId, businessId),
              eq(inventoryWarehouseStock.warehouseId, warehouseId),
              eq(inventoryWarehouseStock.productId, productId),
              eq(inventoryWarehouseStock.variantId, variantId),
              eq(
                inventoryWarehouseStock.stockItemKey,
                buildStockItemKey(productId, variantId),
              ),
            )
          : and(
              eq(inventoryWarehouseStock.businessId, businessId),
              eq(inventoryWarehouseStock.warehouseId, warehouseId),
              eq(inventoryWarehouseStock.productId, productId),
              isNull(inventoryWarehouseStock.variantId),
            ),
      );

    return warehouseStock ?? null;
  }

  async createZeroStock(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      productId: string;
      variantId?: string | null;
    },
  ) {
    const stockItemKey = buildStockItemKey(params.productId, params.variantId);
    const lowStockAlertQty = await this.resolveLowStockThreshold(
      tx,
      params.businessId,
    );
    const [stock] = await tx
      .insert(inventoryStock)
      .values({
        businessId: params.businessId,
        productId: params.productId,
        variantId: params.variantId ?? null,
        stockItemKey,
        lowStockAlertQty,
        quantityReserved: new Decimal(0),
        totalQuantity: new Decimal(0),
      })
      .onConflictDoUpdate({
        target: [inventoryStock.businessId, inventoryStock.stockItemKey],
        set: { stockItemKey },
      })
      .returning();

    return stock;
  }

  async generateUniqueAdjustmentNo(businessId: string) {
    const prefix = await this.prefixes.resolve(
      businessId,
      "stockAdjustmentPrefix",
      "ADJ",
    );

    for (let attempt = 0; attempt < INVENTORY_CODE_RETRY_LIMIT; attempt++) {
      const adjustmentNo = generateRandomCode(prefix);
      const [existingAdjustment] = await this.db
        .select({ id: inventoryStockAdjustment.id })
        .from(inventoryStockAdjustment)
        .where(
          and(
            eq(inventoryStockAdjustment.businessId, businessId),
            eq(inventoryStockAdjustment.adjustmentNo, adjustmentNo),
          ),
        );

      if (!existingAdjustment) {
        return adjustmentNo;
      }
    }

    throw new BadRequestException("Could not generate stock adjustment number");
  }

  async generateUniqueTransferNo(businessId: string) {
    const prefix = await this.prefixes.resolve(
      businessId,
      "stockTransferPrefix",
      "TRF",
    );

    for (let attempt = 0; attempt < INVENTORY_CODE_RETRY_LIMIT; attempt++) {
      const transferNo = generateRandomCode(prefix);
      const [existingTransfer] = await this.db
        .select({ id: inventoryStockTransfer.id })
        .from(inventoryStockTransfer)
        .where(
          and(
            eq(inventoryStockTransfer.businessId, businessId),
            eq(inventoryStockTransfer.transferNo, transferNo),
          ),
        );

      if (!existingTransfer) {
        return transferNo;
      }
    }

    throw new BadRequestException("Could not generate stock transfer number");
  }

  async applyStockDelta(
    tx: DatabaseTransaction,
    params: StockItemRef & {
      warehouseId: string;
      quantityDelta: Decimal.Value;
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
    tx: DatabaseTransaction,
    params: StockItemRef & {
      orderId: string;
      orderItemId: string;
      quantity: Decimal.Value;
      warehouseId?: string | null;
      createdBy?: string;
    },
  ) {
    return this.stockReservation.reserveForOrder(tx, params);
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
    return this.stockReservation.reserveStock(tx, params);
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
    return this.stockReservation.releaseStockReservation(tx, params);
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
    return this.stockReservation.deductReservedStock(tx, params);
  }

  async releaseOrderReservation(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      allocationId: string;
    },
    userId?: string,
  ) {
    return this.stockReservation.releaseOrderReservation(tx, params, userId);
  }

  async fulfillOrderAllocation(
    tx: DatabaseTransaction,
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

  private async resolveLowStockThreshold(
    tx: DatabaseTransaction,
    businessId: string,
  ) {
    const [settings] = await tx
      .select({ lowStockThreshold: businessSetting.lowStockThreshold })
      .from(businessSetting)
      .where(eq(businessSetting.businessId, businessId))
      .limit(1);

    return new Decimal(settings?.lowStockThreshold ?? 0);
  }

  normalizeNullableText(value?: string | null) {
    return normalizeOptionalText(value);
  }

  handleUniqueError(error: unknown, message: string): never {
    if (isUniqueConstraintError(error)) {
      throw new BadRequestException(message);
    }

    throw error;
  }
}
