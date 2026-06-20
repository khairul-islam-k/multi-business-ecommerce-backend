import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CatalogProductStatus,
  ProductSimpleStatus,
  ProductVariantStatus,
  inventoryStock,
  product,
  productBrand,
  productCategory,
  productImage,
  productVariant,
} from "@/database/schema";
import Decimal from "decimal.js";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
} from "drizzle-orm";

import { WebsiteService } from "../website/website.service";
import { ProductReviewService } from "../product-catalog/reviews/product-review.service";
import { DatabaseService } from "../../database/database.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import {
  ResolveStorefrontDto,
  StorefrontProductQueryDto,
} from "./dto/storefront.dto";

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

  async resolve(dto: ResolveStorefrontDto, fallbackHost?: string) {
    const website = dto.websiteId
      ? await this.websites.findPublishedById(dto.websiteId)
      : dto.slug
        ? await this.websites.findPublishedBySlug(dto.slug)
        : await this.websites.findPublishedByHost(
            dto.host ?? fallbackHost ?? "",
          );

    if (!website) {
      throw new NotFoundException("Published storefront not found");
    }

    return apiResponse(website);
  }

  async findCategories(websiteId: string) {
    const website = await this.getPublishedWebsite(websiteId);
    const rows = await this.db
      .select()
      .from(productCategory)
      .where(
        and(
          eq(productCategory.businessId, website.businessId),
          eq(productCategory.status, ProductSimpleStatus.ACTIVE),
          isNull(productCategory.deletedAt),
        ),
      )
      .orderBy(asc(productCategory.sortOrder), asc(productCategory.name));

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

  async findBrands(websiteId: string) {
    const website = await this.getPublishedWebsite(websiteId);
    const brands = await this.db
      .select()
      .from(productBrand)
      .where(
        and(
          eq(productBrand.businessId, (await website).businessId),
          eq(productBrand.status, ProductSimpleStatus.ACTIVE),
          isNull(productBrand.deletedAt),
        ),
      );

    return apiResponse(brands);
  }

  async findProducts(websiteId: string, query: StorefrontProductQueryDto) {
    const website = await this.getPublishedWebsite(websiteId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const where = and(
      eq(product.businessId, website.businessId),
      eq(product.status, CatalogProductStatus.ACTIVE),
      isNull(product.deletedAt),
      query.categoryId ? eq(product.categoryId, query.categoryId) : undefined,
      query.brandId ? eq(product.brandId, query.brandId) : undefined,
      search
        ? or(
            ilike(product.name, `%${search}%`),
            ilike(product.description, `%${search}%`),
            ilike(product.sku, `%${search}%`),
            ilike(product.barcode, `%${search}%`),
          )
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(product)
        .where(where)
        .orderBy(desc(product.createdAt))
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

    return paginatedResponse(rows, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findProduct(websiteId: string, productSlug: string) {
    const website = await this.getPublishedWebsite(websiteId);
    const [item] = await this.db
      .select()
      .from(product)
      .where(
        and(
          eq(product.businessId, website.businessId),
          eq(product.slug, productSlug),
          eq(product.status, CatalogProductStatus.ACTIVE),
          isNull(product.deletedAt),
        ),
      )
      .limit(1);

    if (!item) {
      throw new NotFoundException("Product not found");
    }

    return apiResponse(await this.hydrateProduct(item));
  }

  async findProductReviews(websiteId: string, productId: string) {
    const website = await this.getPublishedWebsite(websiteId);
    const reviews = await this.reviews.findApprovedForProduct(
      website.businessId,
      productId,
    );

    return apiResponse(reviews);
  }

  private async getPublishedWebsite(websiteId: string) {
    const website = await this.websites.findPublishedById(websiteId);

    if (!website) {
      throw new NotFoundException("Published storefront not found");
    }

    return website;
  }

  private async hydrateProduct(item: typeof product.$inferSelect) {
    const [category, brand, images, variants, stocks, reviewSummary, reviews] =
      await Promise.all([
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
          .select()
          .from(productImage)
          .where(
            and(
              eq(productImage.productId, item.id),
              isNull(productImage.variantId),
              isNull(productImage.deletedAt),
            ),
          )
          .orderBy(asc(productImage.sortOrder)),
        this.db
          .select()
          .from(productVariant)
          .where(
            and(
              eq(productVariant.businessId, item.businessId),
              eq(productVariant.productId, item.id),
              eq(productVariant.status, ProductVariantStatus.ACTIVE),
              isNull(productVariant.deletedAt),
            ),
          ),
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
            )
            .orderBy(asc(productImage.sortOrder));

    return {
      ...item,
      category,
      brand,
      images,
      variants: variants.map((variant) => ({
        ...variant,
        effectivePrice: (variant.priceOverride ?? item.price).toString(),
        images: variantImages.filter((image) => image.variantId === variant.id),
      })),
      stockSummary: this.buildStockSummary(stocks, variants.length > 0),
      reviewSummary,
      reviews,
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
}
