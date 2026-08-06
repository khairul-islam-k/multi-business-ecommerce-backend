import Decimal from "decimal.js";
import { and, asc, avg, count, desc, eq, isNull } from "drizzle-orm";

import { productReview, productReviewImage, ProductReviewStatus } from "@/database/schema";
import { Injectable, NotFoundException } from "@nestjs/common";

import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import type { PaginationQueryDto } from "../../../common/http/query.dto";
import { DatabaseService } from "../../../database/database.service";
import { ProductCatalogLookupService } from "../common/product-catalog-lookup.service";
import {
  CreateProductReviewDto,
  QueryProductReviewDto,
  UpdateProductReviewStatusDto,
} from "./dto/product-review.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@Injectable()
export class ProductReviewService {
  constructor(
    private readonly database: DatabaseService,
    private readonly lookup: ProductCatalogLookupService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async create(
    currentUser: CurrentUserPayload | null,
    businessId: string,
    dto: CreateProductReviewDto,
    status = ProductReviewStatus.PENDING,
  ) {
    await this.assertReviewTarget(businessId, dto.productId, dto.variantId);

    const [review] = await this.db
      .insert(productReview)
      .values({
        businessId,
        productId: dto.productId,
        variantId: dto.variantId ?? null,
        rating: new Decimal(dto.rating),
        title: this.normalizeNullableText(dto.title),
        comment: this.normalizeNullableText(dto.comment),
        reviewerName: dto.reviewerName.trim(),
        reviewerEmail: this.normalizeNullableText(dto.reviewerEmail),
        reviewerPhone: this.normalizeNullableText(dto.reviewerPhone),
        status,
        createdBy: currentUser?.id,
        updatedBy: currentUser?.id,
      })
      .returning();

    return apiResponse(review, "Product review created successfully");
  }

  async findAll(businessId: string, query: QueryProductReviewDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(productReview.businessId, businessId),
      isNull(productReview.deletedAt),
      query.productId
        ? eq(productReview.productId, query.productId)
        : undefined,
      query.variantId
        ? eq(productReview.variantId, query.variantId)
        : undefined,
      query.status ? eq(productReview.status, query.status) : undefined,
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(productReview)
        .where(where)
        .orderBy(desc(productReview.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(productReview)
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
      "Product reviews were loaded successfully. The response includes the requested page of reviews for this business and pagination metadata for browsing more results.",
    );
  }

  async findApprovedForProduct(
    businessId: string,
    productId: string,
    variantId?: string,
  ) {
    return this.db
      .select()
      .from(productReview)
      .where(
        and(
          eq(productReview.businessId, businessId),
          eq(productReview.productId, productId),
          variantId ? eq(productReview.variantId, variantId) : undefined,
          eq(productReview.status, ProductReviewStatus.APPROVED),
          isNull(productReview.deletedAt),
        ),
      )
      .orderBy(desc(productReview.createdAt));
  }

  async findApprovedForProductPage(
    businessId: string,
    productId: string,
    variantId: string | undefined,
    query?: PaginationQueryDto,
  ) {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 12;
    const skip = (page - 1) * limit;

    const conditions = and(
      eq(productReview.businessId, businessId),
      eq(productReview.productId, productId),
      variantId ? eq(productReview.variantId, variantId) : undefined,
      eq(productReview.status, ProductReviewStatus.APPROVED),
      isNull(productReview.deletedAt),
    );

    const paginatedReviewIds = this.db
      .select({
        id: productReview.id,
        createdAt: productReview.createdAt,
      })
      .from(productReview)
      .where(conditions)
      .orderBy(desc(productReview.createdAt))
      .limit(limit)
      .offset(skip)
      .as("paginated_review_ids");

    const [joinedRows, total] = await Promise.all([
      this.db
        .select({
          review: productReview,
          image: productReviewImage
        })
        .from(productReview)
        .innerJoin(
          paginatedReviewIds,
          eq(productReview.id, paginatedReviewIds.id),
        )
        .leftJoin(
          productReviewImage,
          and(
            eq(productReviewImage.reviewId, productReview.id),
            eq(productReviewImage.businessId, businessId),
            isNull(productReviewImage.deletedAt),
          ),
        )
        .orderBy(
          desc(productReview.createdAt),
          asc(productReviewImage.createdAt),
        ),

      this.db
        .select({
          value: count(),
        })
        .from(productReview)
        .where(conditions)
        .then(([row]) => row?.value ?? 0),
    ]);

    type ReviewRow = typeof productReview.$inferSelect;

    type ReviewImageRow = typeof productReviewImage.$inferSelect;

    const reviewMap = new Map<
      string,
      ReviewRow & {
        images: ReviewImageRow[];
      }
    >();

    for (const row of joinedRows) {
      if (!reviewMap.has(row.review.id)) {
        reviewMap.set(row.review.id, {
          ...row.review,
          images: [],
        });
      }

      if (row.image) {
        reviewMap.get(row.review.id)!.images.push(row.image);
      }
    }

    const reviews = Array.from(reviewMap.values());

    return {
      reviews,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSummary(businessId: string, productId: string, variantId?: string) {
    const [summary] = await this.db
      .select({
        reviewCount: count(),
        averageRating: avg(productReview.rating),
      })
      .from(productReview)
      .where(
        and(
          eq(productReview.businessId, businessId),
          eq(productReview.productId, productId),
          variantId ? eq(productReview.variantId, variantId) : undefined,
          eq(productReview.status, ProductReviewStatus.APPROVED),
          isNull(productReview.deletedAt),
        ),
      );

    return {
      reviewCount: summary?.reviewCount ?? 0,
      averageRating: summary?.averageRating
        ? Number(Number(summary.averageRating).toFixed(2))
        : 0,
    };
  }

  async updateStatus(
    currentUser: CurrentUserPayload,
    businessId: string,
    reviewId: string,
    dto: UpdateProductReviewStatusDto,
  ) {
    const review = await this.getReviewOrThrow(businessId, reviewId);

    const [updated] = await this.db
      .update(productReview)
      .set({ status: dto.status, updatedBy: currentUser.id })
      .where(eq(productReview.id, review.id))
      .returning();

    return apiResponse(updated, "Product review status updated successfully");
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    reviewId: string,
  ) {
    const review = await this.getReviewOrThrow(businessId, reviewId);

    await this.db
      .update(productReview)
      .set({
        deletedAt: new Date(),
        deletedBy: currentUser.id,
        updatedBy: currentUser.id,
      })
      .where(eq(productReview.id, review.id));

    return apiResponse(null, "Product review deleted successfully");
  }

  private async assertReviewTarget(
    businessId: string,
    productId: string,
    variantId?: string,
  ) {
    await this.lookup.assertProductExists(businessId, productId);

    if (variantId) {
      await this.lookup.assertVariantExists(businessId, productId, variantId);
    }
  }

  private async getReviewOrThrow(businessId: string, reviewId: string) {
    const [review] = await this.db
      .select()
      .from(productReview)
      .where(
        and(
          eq(productReview.id, reviewId),
          eq(productReview.businessId, businessId),
          isNull(productReview.deletedAt),
        ),
      )
      .limit(1);

    if (!review) {
      throw new NotFoundException("Product review not found");
    }

    return review;
  }

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalized = value?.trim();

    return normalized || null;
  }
}
