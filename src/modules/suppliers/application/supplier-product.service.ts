import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, SupplierProductMapStatus } from "@prisma/client";

import {
  SupplierProductMapDto,
  UpdateSupplierProductMapDto,
} from "../dto/supplier.dto";
import { normalizeNullableText } from "../domain/supplier-contact.policy";
import { SupplierProductRepository } from "../infrastructure/supplier-product.repository";
import { SupplierRepository } from "../infrastructure/supplier.repository";
import { PrismaService } from "../../../prisma/prisma.service";
import { InventoryLookupService } from "../../inventory/common/inventory-lookup.service";
import { apiResponse } from "../../../common/utils/api-response.util";

@Injectable()
export class SupplierProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryLookup: InventoryLookupService,
    private readonly suppliers: SupplierRepository,
    private readonly supplierProducts: SupplierProductRepository,
  ) {}

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
      const productMap = await this.prisma.supplierProductMap.create({
        data: {
          businessId,
          supplierId,
          productId: dto.productId,
          variantId: dto.variantId ?? null,
          itemKey,
          supplierSku: normalizeNullableText(dto.supplierSku),
          lastPurchasePrice: dto.lastPurchasePrice,
          minOrderQuantity: dto.minOrderQuantity,
          leadTimeDays: dto.leadTimeDays,
          status: dto.status ?? SupplierProductMapStatus.ACTIVE,
        },
      });

      return apiResponse(productMap, "Supplier product added successfully");
    } catch (error) {
      this.handleUniqueError(error, "Supplier product already exists");
    }
  }

  async findProducts(businessId: string, supplierId: string) {
    await this.suppliers.assertSupplierExists(businessId, supplierId);

    const products = await this.prisma.supplierProductMap.findMany({
      where: { businessId, supplierId },
      orderBy: { createdAt: "desc" },
    });

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
      const productMap = await this.prisma.supplierProductMap.update({
        where: { id: productMapId },
        data: {
          ...(dto.productId !== undefined && { productId: dto.productId }),
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
            lastPurchasePrice: dto.lastPurchasePrice,
          }),
          ...(dto.minOrderQuantity !== undefined && {
            minOrderQuantity: dto.minOrderQuantity,
          }),
          ...(dto.leadTimeDays !== undefined && {
            leadTimeDays: dto.leadTimeDays,
          }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
      });

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

    await this.prisma.supplierProductMap.delete({
      where: { id: productMapId },
    });

    return apiResponse(null, "Supplier product removed successfully");
  }

  private handleUniqueError(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new BadRequestException(message);
    }

    throw error;
  }
}
