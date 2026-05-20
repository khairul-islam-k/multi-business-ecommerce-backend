import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CatalogProductStatus,
  Prisma,
  ProductSimpleStatus,
} from "@prisma/client";

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

const PRODUCT_INCLUDE = {
  category: true,
  brand: true,
  unit: true,
  tags: { include: { tag: true } },
  attributes: {
    where: { deletedAt: null },
    include: {
      values: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { name: "asc" },
  },
  images: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
  variants: {
    where: { deletedAt: null },
    include: {
      attributes: {
        include: {
          attribute: true,
          attributeValue: true,
        },
        orderBy: { createdAt: "asc" },
      },
      images: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
    },
  },
} satisfies Prisma.ProductInclude;

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
    const slug = await this.lookup.generateUniqueProductSlug(
      businessId,
      dto.name,
    );

    try {
      const product = await this.prisma.product.create({
        data: {
          businessId,
          categoryId: dto.categoryId ?? null,
          brandId: dto.brandId ?? null,
          unitId: dto.unitId ?? null,
          name: this.lookup.normalizeName(dto.name),
          slug,
          description: this.lookup.normalizeNullableText(dto.description),
          status: dto.status ?? CatalogProductStatus.DRAFT,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
          tags: this.buildTagCreate(tagIds),
          images: this.buildImageCreate(businessId, currentUser.id, dto.images),
        },
        include: PRODUCT_INCLUDE,
      });

      return apiResponse(product, "Product created successfully");
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

    return paginatedResponse(items, {
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

    return apiResponse(product);
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

      return apiResponse(product, "Product updated successfully");
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

      await tx.productAttribute.updateMany({
        where: { productId, deletedAt: null },
        data: {
          status: ProductSimpleStatus.INACTIVE,
          deletedAt: new Date(),
          updatedBy: currentUser.id,
        },
      });

      const attributes = await tx.productAttribute.findMany({
        where: { productId },
        select: { id: true },
      });
      const attributeIds = attributes.map((attribute) => attribute.id);

      if (attributeIds.length > 0) {
        await tx.productVariantAttribute.deleteMany({
          where: { attributeId: { in: attributeIds } },
        });

        await tx.productAttributeValue.updateMany({
          where: { attributeId: { in: attributeIds }, deletedAt: null },
          data: { deletedAt: new Date(), updatedBy: currentUser.id },
        });
      }
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
    images: { imageUrl: string; altText?: string }[] = [],
  ) {
    return images.length > 0
      ? {
          create: images.map((image, index) => ({
            businessId,
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

  private async assertProductCanBeDeleted(
    businessId: string,
    productId: string,
  ) {
    const referenceCounts = await Promise.all([
      this.prisma.inventoryStock.count({ where: { businessId, productId } }),
      this.prisma.inventoryStockBatch.count({
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
    ]);

    if (referenceCounts.some((count) => count > 0)) {
      throw new BadRequestException(
        "Product cannot be deleted while referenced by inventory, order, invoice, supplier, or courier records",
      );
    }
  }
}
