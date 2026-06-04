import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, ProductVariantStatus } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { apiResponse } from "../../../common/utils/api-response.util";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { ProductCatalogLookupService } from "../common/product-catalog-lookup.service";
import {
  CreateProductVariantDto,
  ProductVariantAttributeInputDto,
  QueryProductVariantDto,
  UpdateProductVariantDto,
} from "./dto/product-variant.dto";

const VARIANT_INCLUDE = {
  product: {
    select: { name: true, price: true },
  },
  attributes: {
    include: {
      attribute: true,
      attributeValue: true,
    },
    orderBy: { createdAt: "asc" },
  },
  images: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
} satisfies Prisma.ProductVariantInclude;

@Injectable()
export class ProductVariantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: ProductCatalogLookupService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    productId: string,
    dto: CreateProductVariantDto,
  ) {
    await this.lookup.assertProductExists(businessId, productId);

    const attributes = await this.lookup.assertAttributeValuePairs(
      businessId,
      productId,
      dto.attributes,
    );

    const [sku, barcode] = await Promise.all([
      this.lookup.generateUniqueVariantSku(businessId),
      this.lookup.generateUniqueVariantBarcode(businessId),
    ]);

    try {
      const variant = await this.prisma.$transaction(async (tx) => {
        const createdVariant = await tx.productVariant.create({
          data: {
            businessId,
            productId,
            title: this.lookup.normalizeName(dto.title),
            sku,
            barcode,
            priceOverride: dto.priceOverride ?? null,
            weight: dto.weight ?? null,
            status: dto.status ?? ProductVariantStatus.ACTIVE,
            createdBy: currentUser.id,
            updatedBy: currentUser.id,
            attributes: this.buildAttributeCreate(attributes),
            images: this.buildImageCreate(
              businessId,
              productId,
              currentUser.id,
              dto.images,
            ),
          },
          include: VARIANT_INCLUDE,
        });

        await tx.inventoryStock.create({
          data: {
            businessId,
            productId,
            variantId: createdVariant.id,
            stockItemKey: this.buildStockItemKey(productId, createdVariant.id),
          },
        });

        await this.zeroProductLevelStock(tx, businessId, productId);

        return createdVariant;
      });

      return apiResponse(variant, "Product variant created successfully");
    } catch (error) {
      this.lookup.handleUniqueError(
        error,
        "Variant SKU, barcode, or attribute already exists",
      );
    }
  }

  async findAll(
    businessId: string,
    productId: string,
    query: QueryProductVariantDto,
  ) {
    await this.lookup.assertProductExists(businessId, productId);

    const search = query.search?.trim();
    const where: Prisma.ProductVariantWhereInput = {
      businessId,
      productId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              {
                attributes: {
                  some: {
                    attribute: {
                      name: { contains: search, mode: "insensitive" },
                      deletedAt: null,
                    },
                  },
                },
              },
              {
                attributes: {
                  some: {
                    attributeValue: {
                      value: { contains: search, mode: "insensitive" },
                      deletedAt: null,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const variants = await this.prisma.productVariant.findMany({
      where,
      include: VARIANT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return apiResponse(variants);
  }

  async findOne(businessId: string, productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, businessId, productId, deletedAt: null },
      include: VARIANT_INCLUDE,
    });

    if (!variant) {
      throw new NotFoundException("Product variant not found");
    }

    return apiResponse(variant);
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    productId: string,
    variantId: string,
    dto: UpdateProductVariantDto,
  ) {
    await this.lookup.assertVariantExists(businessId, productId, variantId);

    const attributes =
      dto.attributes !== undefined
        ? await this.lookup.assertAttributeValuePairs(
            businessId,
            productId,
            dto.attributes,
          )
        : undefined;

    try {
      const variant = await this.prisma.$transaction(async (tx) => {
        if (attributes !== undefined) {
          await tx.productVariantAttribute.deleteMany({ where: { variantId } });
        }

        if (dto.images !== undefined) {
          await tx.productImage.updateMany({
            where: { variantId, deletedAt: null },
            data: { deletedAt: new Date(), updatedBy: currentUser.id },
          });
        }

        return tx.productVariant.update({
          where: { id: variantId },
          data: {
            ...(dto.title !== undefined && {
              title: this.lookup.normalizeName(dto.title),
            }),
            ...(dto.priceOverride !== undefined && {
              priceOverride: dto.priceOverride,
            }),
            ...(dto.weight !== undefined && { weight: dto.weight }),
            ...(dto.status !== undefined && { status: dto.status }),
            updatedBy: currentUser.id,
            ...(attributes !== undefined && {
              attributes: this.buildAttributeCreate(attributes),
            }),
            ...(dto.images !== undefined && {
              images: this.buildImageCreate(
                businessId,
                productId,
                currentUser.id,
                dto.images,
              ),
            }),
          },
          include: VARIANT_INCLUDE,
        });
      });

      return apiResponse(variant, "Product variant updated successfully");
    } catch (error) {
      this.lookup.handleUniqueError(error, "Variant attribute already exists");
    }
  }

  async updateAttributes(
    currentUser: CurrentUserPayload,
    businessId: string,
    productId: string,
    variantId: string,
    attributes: ProductVariantAttributeInputDto[],
  ) {
    return this.update(currentUser, businessId, productId, variantId, {
      attributes,
    });
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    productId: string,
    variantId: string,
  ) {
    await this.lookup.assertVariantExists(businessId, productId, variantId);
    await this.assertVariantCanBeDeleted(businessId, variantId);

    await this.prisma.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          status: ProductVariantStatus.INACTIVE,
          deletedAt: new Date(),
          updatedBy: currentUser.id,
        },
      });

      await tx.inventoryStock.deleteMany({
        where: { businessId, variantId },
      });
    });

    return apiResponse(null, "Product variant deleted successfully");
  }

  private buildAttributeCreate(
    attributes: ProductVariantAttributeInputDto[] = [],
  ) {
    return attributes.length > 0
      ? {
          create: attributes.map((attribute) => ({
            attributeId: attribute.attributeId,
            attributeValueId: attribute.attributeValueId,
          })),
        }
      : undefined;
  }

  private buildImageCreate(
    businessId: string,
    productId: string,
    userId: string,
    images: { imageUrl: string; altText?: string }[] = [],
  ) {
    return images.length > 0
      ? {
          create: images.map((image, index) => ({
            businessId,
            productId,
            imageUrl: image.imageUrl.trim(),
            altText: this.lookup.normalizeNullableText(image.altText),
            sortOrder: index,
            isThumbnail: index === 0,
            createdBy: userId,
            updatedBy: userId,
          })),
        }
      : undefined;
  }

  private async assertVariantCanBeDeleted(
    businessId: string,
    variantId: string,
  ) {
    const referenceCounts = await Promise.all([
      this.prisma.inventoryStock.count({
        where: {
          businessId,
          variantId,
          OR: [{ totalQuantity: { not: 0 } }, { quantityReserved: { not: 0 } }],
        },
      }),
      this.prisma.inventoryWarehouseStock.count({
        where: { businessId, variantId },
      }),
      this.prisma.inventoryStockMovement.count({
        where: { businessId, variantId },
      }),
      this.prisma.inventoryStockAdjustmentItem.count({ where: { variantId } }),
      this.prisma.inventoryStockTransferItem.count({ where: { variantId } }),
      this.prisma.orderCartItem.count({ where: { variantId } }),
      this.prisma.orderOrderItem.count({ where: { variantId } }),
      this.prisma.orderReturnItem.count({ where: { variantId } }),
      this.prisma.invoiceItem.count({ where: { variantId } }),
      this.prisma.supplierProductMap.count({
        where: { businessId, variantId },
      }),
      this.prisma.supplierPurchaseOrderItem.count({
        where: { variantId },
      }),
      this.prisma.supplierInvoiceItem.count({ where: { variantId } }),
      this.prisma.supplierPurchaseReturnItem.count({
        where: { variantId },
      }),
      this.prisma.courierShipmentItem.count({ where: { variantId } }),
      this.prisma.inventoryOrderAllocation.count({
        where: { businessId, variantId },
      }),
    ]);

    if (referenceCounts.some((count) => count > 0)) {
      throw new BadRequestException(
        "Product variant cannot be deleted while referenced by inventory, order, invoice, supplier, or courier records",
      );
    }
  }

  private buildStockItemKey(productId: string, variantId?: string | null) {
    return variantId ?? `product:${productId}`;
  }

  private async zeroProductLevelStock(
    tx: Prisma.TransactionClient,
    businessId: string,
    productId: string,
  ) {
    const stockItemKey = this.buildStockItemKey(productId, null);
    const productStock = await tx.inventoryStock.findUnique({
      where: {
        businessId_stockItemKey: {
          businessId,
          stockItemKey,
        },
      },
    });

    if (!productStock) {
      await tx.inventoryStock.create({
        data: {
          businessId,
          productId,
          variantId: null,
          stockItemKey,
        },
      });
      return;
    }

    await tx.inventoryStock.update({
      where: { id: productStock.id },
      data: {
        totalQuantity: 0,
        quantityReserved: 0,
      },
    });

    await tx.inventoryWarehouseStock.updateMany({
      where: {
        businessId,
        productId,
        variantId: null,
      },
      data: {
        totalQuantity: 0,
        quantityReserved: 0,
      },
    });
  }
}
