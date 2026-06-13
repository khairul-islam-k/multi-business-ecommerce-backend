import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CatalogProductStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { ProductCatalogLookupService } from "../common/product-catalog-lookup.service";
import {
  CreateProductDto,
  QueryProductDto,
  UpdateProductDto,
} from "./dto/product.dto";
import { ProductImageInputDto } from "../common/dto/product-media.dto";
import { buildStockItemKey } from "../../inventory/domain/stock-item-key";
import { PRODUCT_INCLUDE } from "./infrastructure/product.selects";

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: ProductCatalogLookupService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateProductDto,
  ) {
    await this.lookup.assertProductReferences(businessId, dto);

    const tagIds = await this.lookup.assertTagsExist(businessId, dto.tagIds);
    const [slug, sku, barcode] = await Promise.all([
      this.lookup.generateUniqueProductSlug(businessId, dto.name),
      this.lookup.generateUniqueProductSku(businessId),
      this.lookup.generateUniqueProductBarcode(businessId),
    ]);

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const createdProduct = await tx.product.create({
          data: {
            businessId,
            categoryId: dto.categoryId ?? null,
            brandId: dto.brandId ?? null,
            unitId: dto.unitId ?? null,
            name: this.lookup.normalizeName(dto.name),
            slug,
            description: this.lookup.normalizeNullableText(dto.description),
            sku,
            barcode,
            price: dto.price ?? 0,
            weight: dto.weight ?? null,
            status: dto.status ?? CatalogProductStatus.DRAFT,
            createdBy: currentUser.id,
            updatedBy: currentUser.id,
            tags: this.buildTagCreate(tagIds),
            images: this.buildImageCreate(
              businessId,
              currentUser.id,
              dto.images,
            ),
          },
          include: PRODUCT_INCLUDE,
        });

        await tx.inventoryStock.create({
          data: {
            businessId,
            productId: createdProduct.id,
            variantId: null,
            stockItemKey: buildStockItemKey(createdProduct.id, null),
          },
        });

        return createdProduct;
      });

      return apiResponse(
        await this.enrichProductStock(product),
        "Product created successfully",
      );
    } catch (error) {
      this.lookup.handleUniqueError(error, "Product slug already exists");
    }
  }

  async findAll(businessId: string, query: QueryProductDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.tagId ? { tags: { some: { tagId: query.tagId } } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { slug: { contains: query.search, mode: "insensitive" } },
              { sku: { contains: query.search, mode: "insensitive" } },
              { barcode: { contains: query.search, mode: "insensitive" } },
              {
                variants: {
                  some: {
                    sku: { contains: query.search, mode: "insensitive" },
                  },
                },
              },
              {
                variants: {
                  some: {
                    barcode: { contains: query.search, mode: "insensitive" },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: query.sortOrder ?? "desc" },
        include: PRODUCT_INCLUDE,
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginatedResponse(await this.enrichProductsStock(items), {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, businessId, deletedAt: null },
      include: PRODUCT_INCLUDE,
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return apiResponse(await this.enrichProductStock(product));
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    productId: string,
    dto: UpdateProductDto,
  ) {
    await this.lookup.assertProductExists(businessId, productId);
    await this.lookup.assertProductReferences(businessId, dto);

    const tagIds =
      dto.tagIds !== undefined
        ? await this.lookup.assertTagsExist(businessId, dto.tagIds)
        : undefined;

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        if (tagIds !== undefined) {
          await tx.productTagMap.deleteMany({ where: { productId } });
        }

        if (dto.images !== undefined) {
          await tx.productImage.updateMany({
            where: { productId, variantId: null, deletedAt: null },
            data: { deletedAt: new Date(), updatedBy: currentUser.id },
          });
        }

        return tx.product.update({
          where: { id: productId },
          data: {
            ...(dto.categoryId !== undefined && {
              categoryId: dto.categoryId ?? null,
            }),
            ...(dto.brandId !== undefined && { brandId: dto.brandId ?? null }),
            ...(dto.unitId !== undefined && { unitId: dto.unitId ?? null }),
            ...(dto.name !== undefined && {
              name: this.lookup.normalizeName(dto.name),
            }),
            ...(dto.description !== undefined && {
              description: this.lookup.normalizeNullableText(dto.description),
            }),
            ...(dto.price !== undefined && { price: dto.price }),
            ...(dto.weight !== undefined && { weight: dto.weight }),
            ...(dto.status !== undefined && { status: dto.status }),
            updatedBy: currentUser.id,
            ...(tagIds !== undefined && { tags: this.buildTagCreate(tagIds) }),
            ...(dto.images !== undefined && {
              images: this.buildImageCreate(
                businessId,
                currentUser.id,
                dto.images,
              ),
            }),
          },
          include: PRODUCT_INCLUDE,
        });
      });

      return apiResponse(
        await this.enrichProductStock(product),
        "Product updated successfully",
      );
    } catch (error) {
      this.lookup.handleUniqueError(error, "Product slug already exists");
    }
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    productId: string,
  ) {
    await this.lookup.assertProductExists(businessId, productId);
    await this.assertProductCanBeDeleted(businessId, productId);

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          status: CatalogProductStatus.ARCHIVED,
          deletedAt: new Date(),
          updatedBy: currentUser.id,
        },
      });

      await tx.productVariant.updateMany({
        where: { productId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: currentUser.id },
      });

      await tx.inventoryStock.deleteMany({
        where: { businessId, productId },
      });
    });

    return apiResponse(null, "Product deleted successfully");
  }

  private buildTagCreate(tagIds: string[] = []) {
    return tagIds.length > 0
      ? { create: tagIds.map((tagId) => ({ tagId })) }
      : undefined;
  }

  private buildImageCreate(
    businessId: string,
    userId: string,
    images: ProductImageInputDto[] = [],
  ) {
    return images.length > 0
      ? {
          create: images.map((image, index) => ({
            businessId,
            imageUrl: image.imageUrl.trim(),
            altText: this.lookup.normalizeNullableText(image.altText),
            sortOrder: index,
            isThumbnail: image.isThumbnail,
            createdBy: userId,
            updatedBy: userId,
          })),
        }
      : undefined;
  }

  private async assertProductCanBeDeleted(
    businessId: string,
    productId: string,
  ) {
    const referenceCounts = await Promise.all([
      this.prisma.inventoryStock.count({
        where: {
          businessId,
          productId,
          OR: [{ totalQuantity: { not: 0 } }, { quantityReserved: { not: 0 } }],
        },
      }),
      this.prisma.inventoryWarehouseStock.count({
        where: { businessId, productId },
      }),
      this.prisma.inventoryStockMovement.count({
        where: { businessId, productId },
      }),
      this.prisma.inventoryStockAdjustmentItem.count({ where: { productId } }),
      this.prisma.inventoryStockTransferItem.count({ where: { productId } }),
      this.prisma.orderCartItem.count({ where: { productId } }),
      this.prisma.orderOrderItem.count({ where: { productId } }),
      this.prisma.orderReturnItem.count({ where: { productId } }),
      this.prisma.invoiceItem.count({ where: { productId } }),
      this.prisma.supplierProductMap.count({
        where: { businessId, productId },
      }),
      this.prisma.supplierPurchaseOrderItem.count({
        where: { productId },
      }),
      this.prisma.supplierInvoiceItem.count({ where: { productId } }),
      this.prisma.supplierPurchaseReturnItem.count({
        where: { productId },
      }),
      this.prisma.courierShipmentItem.count({ where: { productId } }),
      this.prisma.inventoryOrderAllocation.count({
        where: { businessId, productId },
      }),
    ]);

    if (referenceCounts.some((count) => count > 0)) {
      throw new BadRequestException(
        "Product cannot be deleted while referenced by inventory, order, invoice, supplier, or courier records",
      );
    }
  }

  private async enrichProductStock<
    T extends Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>,
  >(product: T) {
    const [stock] = await this.enrichProductsStock([product]);

    return stock;
  }

  private async enrichProductsStock<
    T extends Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>,
  >(products: T[]) {
    if (products.length === 0) {
      return products;
    }

    const productIds = products.map((product) => product.id);
    const stocks = await this.prisma.inventoryStock.findMany({
      where: {
        productId: { in: productIds },
      },
      select: {
        productId: true,
        variantId: true,
        totalQuantity: true,
        quantityReserved: true,
      },
    });

    return products.map((product) => {
      const productStocks = stocks.filter(
        (stock) => stock.productId === product.id,
      );
      const hasVariants = product.variants.length > 0;
      const effectiveStocks = hasVariants
        ? productStocks.filter((stock) => stock.variantId !== null)
        : productStocks.filter((stock) => stock.variantId === null);
      const totalQuantity = effectiveStocks.reduce(
        (total, stock) => total.plus(stock.totalQuantity),
        new Prisma.Decimal(0),
      );
      const quantityReserved = effectiveStocks.reduce(
        (total, stock) => total.plus(stock.quantityReserved),
        new Prisma.Decimal(0),
      );

      return {
        ...product,
        stockSummary: {
          totalQuantity,
          quantityReserved,
          availableQuantity: totalQuantity.minus(quantityReserved),
        },
      };
    });
  }
}
