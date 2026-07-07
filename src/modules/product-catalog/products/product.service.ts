import Decimal from "decimal.js";
import {
  and,
  asc,
  avg,
  count,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  ne,
  or,
} from "drizzle-orm";

import {
  CatalogProductStatus,
  businessSetting,
  courierShipmentItem,
  inventoryOrderAllocation,
  inventoryStock,
  inventoryStockAdjustmentItem,
  inventoryStockMovement,
  inventoryStockTransferItem,
  inventoryWarehouseStock,
  invoiceItem,
  orderCartItem,
  orderItem,
  orderReturnItem,
  Product,
  product,
  productAttribute,
  productAttributeValue,
  ProductBrand,
  productBrand,
  ProductCategory,
  productCategory,
  ProductImage,
  productImage,
  productReview,
  ProductReviewStatus,
  ProductTag,
  productTag,
  ProductTagMap,
  productTagMap,
  ProductUnit,
  productUnit,
  ProductVariant,
  productVariant,
  ProductVariantAttribute,
  productVariantAttribute,
  supplierInvoiceItem,
  supplierProductMap,
  supplierPurchaseOrderItem,
  supplierPurchaseReturnItem,
} from "@/database/schema";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  buildOrderBy,
  resolveSortColumn,
} from "../../../common/http/sort.util";
import {
  normalizeSearch,
  normalizeSearchUuid,
} from "../../../common/http/search.util";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import { DatabaseService } from "../../../database/database.service";
import { buildStockItemKey } from "../../inventory/domain/stock-item-key";
import { ProductImageInputDto } from "../common/dto/product-media.dto";
import { ProductCatalogLookupService } from "../common/product-catalog-lookup.service";
import {
  CreateProductDto,
  ProductSortBy,
  QueryProductDto,
  UpdateProductDto,
} from "./dto/product.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

type ProductTagWithTag = ProductTagMap & {
  tag: ProductTag;
};

type VariantAttributeWithDetails = ProductVariantAttribute & {
  attribute: typeof productAttribute.$inferSelect;
  attributeValue: typeof productAttributeValue.$inferSelect;
};

type ProductVariantWithDetails = ProductVariant & {
  attributes: VariantAttributeWithDetails[];
  images: ProductImage[];
};

type ProductReviewSummary = {
  reviewCount: number;
  averageRating: number;
};

type ProductWithDetails = Product & {
  category: ProductCategory | null;
  brand: ProductBrand | null;
  unit: ProductUnit | null;
  tags: ProductTagWithTag[];
  images: ProductImage[];
  variants: ProductVariantWithDetails[];
  reviewSummary: ProductReviewSummary;
};

type ProductWithStock = ProductWithDetails & {
  stockSummary: {
    totalQuantity: Decimal;
    quantityReserved: Decimal;
    availableQuantity: Decimal;
  };
};

@Injectable()
export class ProductService {
  constructor(
    private readonly database: DatabaseService,
    private readonly lookup: ProductCatalogLookupService,
  ) {}

  private get db() {
    return this.database.db;
  }

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
      const created = await this.db.transaction(async (tx) => {
        const [createdProduct] = await tx
          .insert(product)
          .values({
            businessId,
            categoryId: dto.categoryId,
            brandId: dto.brandId,
            unitId: dto.unitId,
            taxId: dto.taxId,
            name: this.lookup.normalizeName(dto.name),
            slug,
            description: this.lookup.normalizeNullableText(dto.description),
            sku,
            barcode,
            price: new Decimal(dto.price ?? 0),
            weight: new Decimal(dto.weight),
            status: dto.status ?? CatalogProductStatus.DRAFT,
            createdBy: currentUser.id,
            updatedBy: currentUser.id,
          })
          .returning();

        await this.insertTagMaps(tx, createdProduct.id, tagIds);
        await this.insertImages(tx, {
          businessId,
          productId: createdProduct.id,
          userId: currentUser.id,
          images: dto.images,
        });

        const lowStockAlertQty = await this.resolveLowStockThreshold(
          tx,
          businessId,
        );

        await tx.insert(inventoryStock).values({
          businessId,
          productId: createdProduct.id,
          variantId: null,
          stockItemKey: buildStockItemKey(createdProduct.id, null),
          lowStockAlertQty,
          quantityReserved: new Decimal(0),
          totalQuantity: new Decimal(0),
        });

        return this.getProductDetails(createdProduct);
      });

