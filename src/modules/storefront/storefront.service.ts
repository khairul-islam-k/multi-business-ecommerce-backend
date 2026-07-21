import Decimal from "decimal.js";
import {
  and,
  asc,
  count,
  eq,
  exists,
  getTableColumns,
  ilike,
  inArray,
  isNull,
  or,
} from "drizzle-orm";

import {
  CatalogProductStatus,
  inventoryStock,
  product,
  productAttribute,
  productAttributeValue,
  productBrand,
  ProductCategory,
  productCategory,
  productImage,
  ProductSimpleStatus,
  productTag,
  productTagMap,
  productVariant,
  productVariantAttribute,
  ProductVariantStatus,
} from "@/database/schema";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  normalizeSearch,
  normalizeSearchUuid,
} from "../../common/http/search.util";
import { buildOrderBy, resolveSortColumn } from "../../common/http/sort.util";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import { DatabaseService } from "../../database/database.service";
import {
  isProductOfferActive,
  resolveProductEffectivePrice,
} from "../product-catalog/common/product-offer-price";
import { ProductReviewService } from "../product-catalog/reviews/product-review.service";
import { WebsiteService } from "../website/website.service";
import {
  ResolveStorefrontVariantDto,
  StorefrontCatalogSearchDto,
  StorefrontProductQueryDto,
  StorefrontProductReviewQueryDto,
  StorefrontProductSortBy,
} from "./dto/storefront.dto";

type CategoryWithDetails = ProductCategory & {
  parent: ProductCategory | null;
  children: ProductCategory[];
  _count: {
    children: number;
    products: number;
  };
};

type CategoryRow = typeof productCategory.$inferInsert;

export type CategoryTreeNode = {
  category: CategoryRow;
  children: CategoryTreeNode[];
};

@Injectable()
export class StorefrontService {
  constructor(
    private readonly database: DatabaseService,
    private readonly websites: WebsiteService,
    private readonly reviews: ProductReviewService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async resolve(host?: string) {
    return apiResponse(await this.getPublishedWebsite(host));
  }

  async findCategories(host?: string, query: StorefrontCatalogSearchDto = {}) {
    const website = await this.getPublishedWebsite(host);
    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);
    const rows = await this.db
      .select()
      .from(productCategory)
      .where(
        and(
          eq(productCategory.businessId, website.businessId),
          eq(productCategory.status, ProductSimpleStatus.ACTIVE),
          isNull(productCategory.deletedAt),
          search
            ? or(
                ilike(productCategory.name, `%${search}%`),
                ilike(productCategory.description, `%${search}%`),
                searchUuid ? eq(productCategory.id, searchUuid) : undefined,
                searchUuid
                  ? eq(productCategory.parentId, searchUuid)
                  : undefined,
              )
            : undefined,
        ),
      )
      .orderBy(asc(productCategory.name))
      .then((rows) => this.withCategoriesDetails(rows));

    const categoryMap = new Map<string, CategoryTreeNode>();

    for (const row of rows) {
      categoryMap.set(row.id, {
        category: row,
        children: [],
      });
    }

    const categories: CategoryTreeNode[] = [];

    for (const row of rows) {
      const node = categoryMap.get(row.id)!;

      if (row.parentId) {
        const parentNode = categoryMap.get(row.parentId);

        if (parentNode) {
          parentNode.children.push(node);
        } else {
          // TODO: if parent is missing/deleted/inactive, treat as root
          categories.push(node);
        }
      } else {
        categories.push(node);
      }
    }

    return apiResponse(categories);
  }

  async findBrands(host?: string, query: StorefrontCatalogSearchDto = {}) {
    const website = await this.getPublishedWebsite(host);
    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);
    const brands = await this.db
      .select()
      .from(productBrand)
      .where(
        and(
          eq(productBrand.businessId, website.businessId),
          eq(productBrand.status, ProductSimpleStatus.ACTIVE),
          isNull(productBrand.deletedAt),
          search
            ? or(
                ilike(productBrand.name, `%${search}%`),
                ilike(productBrand.description, `%${search}%`),
                searchUuid ? eq(productBrand.id, searchUuid) : undefined,
              )
            : undefined,
        ),
      );

