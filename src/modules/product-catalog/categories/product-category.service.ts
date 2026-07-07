import { and, count, eq, ilike, isNull, or } from "drizzle-orm";

import {
  product,
  ProductCategory,
  productCategory,
  ProductSimpleStatus,
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
import {
  CatalogSortBy,
  QueryCatalogDto,
} from "../common/dto/query-catalog.dto";
import { ProductCatalogLookupService } from "../common/product-catalog-lookup.service";
import {
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
} from "./dto/product-category.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

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
export class ProductCategoryService {
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
    dto: CreateProductCategoryDto,
  ) {
    await this.lookup.assertCategoryParent(businessId, dto.parentId);
    await this.lookup.assertCategoryNameAvailable(
      businessId,
      dto.name,
      dto.parentId,
    );

    try {
      const [category] = await this.db
        .insert(productCategory)
        .values({
          businessId,
          parentId: dto.parentId ?? null,
          name: this.lookup.normalizeName(dto.name),
          description: this.lookup.normalizeNullableText(dto.description),
          imageUrl: this.lookup.normalizeNullableText(dto.imageUrl),
          status: dto.status ?? ProductSimpleStatus.ACTIVE,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        })
        .returning();

      return apiResponse(
        await this.withCategoryDetails(category),
        "Category created successfully",
      );
    } catch (error) {
      this.lookup.handleUniqueError(
        error,
        "Category name already exists for this parent",
      );
    }
  }

  async findAll(businessId: string, query: QueryCatalogDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);
    const where = and(
      eq(productCategory.businessId, businessId),
      isNull(productCategory.deletedAt),
      query.status ? eq(productCategory.status, query.status) : undefined,
      search
        ? or(
            searchUuid ? eq(productCategory.id, searchUuid) : undefined,
            searchUuid ? eq(productCategory.parentId, searchUuid) : undefined,
            ilike(productCategory.name, `%${search}%`),
            ilike(productCategory.description, `%${search}%`),
          )
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(productCategory)
        .where(where)
        .orderBy(
          buildOrderBy(
            resolveSortColumn(
              query.sortBy,
              {
                [CatalogSortBy.NAME]: productCategory.name,
                [CatalogSortBy.CREATED_AT]: productCategory.createdAt,
                [CatalogSortBy.UPDATED_AT]: productCategory.updatedAt,
              },
              CatalogSortBy.CREATED_AT,
            ),
            query.sortOrder,
          ),
        )
        .limit(limit)
        .offset(skip)
        .then((rows) => this.withCategoriesDetails(rows)),
      this.db
        .select({ value: count() })
        .from(productCategory)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

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
    return paginatedResponse(
      categories,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Product categories were loaded successfully. The response includes the requested page of categories for this business and pagination metadata for browsing more results.",
    );
  }

  async findOne(businessId: string, categoryId: string) {
    const category = await this.findCategoryRow(businessId, categoryId);

    if (!category) {
      throw new NotFoundException(
        "Category could not be found. It may not exist, may have been deleted, or may not belong to the current business.",
      );
    }

    return apiResponse(
      await this.withCategoryDetails(category, { onlyActiveChildren: true }),
    );
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    categoryId: string,
    dto: UpdateProductCategoryDto,
  ) {
    await this.findCategoryOrThrow(businessId, categoryId);

    const nextParentId =
      dto.parentId === undefined ? undefined : (dto.parentId ?? null);

    if (nextParentId !== undefined) {
      await this.lookup.assertCategoryParent(
        businessId,
        nextParentId,
        categoryId,
      );
    }

    if (dto.name !== undefined || nextParentId !== undefined) {
      const existing = await this.findCategoryRow(businessId, categoryId);

      await this.lookup.assertCategoryNameAvailable(
        businessId,
        dto.name ?? existing.name,
        nextParentId !== undefined ? nextParentId : existing.parentId,
        categoryId,
      );
    }

    try {
      const [category] = await this.db
        .update(productCategory)
        .set({
          ...(dto.parentId !== undefined && { parentId: dto.parentId ?? null }),
          ...(dto.name !== undefined && {
            name: this.lookup.normalizeName(dto.name),
          }),
          ...(dto.description !== undefined && {
            description: this.lookup.normalizeNullableText(dto.description),
          }),
          ...(dto.imageUrl !== undefined && {
            imageUrl: this.lookup.normalizeNullableText(dto.imageUrl),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          updatedBy: currentUser.id,
        })
        .where(eq(productCategory.id, categoryId))
        .returning();

      return apiResponse(
        await this.withCategoryDetails(category),
        "Category updated successfully",
      );
    } catch (error) {
      this.lookup.handleUniqueError(
        error,
        "Category name already exists for this parent",
      );
    }
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    categoryId: string,
  ) {
    await this.findCategoryOrThrow(businessId, categoryId);
    await this.assertCategoryCanBeDeleted(businessId, categoryId);

    await this.db
      .update(productCategory)
      .set({
        status: ProductSimpleStatus.INACTIVE,
        deletedAt: new Date(),
        deletedBy: currentUser.id,
        updatedBy: currentUser.id,
      })
      .where(eq(productCategory.id, categoryId));

    return apiResponse(null, "Category deleted successfully");
  }

  private async findCategoryOrThrow(businessId: string, categoryId: string) {
    const category = await this.findCategoryRow(businessId, categoryId);

    if (!category) {
      throw new NotFoundException(
        "Category could not be found. It may not exist, may have been deleted, or may not belong to the current business.",
      );
    }
  }

  private async findCategoryRow(businessId: string, categoryId: string) {
    return this.db
      .select()
      .from(productCategory)
      .where(
        and(
          eq(productCategory.id, categoryId),
          eq(productCategory.businessId, businessId),
          isNull(productCategory.deletedAt),
        ),
      )
      .limit(1)
      .then(([category]) => category ?? null);
  }

  private async assertCategoryCanBeDeleted(
    businessId: string,
    categoryId: string,
  ) {
    const [childCount, productCount] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(productCategory)
        .where(
          and(
            eq(productCategory.businessId, businessId),
            eq(productCategory.parentId, categoryId),
            isNull(productCategory.deletedAt),
          ),
        )
        .then(([row]) => row?.value ?? 0),
      this.db
        .select({ value: count() })
        .from(product)
        .where(
          and(
            eq(product.businessId, businessId),
            eq(product.categoryId, categoryId),
            isNull(product.deletedAt),
          ),
        )
        .then(([row]) => row?.value ?? 0),
    ]);

    if (childCount > 0) {
      throw new BadRequestException(
        "Category cannot be deleted while it has active child categories",
      );
    }

    if (productCount > 0) {
      throw new BadRequestException(
        "Category cannot be deleted while assigned to active products",
      );
    }
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
}