      return apiResponse(
        await this.enrichProductStock(await this.enrichProductRating(created)),
        "Product created successfully",
      );
    } catch (error) {
      this.lookup.handleUniqueError(error, "Product name already exists");
    }
  }

  async findAll(businessId: string, query: QueryProductDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);
    const where = and(
      eq(product.businessId, businessId),
      isNull(product.deletedAt),
      query.status ? eq(product.status, query.status) : undefined,
      query.categoryId ? eq(product.categoryId, query.categoryId) : undefined,
      query.brandId ? eq(product.brandId, query.brandId) : undefined,
      query.tagId
        ? exists(
            this.db
              .select({ id: productTagMap.id })
              .from(productTagMap)
              .where(
                and(
                  eq(productTagMap.productId, product.id),
                  eq(productTagMap.tagId, query.tagId),
                ),
              ),
          )
        : undefined,
      query.warehouseId
        ? exists(
            this.db
              .select({ id: inventoryWarehouseStock.id })
              .from(inventoryWarehouseStock)
              .where(
                and(
                  eq(inventoryWarehouseStock.businessId, businessId),
                  eq(inventoryWarehouseStock.productId, product.id),
                  eq(inventoryWarehouseStock.warehouseId, query.warehouseId),
                ),
              ),
          )
        : undefined,
      search
        ? or(
            searchUuid ? eq(product.id, searchUuid) : undefined,
            ilike(product.name, `%${search}%`),
            ilike(product.slug, `%${search}%`),
            ilike(product.sku, `%${search}%`),
            ilike(product.barcode, `%${search}%`),
            exists(
              this.db
                .select({ id: productVariant.id })
                .from(productVariant)
                .where(
                  and(
                    eq(productVariant.productId, product.id),
                    or(
                      searchUuid
                        ? eq(productVariant.id, searchUuid)
                        : undefined,
                      ilike(productVariant.title, `%${search}%`),
                      ilike(productVariant.sku, `%${search}%`),
                      ilike(productVariant.barcode, `%${search}%`),
                    ),
                  ),
                ),
            ),
          )
        : undefined,
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(product)
        .where(where)
        .orderBy(
          buildOrderBy(
            resolveSortColumn(
              query.sortBy,
              {
                [ProductSortBy.NAME]: product.name,
                [ProductSortBy.PRICE]: product.price,
                [ProductSortBy.CREATED_AT]: product.createdAt,
                [ProductSortBy.UPDATED_AT]: product.updatedAt,
              },
              ProductSortBy.CREATED_AT,
            ),
            query.sortOrder,
          ),
        )
        .limit(limit)
        .offset(skip)
        .then((rows) => this.getProductsDetails(rows))
        .then((rows) => this.enrichProductsRating(rows))
        .then((rows) => this.enrichProductsStock(rows)),
      this.db
        .select({ value: count() })
        .from(product)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      items,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Products were loaded successfully. The response includes the requested page of products for this business and pagination metadata for browsing more results.",
    );
  }

  async findOne(businessId: string, productId: string) {
    const row = await this.findProductRow(businessId, productId);

    if (!row) {
      throw new NotFoundException(
        "Product could not be found. It may not exist, may have been deleted, or may not belong to the current business or storefront.",
      );
    }

    return apiResponse(
      await this.enrichProductStock(
        await this.enrichProductRating(await this.getProductDetails(row)),
      ),
    );
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
      const updated = await this.db.transaction(async (tx) => {
        if (tagIds !== undefined) {
          await tx
            .delete(productTagMap)
            .where(eq(productTagMap.productId, productId));
          await this.insertTagMaps(tx, productId, tagIds);
        }

        if (dto.images !== undefined) {
          await tx
            .update(productImage)
            .set({
              deletedAt: new Date(),
              deletedBy: currentUser.id,
              updatedBy: currentUser.id,
            })
            .where(
              and(
                eq(productImage.productId, productId),
                isNull(productImage.variantId),
                isNull(productImage.deletedAt),
              ),
            );

          await this.insertImages(tx, {
            businessId,
            productId,
            userId: currentUser.id,
            images: dto.images,
          });
        }

        const [updatedProduct] = await tx
          .update(product)
          .set({
            ...(dto.categoryId !== undefined && {
              categoryId: dto.categoryId ?? null,
            }),
            ...(dto.brandId !== undefined && { brandId: dto.brandId ?? null }),
            ...(dto.unitId !== undefined && { unitId: dto.unitId ?? null }),
            ...(dto.taxId !== undefined && { taxId: dto.taxId }),
            ...(dto.name !== undefined && {
              name: this.lookup.normalizeName(dto.name),
            }),
            ...(dto.description !== undefined && {
              description: this.lookup.normalizeNullableText(dto.description),
            }),
            ...(dto.price !== undefined && { price: new Decimal(dto.price) }),
            ...(dto.weight !== undefined && {
              weight: new Decimal(dto.weight),
            }),
            ...(dto.status !== undefined && { status: dto.status }),
            updatedBy: currentUser.id,
          })
          .where(eq(product.id, productId))
          .returning();

        return this.getProductDetails(updatedProduct);
      });

      return apiResponse(
        await this.enrichProductStock(await this.enrichProductRating(updated)),
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

    await this.db.transaction(async (tx) => {
      await tx
        .update(product)
        .set({
          status: CatalogProductStatus.ARCHIVED,
          deletedAt: new Date(),
          deletedBy: currentUser.id,
          updatedBy: currentUser.id,
        })
        .where(eq(product.id, productId));

      await tx
        .update(productVariant)
        .set({
          deletedAt: new Date(),
          deletedBy: currentUser.id,
          updatedBy: currentUser.id,
        })
        .where(
          and(
            eq(productVariant.productId, productId),
            isNull(productVariant.deletedAt),
          ),
        );

      await tx
        .delete(inventoryStock)
        .where(
          and(
            eq(inventoryStock.businessId, businessId),
            eq(inventoryStock.productId, productId),
          ),
        );
    });

    return apiResponse(null, "Product deleted successfully");
  }

  private async insertTagMaps(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    productId: string,
    tagIds: string[] = [],
  ) {
    if (tagIds.length > 0) {
      await tx.insert(productTagMap).values(
        tagIds.map((tagId) => ({
          productId,
          tagId,
        })),
      );
    }
  }

  private async resolveLowStockThreshold(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    businessId: string,
  ) {
    const [settings] = await tx
      .select({ lowStockThreshold: businessSetting.lowStockThreshold })
      .from(businessSetting)
      .where(eq(businessSetting.businessId, businessId))
      .limit(1);

    return new Decimal(settings?.lowStockThreshold ?? 0);
  }

  private async insertImages(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    params: {
      businessId: string;
      productId: string;
      variantId?: string | null;
      userId: string;
      images: ProductImageInputDto[] | undefined;
    },
  ) {
    if (!params.images?.length) {
      return;
    }

    await tx.insert(productImage).values(
      params.images.map((image) => ({
        businessId: params.businessId,
        productId: params.productId,
        variantId: params.variantId ?? null,
        imageUrl: image.imageUrl.trim(),
        altText: this.lookup.normalizeNullableText(image.altText),
        isThumbnail: image.isThumbnail ?? false,
        createdBy: params.userId,
        updatedBy: params.userId,
      })),
    );
  }

  private async assertProductCanBeDeleted(
    businessId: string,
    productId: string,
  ) {
    const referenceCounts = await Promise.all([
      this.countInventoryStockReferences(businessId, productId),
      this.countByBusinessProduct(
        inventoryWarehouseStock,
        businessId,
        productId,
      ),
      this.countByBusinessProduct(
        inventoryStockMovement,
        businessId,
        productId,
      ),
      this.countByProduct(inventoryStockAdjustmentItem, productId),
      this.countByProduct(inventoryStockTransferItem, productId),
      this.countByProduct(orderCartItem, productId),
      this.countByProduct(orderItem, productId),
      this.countByProduct(orderReturnItem, productId),
      this.countByProduct(invoiceItem, productId),
      this.countByBusinessProduct(supplierProductMap, businessId, productId),
      this.countByProduct(supplierPurchaseOrderItem, productId),
      this.countByProduct(supplierInvoiceItem, productId),
      this.countByProduct(supplierPurchaseReturnItem, productId),
      this.countByProduct(courierShipmentItem, productId),
      this.countByBusinessProduct(
        inventoryOrderAllocation,
        businessId,
        productId,
      ),
    ]);

    if (referenceCounts.some((value) => value > 0)) {
      throw new BadRequestException(
        "Product cannot be deleted while referenced by inventory, order, invoice, supplier, or courier records",
      );
    }
  }

  private async countInventoryStockReferences(
    businessId: string,
    productId: string,
  ) {
    return this.db
      .select({ value: count() })
      .from(inventoryStock)
      .where(
        and(
          eq(inventoryStock.businessId, businessId),
          eq(inventoryStock.productId, productId),
          or(
            ne(inventoryStock.totalQuantity, new Decimal(0)),
            ne(inventoryStock.quantityReserved, new Decimal(0)),
          ),
        ),
      )
      .then(([row]) => row?.value ?? 0);
  }

  private countByBusinessProduct(
    table:
      | typeof inventoryWarehouseStock
      | typeof inventoryStockMovement
      | typeof supplierProductMap
      | typeof inventoryOrderAllocation,
    businessId: string,
    productId: string,
  ) {
    return this.db
      .select({ value: count() })
      .from(table)
      .where(
        and(eq(table.businessId, businessId), eq(table.productId, productId)),
      )
      .then(([row]) => row?.value ?? 0);
  }

  private countByProduct(
    table:
      | typeof inventoryStockAdjustmentItem
      | typeof inventoryStockTransferItem
      | typeof orderCartItem
      | typeof orderItem
      | typeof orderReturnItem
      | typeof invoiceItem
      | typeof supplierPurchaseOrderItem
      | typeof supplierInvoiceItem
      | typeof supplierPurchaseReturnItem
      | typeof courierShipmentItem,
    productId: string,
  ) {
    return this.db
      .select({ value: count() })
      .from(table)
      .where(eq(table.productId, productId))
      .then(([row]) => row?.value ?? 0);
  }

  private async enrichProductRating(product: ProductWithDetails) {
    const [rated] = await this.enrichProductsRating([product]);

    return rated;
  }

  private async enrichProductsRating(
    products: ProductWithDetails[],
  ): Promise<ProductWithDetails[]> {
    if (products.length === 0) {
      return [];
    }

    const productIds = products.map((item) => item.id);
    const summaries = await this.db
      .select({
        productId: productReview.productId,
        reviewCount: count(),
        averageRating: avg(productReview.rating),
      })
      .from(productReview)
      .where(
        and(
          eq(productReview.businessId, products[0].businessId),
          inArray(productReview.productId, productIds),
          eq(productReview.status, ProductReviewStatus.APPROVED),
          isNull(productReview.deletedAt),
        ),
      )
      .groupBy(productReview.productId);

    const summaryByProductId = new Map(
      summaries.map((summary) => [
        summary.productId,
        {
          reviewCount: summary.reviewCount,
          averageRating: summary.averageRating
            ? Number(Number(summary.averageRating).toFixed(2))
            : 0,
        },
      ]),
    );

    return products.map((item) => ({
      ...item,
      reviewSummary:
        summaryByProductId.get(item.id) ?? this.getEmptyReviewSummary(),
    }));
  }

  private async enrichProductStock(product: ProductWithDetails) {
    const [stock] = await this.enrichProductsStock([product]);

    return stock;
  }

  private async enrichProductsStock(
    products: ProductWithDetails[],
  ): Promise<ProductWithStock[]> {
    if (products.length === 0) {
      return [];
    }

    const productIds = products.map((item) => item.id);
    const stocks = await this.db
      .select({
        productId: inventoryStock.productId,
        variantId: inventoryStock.variantId,
        totalQuantity: inventoryStock.totalQuantity,
        quantityReserved: inventoryStock.quantityReserved,
      })
      .from(inventoryStock)
      .where(
        and(
          eq(inventoryStock.businessId, products[0].businessId),
          inArray(inventoryStock.productId, productIds),
        ),
      );

    return products.map((item) => {
      const productStocks = stocks.filter(
        (stock) => stock.productId === item.id,
      );
      const hasVariants = item.variants.length > 0;
      const effectiveStocks = hasVariants
        ? productStocks.filter((stock) => stock.variantId !== null)
        : productStocks.filter((stock) => stock.variantId === null);
      const totalQuantity = effectiveStocks.reduce(
        (total, stock) => total.plus(stock.totalQuantity),
        new Decimal(0),
      );
      const quantityReserved = effectiveStocks.reduce(
        (total, stock) => total.plus(stock.quantityReserved),
        new Decimal(0),
      );

      return {
        ...item,
        stockSummary: {
          totalQuantity,
          quantityReserved,
          availableQuantity: totalQuantity.minus(quantityReserved),
        },
      };
    });
  }

  private async getProductsDetails(products: Product[]) {
    return Promise.all(products.map((item) => this.getProductDetails(item)));
  }

  private async getProductDetails(item: Product): Promise<ProductWithDetails> {
    const [category, brand, unit, tags, images, variants] = await Promise.all([
      item.categoryId ? this.findCategory(item.categoryId) : null,
      item.brandId ? this.findBrand(item.brandId) : null,
      item.unitId ? this.findUnit(item.unitId) : null,
      this.getProductTags(item.id),
      this.getImages(item.id, null),
      this.getVariants(item.id),
    ]);

    return {
      ...item,
      category,
      brand,
      unit,
      tags,
      images,
      variants,
      reviewSummary: this.getEmptyReviewSummary(),
    };
  }

  private getEmptyReviewSummary(): ProductReviewSummary {
    return {
      reviewCount: 0,
      averageRating: 0,
    };
  }

  private async findProductRow(businessId: string, productId: string) {
    return this.db
      .select()
      .from(product)
      .where(
        and(
          eq(product.id, productId),
          eq(product.businessId, businessId),
          isNull(product.deletedAt),
        ),
      )
      .limit(1)
      .then(([row]) => row ?? null);
  }

  private findCategory(categoryId: string) {
    return this.db
      .select()
      .from(productCategory)
      .where(eq(productCategory.id, categoryId))
      .limit(1)
      .then(([row]) => row ?? null);
  }

  private findBrand(brandId: string) {
    return this.db
      .select()
      .from(productBrand)
      .where(eq(productBrand.id, brandId))
      .limit(1)
      .then(([row]) => row ?? null);
  }

  private findUnit(unitId: string) {
    return this.db
      .select()
      .from(productUnit)
      .where(eq(productUnit.id, unitId))
      .limit(1)
      .then(([row]) => row ?? null);
  }

  private async getProductTags(
    productId: string,
  ): Promise<ProductTagWithTag[]> {
    const rows = await this.db
      .select({ map: productTagMap, tag: productTag })
      .from(productTagMap)
      .innerJoin(productTag, eq(productTag.id, productTagMap.tagId))
      .where(eq(productTagMap.productId, productId));

    return rows.map((row) => ({
      ...row.map,
      tag: row.tag,
    }));
  }

  private getImages(productId: string, variantId: string | null) {
    return this.db
      .select()
      .from(productImage)
      .where(
        and(
          eq(productImage.productId, productId),
          variantId === null
            ? isNull(productImage.variantId)
            : eq(productImage.variantId, variantId),
          isNull(productImage.deletedAt),
        ),
      );
  }

  private async getVariants(
    productId: string,
  ): Promise<ProductVariantWithDetails[]> {
    const variants = await this.db
      .select()
      .from(productVariant)
      .where(
        and(
          eq(productVariant.productId, productId),
          isNull(productVariant.deletedAt),
        ),
      );

    return Promise.all(
      variants.map(async (variant) => ({
        ...variant,
        attributes: await this.getVariantAttributes(variant.id),
        images: await this.getImages(productId, variant.id),
      })),
    );
  }

  private async getVariantAttributes(
    variantId: string,
  ): Promise<VariantAttributeWithDetails[]> {
    const rows = await this.db
      .select({
        map: productVariantAttribute,
        attribute: productAttribute,
        attributeValue: productAttributeValue,
      })
      .from(productVariantAttribute)
      .innerJoin(
        productAttribute,
        eq(productAttribute.id, productVariantAttribute.attributeId),
      )
      .innerJoin(
        productAttributeValue,
        eq(productAttributeValue.id, productVariantAttribute.attributeValueId),
      )
      .where(eq(productVariantAttribute.variantId, variantId))
      .orderBy(asc(productVariantAttribute.createdAt));

    return rows.map((row) => ({
      ...row.map,
      attribute: row.attribute,
      attributeValue: row.attributeValue,
    }));
  }
}
