import { BadRequestException, Injectable } from "@nestjs/common";
import { SupplierProductMapStatus, supplierProductMap } from "@/database/schema";
import Decimal from "decimal.js";
import { and, desc, eq } from "drizzle-orm";

import {
  SupplierProductMapDto,
  UpdateSupplierProductMapDto,
} from "../dto/supplier.dto";
import { normalizeNullableText } from "../domain/supplier-contact.policy";
import { SupplierProductRepository } from "../infrastructure/supplier-product.repository";
import { SupplierRepository } from "../infrastructure/supplier.repository";
import { DatabaseService } from "../../../database/database.service";
import { isUniqueConstraintError } from "../../../common/database/db-error.util";
import { InventoryLookupService } from "../../inventory/common/inventory-lookup.service";
import { apiResponse } from "../../../common/utils/api-response.util";

@Injectable()
export class SupplierProductService {
  constructor(
    private readonly database: DatabaseService,
    private readonly inventoryLookup: InventoryLookupService,
    private readonly suppliers: SupplierRepository,
    private readonly supplierProducts: SupplierProductRepository,
  ) {}

  private get db() {
    return this.database.db;
  }

  async addProduct(
    businessId: string,
    supplierId: string,
    dto: SupplierProductMapDto,
  ) {
    await this.suppliers.assertSupplierExists(businessId, supplierId, true);
    await this.inventoryLookup.assertStockItem(
      businessId,
      dto.productId,
      dto.variantId ?? null,
    );
    const itemKey = this.inventoryLookup.buildStockItemKey(
      dto.productId,
      dto.variantId,
    );

    try {
      const [productMap] = await this.db
        .insert(supplierProductMap)
        .values({
          businessId,
          supplierId,
          productId: dto.productId,
          variantId: dto.variantId ?? null,
          itemKey,
          supplierSku: normalizeNullableText(dto.supplierSku),
          lastPurchasePrice:
            dto.lastPurchasePrice !== undefined
              ? new Decimal(dto.lastPurchasePrice)
              : undefined,
          minOrderQuantity:
            dto.minOrderQuantity !== undefined
              ? new Decimal(dto.minOrderQuantity)
              : undefined,
          leadTimeDays: dto.leadTimeDays,
          status: dto.status ?? SupplierProductMapStatus.ACTIVE,
        })
        .returning();

      return apiResponse(productMap, "Supplier product added successfully");
    } catch (error) {
      this.handleUniqueError(error, "Supplier product already exists");
    }
  }

  async findProducts(businessId: string, supplierId: string) {
    await this.suppliers.assertSupplierExists(businessId, supplierId);

    const products = await this.db
      .select()
      .from(supplierProductMap)
      .where(
        and(
          eq(supplierProductMap.businessId, businessId),
          eq(supplierProductMap.supplierId, supplierId),
        ),
      )
      .orderBy(desc(supplierProductMap.createdAt));

    return apiResponse(products);
  }

  async updateProduct(
    businessId: string,
    supplierId: string,
    productMapId: string,
    dto: UpdateSupplierProductMapDto,
  ) {
    const existingMap =
      await this.supplierProducts.assertSupplierProductMapExists(
        businessId,
        supplierId,
        productMapId,
      );

    const nextProductId = dto.productId ?? existingMap.productId;
    const nextVariantId =
      dto.variantId !== undefined ? dto.variantId : existingMap.variantId;
    const itemKey = this.inventoryLookup.buildStockItemKey(
      nextProductId,
      nextVariantId,
    );

    await this.inventoryLookup.assertStockItem(
      businessId,
      nextProductId,
      nextVariantId,
    );

    try {
      const [productMap] = await this.db
        .update(supplierProductMap)
        .set({
          ...(dto.productId !== undefined || dto.variantId !== undefined
            ? {
                productId: nextProductId,
                variantId: nextVariantId ?? null,
                itemKey,
              }
            : {}),
          ...(dto.supplierSku !== undefined && {
            supplierSku: normalizeNullableText(dto.supplierSku),
          }),
          ...(dto.lastPurchasePrice !== undefined && {
            lastPurchasePrice: new Decimal(dto.lastPurchasePrice),
          }),
          ...(dto.minOrderQuantity !== undefined && {
            minOrderQuantity: new Decimal(dto.minOrderQuantity),
          }),
          ...(dto.leadTimeDays !== undefined && {
            leadTimeDays: dto.leadTimeDays,
          }),
          ...(dto.status !== undefined && { status: dto.status }),
        })
        .where(eq(supplierProductMap.id, productMapId))
        .returning();

      return apiResponse(productMap, "Supplier product updated successfully");
    } catch (error) {
      this.handleUniqueError(error, "Supplier product already exists");
    }
  }

  async removeProduct(
    businessId: string,
    supplierId: string,
    productMapId: string,
  ) {
    await this.supplierProducts.assertSupplierProductMapExists(
      businessId,
      supplierId,
      productMapId,
    );

    await this.db
      .delete(supplierProductMap)
      .where(eq(supplierProductMap.id, productMapId));

    return apiResponse(null, "Supplier product removed successfully");
  }

  private handleUniqueError(error: unknown, message: string): never {
    if (isUniqueConstraintError(error)) {
      throw new BadRequestException(message);
    }

    throw error;
  }
}
