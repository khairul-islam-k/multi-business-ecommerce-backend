import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type ProductTag,
  ProductSimpleStatus,
  product,
  productTag,
  productTagMap,
} from "@/database/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  isNull,
} from "drizzle-orm";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { QueryCatalogDto } from "../common/dto/query-catalog.dto";
import {
  CreateProductTagDto,
  UpdateProductTagDto,
} from "./dto/product-tag.dto";
import { ProductCatalogLookupService } from "../common/product-catalog-lookup.service";
import { DatabaseService } from "../../../database/database.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";

type TagWithCount = ProductTag & {
  _count: { products: number };
};

@Injectable()
export class ProductTagService {
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
    dto: CreateProductTagDto,
  ) {
    try {
      const [tag] = await this.db
        .insert(productTag)
        .values({
          businessId,
          name: this.lookup.normalizeName(dto.name),
          status: dto.status ?? ProductSimpleStatus.ACTIVE,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        })
        .returning();

      return apiResponse(await this.withTagCount(tag), "Tag created successfully");
    } catch (error) {
      this.lookup.handleUniqueError(error, "Tag name already exists");
    }
  }

  async findAll(businessId: string, query: QueryCatalogDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(productTag.businessId, businessId),
      isNull(productTag.deletedAt),
      query.status ? eq(productTag.status, query.status) : undefined,
      query.search ? ilike(productTag.name, `%${query.search}%`) : undefined,
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(productTag)
        .where(where)
        .orderBy(
          query.sortOrder === "asc"
            ? asc(productTag.createdAt)
            : desc(productTag.createdAt),
        )
        .limit(limit)
        .offset(skip)
        .then((rows) => this.withTagsCount(rows)),
      this.db
        .select({ value: count() })
        .from(productTag)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, tagId: string) {
    const tag = await this.findTagRow(businessId, tagId);

    if (!tag) {
      throw new NotFoundException("Tag not found");
    }

    return apiResponse(await this.withTagCount(tag));
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    tagId: string,
    dto: UpdateProductTagDto,
  ) {
    await this.findTagOrThrow(businessId, tagId);

    try {
      const [tag] = await this.db
        .update(productTag)
        .set({
          ...(dto.name !== undefined && {
            name: this.lookup.normalizeName(dto.name),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          updatedBy: currentUser.id,
        })
        .where(eq(productTag.id, tagId))
        .returning();

      return apiResponse(await this.withTagCount(tag), "Tag updated successfully");
    } catch (error) {
      this.lookup.handleUniqueError(error, "Tag name already exists");
    }
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    tagId: string,
  ) {
    await this.findTagOrThrow(businessId, tagId);
    await this.assertTagCanBeDeleted(tagId);

    await this.db
      .update(productTag)
      .set({
        status: ProductSimpleStatus.INACTIVE,
        deletedAt: new Date(),
        updatedBy: currentUser.id,
      })
      .where(eq(productTag.id, tagId));

    return apiResponse(null, "Tag deleted successfully");
  }

  private async findTagOrThrow(businessId: string, tagId: string) {
    const tag = await this.findTagRow(businessId, tagId);

    if (!tag) {
      throw new NotFoundException("Tag not found");
    }
  }

  private findTagRow(businessId: string, tagId: string) {
    return this.db
      .select()
      .from(productTag)
      .where(
        and(
          eq(productTag.id, tagId),
          eq(productTag.businessId, businessId),
          isNull(productTag.deletedAt),
        ),
      )
      .limit(1)
      .then(([tag]) => tag ?? null);
  }

  private async assertTagCanBeDeleted(tagId: string) {
    const [{ value }] = await this.db
      .select({ value: count() })
      .from(productTagMap)
      .where(
        and(
          eq(productTagMap.tagId, tagId),
          exists(
            this.db
              .select({ id: product.id })
              .from(product)
              .where(
                and(
                  eq(product.id, productTagMap.productId),
                  isNull(product.deletedAt),
                ),
              ),
          ),
        ),
      );

    if (value > 0) {
      throw new BadRequestException(
        "Tag cannot be deleted while assigned to active products",
      );
    }
  }

  private async withTagsCount(tags: ProductTag[]) {
    return Promise.all(tags.map((tag) => this.withTagCount(tag)));
  }

  private async withTagCount(tag: ProductTag): Promise<TagWithCount> {
    const [{ value }] = await this.db
      .select({ value: count() })
      .from(productTagMap)
      .where(eq(productTagMap.tagId, tag.id));

    return {
      ...tag,
      _count: {
        products: value,
      },
    };
  }
}