    return apiResponse(brands);
  }

  async findTags(host?: string, query: StorefrontCatalogSearchDto = {}) {
    const website = await this.getPublishedWebsite(host);
    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);
    const tags = await this.db
      .select()
      .from(productTag)
      .where(
        and(
          eq(productTag.businessId, website.businessId),
          eq(productTag.status, ProductSimpleStatus.ACTIVE),
          eq(productTag.isFeatured, true),
          isNull(productTag.deletedAt),
          search
            ? or(
                ilike(productTag.name, `%${search}%`),
                searchUuid ? eq(productTag.id, searchUuid) : undefined,
              )
            : undefined,
        ),
      );

    return apiResponse(tags);
  }

  async findProducts(query: StorefrontProductQueryDto, host?: string) {
    const website = await this.getPublishedWebsite(host);
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const skip = (page - 1) * limit;
    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);
    const where = and(
      eq(product.businessId, website.businessId),
      eq(product.status, CatalogProductStatus.ACTIVE),
      isNull(product.deletedAt),
      query.categoryId ? eq(product.categoryId, query.categoryId) : undefined,
      query.brandId ? eq(product.brandId, query.brandId) : undefined,
      query.tagId
        ? inArray(
            product.id,
            this.db
              .select({
                productId: productTagMap.productId,
              })
              .from(productTagMap)
              .where(eq(productTagMap.tagId, query.tagId)),
          )
        : undefined,
      search
        ? or(
            searchUuid ? eq(product.id, searchUuid) : undefined,
            ilike(product.name, `%${search}%`),
            ilike(product.slug, `%${search}%`),
            ilike(product.description, `%${search}%`),
            ilike(product.sku, `%${search}%`),
            ilike(product.barcode, `%${search}%`),
            exists(
              this.db
                .select({ id: productVariant.id })
                .from(productVariant)
                .where(
                  and(
                    eq(productVariant.businessId, website.businessId),
                    eq(productVariant.productId, product.id),
                    isNull(productVariant.deletedAt),
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

    const orderBy = buildOrderBy(
      resolveSortColumn(
        query.sortBy,
        {
          [StorefrontProductSortBy.NAME]: product.name,
          [StorefrontProductSortBy.PRICE]: product.price,
          [StorefrontProductSortBy.CREATED_AT]: product.createdAt,
        },
        StorefrontProductSortBy.CREATED_AT,
      ),
      query.sortOrder,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(product)
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset(skip)
        .then((items) =>
          Promise.all(items.map((item) => this.hydrateProduct(item))),
        ),
      this.db
        .select({ value: count() })
        .from(product)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      rows,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Storefront products were loaded successfully. The response includes the requested page of active storefront products and pagination metadata for browsing more results.",
    );
  }

  async findProduct(host: string | undefined, productSlug: string) {
    const website = await this.getPublishedWebsite(host);
    const item = await this.getActiveProductBySlugOrThrow(
      website.businessId,
      productSlug,
    );

    return apiResponse(await this.hydrateProduct(item));
  }

  async findProductAttributes(host: string | undefined, productSlug: string) {
    const website = await this.getPublishedWebsite(host);
    const item = await this.getActiveProductBySlugOrThrow(
      website.businessId,
      productSlug,
    );
    const variants = await this.findActiveProductVariants(
      item.businessId,
      item.id,
    );

    if (variants.length === 0) {
      return apiResponse([]);
    }

    const variantIds = variants.map((variant) => variant.id);
    const rows = await this.db
      .select()
      .from(productVariantAttribute)
      .innerJoin(
        productAttribute,
        eq(productAttribute.id, productVariantAttribute.attributeId),
      )
      .innerJoin(
        productAttributeValue,
        eq(productAttributeValue.id, productVariantAttribute.attributeValueId),
      )
      .where(
        and(
          inArray(productVariantAttribute.variantId, variantIds),
          eq(productAttribute.businessId, item.businessId),
          eq(productAttribute.status, ProductSimpleStatus.ACTIVE),
          isNull(productAttribute.deletedAt),
          eq(productAttributeValue.businessId, item.businessId),
          isNull(productAttributeValue.deletedAt),
        ),
      );
    const attributeMap = new Map<
      string,
      {
        id: string;
        name: string;
        values: { id: string; value: string }[];
      }
    >();

    for (const row of rows) {
      const attribute = row.product_attributes;
      const value = row.product_attribute_values;
      const existing = attributeMap.get(attribute.id);

      if (!existing) {
        attributeMap.set(attribute.id, {
          id: attribute.id,
          name: attribute.name,
          values: [{ id: value.id, value: value.value }],
        });
        continue;
      }

      if (!existing.values.some((entry) => entry.id === value.id)) {
        existing.values.push({ id: value.id, value: value.value });
      }
    }

    return apiResponse([...attributeMap.values()]);
  }

  async resolveProductVariant(
    host: string | undefined,
    productSlug: string,
    dto: ResolveStorefrontVariantDto,
  ) {
    const website = await this.getPublishedWebsite(host);
    const item = await this.getActiveProductBySlugOrThrow(
      website.businessId,
      productSlug,
    );

    const uniqueAttributeIds = new Set(
      dto.attributes.map((selection) => selection.attributeId),
    );

    if (uniqueAttributeIds.size !== dto.attributes.length) {
      throw new BadRequestException(
        "Each attribute can be selected only once when resolving a variant.",
      );
    }

    const variants = await this.findActiveProductVariants(
      item.businessId,
      item.id,
    );

    if (variants.length === 0) {
      throw new NotFoundException("This product has no active variants.");
    }

    const variantIds = variants.map((variant) => variant.id);
    const attributeRows = await this.db
      .select()
      .from(productVariantAttribute)
      .where(inArray(productVariantAttribute.variantId, variantIds));

    const requestedKey = this.buildAttributeSelectionKey(dto.attributes);
    const matchedVariant = variants.find((variant) => {
      const variantSelections = attributeRows
        .filter((row) => row.variantId === variant.id)
        .map((row) => ({
          attributeId: row.attributeId,
          attributeValueId: row.attributeValueId,
        }));

      return (
        this.buildAttributeSelectionKey(variantSelections) === requestedKey
      );
    });

    if (!matchedVariant) {
      throw new NotFoundException(
        "No active variant matches the selected attributes.",
      );
    }

    return apiResponse(await this.hydrateVariant(item, matchedVariant));
  }

  async findProductReviews(
    host: string | undefined,
    productSlug: string,
    query: StorefrontProductReviewQueryDto,
  ) {
    const website = await this.getPublishedWebsite(host);
    const product = await this.getActiveProductBySlugOrThrow(
      website.businessId,
      productSlug,
    );
    const { reviews, page, limit, total, totalPages } =
      await this.reviews.findApprovedForProductPage(
        website.businessId,
        product.id,
        undefined,
        query,
      );

    return paginatedResponse(
      reviews,
      { page, limit, total, totalPages },
      "Storefront product reviews were loaded successfully. The response includes the requested page of active storefront product reviews and pagination metadata for browsing more results.",
    );
  }

  private async getPublishedWebsite(host?: string) {
    return this.websites.findPublishedByHostOrThrow(host);
  }

  private async getActiveProductBySlugOrThrow(
    businessId: string,
    productSlug: string,
  ) {
    const [item] = await this.db
      .select()
      .from(product)
      .where(
        and(
          eq(product.businessId, businessId),
          eq(product.slug, productSlug),
          eq(product.status, CatalogProductStatus.ACTIVE),
          isNull(product.deletedAt),
        ),
      )
      .limit(1);

    if (!item) {
      throw new NotFoundException(
        "Product could not be found. It may not exist, may have been deleted, or may not belong to the current business or storefront.",
      );
    }

    return item;
  }

  private findActiveProductVariants(businessId: string, productId: string) {
    return this.db
      .select()
      .from(productVariant)
      .where(
        and(
          eq(productVariant.businessId, businessId),
          eq(productVariant.productId, productId),
          eq(productVariant.status, ProductVariantStatus.ACTIVE),
          isNull(productVariant.deletedAt),
        ),
      );
  }

  private async hydrateProduct(item: typeof product.$inferSelect) {
    const [
      category,
      brand,
      tags,
      images,
      variants,
      stocks,
      reviewSummary,
      reviews,
    ] = await Promise.all([
      item.categoryId
        ? this.db
            .select()
            .from(productCategory)
            .where(eq(productCategory.id, item.categoryId))
            .then(([row]) => row ?? null)
        : Promise.resolve(null),
      item.brandId
        ? this.db
            .select()
            .from(productBrand)
            .where(eq(productBrand.id, item.brandId))
            .then(([row]) => row ?? null)
        : Promise.resolve(null),
      this.db
        .select({
          ...getTableColumns(productTag),
        })
        .from(productTagMap)
        .innerJoin(productTag, eq(productTag.id, productTagMap.tagId))
        .where(
          and(
            eq(productTagMap.productId, item.id),
            eq(productTag.businessId, item.businessId),
            eq(productTag.status, ProductSimpleStatus.ACTIVE),
            isNull(productTag.deletedAt),
          ),
        )
        .then((row) => row ?? null),
      this.db
        .select()
        .from(productImage)
        .where(
          and(
            eq(productImage.productId, item.id),
            isNull(productImage.variantId),
            isNull(productImage.deletedAt),
          ),
        ),
      this.findActiveProductVariants(item.businessId, item.id),
      this.db
        .select()
        .from(inventoryStock)
        .where(
          and(
            eq(inventoryStock.businessId, item.businessId),
            eq(inventoryStock.productId, item.id),
          ),
        ),
      this.reviews.getSummary(item.businessId, item.id),
      this.reviews.findApprovedForProduct(item.businessId, item.id),
    ]);
    const variantIds = variants.map((variant) => variant.id);
    const variantImages =
      variantIds.length === 0
        ? []
        : await this.db
            .select()
            .from(productImage)
            .where(
              and(
                eq(productImage.productId, item.id),
                inArray(productImage.variantId, variantIds),
                isNull(productImage.deletedAt),
              ),
            );
    const productEffectivePrice = resolveProductEffectivePrice(item);

    return {
      ...item,
      effectivePrice: productEffectivePrice.toString(),
      offerActive: isProductOfferActive(item),
      category,
      brand,
      tags,
      images,
      variants: variants.map((variant) => ({
        ...variant,
        effectivePrice: (variant.priceOverride ?? productEffectivePrice)
          .toString(),
        images: variantImages.filter((image) => image.variantId === variant.id),
        stockSummary: this.buildVariantStockSummary(stocks, variant.id),
      })),
      stockSummary: this.buildStockSummary(stocks, variants.length > 0),
      reviewSummary,
      reviews,
    };
  }

  private async withCategoriesDetails(categories: ProductCategory[]) {
    return Promise.all(
      categories.map((category) => this.withCategoryDetails(category)),
    );
  }

  private async withCategoryDetails(
    category: ProductCategory,
    options: { onlyActiveChildren?: boolean } = {},
  ): Promise<CategoryWithDetails> {
    const [parent, children, childCount, productCount] = await Promise.all([
      category.parentId
        ? this.db
            .select()
            .from(productCategory)
            .where(eq(productCategory.id, category.parentId))
            .limit(1)
            .then(([row]) => row ?? null)
        : Promise.resolve(null),
      this.db
        .select()
        .from(productCategory)
        .where(
          and(
            eq(productCategory.parentId, category.id),
            options.onlyActiveChildren
              ? isNull(productCategory.deletedAt)
              : undefined,
          ),
        ),
      this.db
        .select({ value: count() })
        .from(productCategory)
        .where(eq(productCategory.parentId, category.id))
        .then(([row]) => row?.value ?? 0),
      this.db
        .select({ value: count() })
        .from(product)
        .where(eq(product.categoryId, category.id))
        .then(([row]) => row?.value ?? 0),
    ]);

    return {
      ...category,
      parent,
      children,
      _count: {
        children: childCount,
        products: productCount,
      },
    };
  }

  private buildStockSummary(
    stocks: (typeof inventoryStock.$inferSelect)[],
    hasVariants: boolean,
  ) {
    const effectiveStocks = hasVariants
      ? stocks.filter((stock) => stock.variantId !== null)
      : stocks.filter((stock) => stock.variantId === null);
    const totalQuantity = effectiveStocks.reduce(
      (total, stock) => total.plus(stock.totalQuantity),
      new Decimal(0),
    );
    const quantityReserved = effectiveStocks.reduce(
      (total, stock) => total.plus(stock.quantityReserved),
      new Decimal(0),
    );

    return {
      totalQuantity: totalQuantity.toString(),
      quantityReserved: quantityReserved.toString(),
      availableQuantity: totalQuantity.minus(quantityReserved).toString(),
      inStock: totalQuantity.minus(quantityReserved).greaterThan(0),
    };
  }

  private async hydrateVariant(
    item: typeof product.$inferSelect,
    variant: typeof productVariant.$inferSelect,
  ) {
    const [images, stocks, attributes] = await Promise.all([
      this.db
        .select()
        .from(productImage)
        .where(
          and(
            eq(productImage.productId, item.id),
            eq(productImage.variantId, variant.id),
            isNull(productImage.deletedAt),
          ),
        ),
      this.db
        .select()
        .from(inventoryStock)
        .where(
          and(
            eq(inventoryStock.businessId, item.businessId),
            eq(inventoryStock.productId, item.id),
            eq(inventoryStock.variantId, variant.id),
          ),
        ),
      this.db
        .select()
        .from(productVariantAttribute)
        .innerJoin(
          productAttribute,
          eq(productAttribute.id, productVariantAttribute.attributeId),
        )
        .innerJoin(
          productAttributeValue,
          eq(
            productAttributeValue.id,
            productVariantAttribute.attributeValueId,
          ),
        )
        .where(eq(productVariantAttribute.variantId, variant.id)),
    ]);
    const productEffectivePrice = resolveProductEffectivePrice(item);

    return {
      ...variant,
      effectivePrice: (variant.priceOverride ?? productEffectivePrice)
        .toString(),
      images,
      attributes: attributes.map((row) => ({
        id: row.product_variant_attributes.id,
        attribute: row.product_attributes,
        value: row.product_attribute_values,
      })),
      stockSummary: this.buildStockSummary(stocks, true),
    };
  }

  private buildVariantStockSummary(
    stocks: (typeof inventoryStock.$inferSelect)[],
    variantId: string,
  ) {
    return this.buildStockSummary(
      stocks.filter((stock) => stock.variantId === variantId),
      true,
    );
  }

  private buildAttributeSelectionKey(
    selections: { attributeId: string; attributeValueId: string }[],
  ) {
    return selections
      .map(
        (selection) => `${selection.attributeId}:${selection.attributeValueId}`,
      )
      .sort()
      .join("|");
  }
}
