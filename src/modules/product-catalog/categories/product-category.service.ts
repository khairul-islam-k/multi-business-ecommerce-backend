import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, ProductSimpleStatus } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { QueryCatalogDto } from "../common/dto/query-catalog.dto";
import { ProductCatalogLookupService } from "../common/product-catalog-lookup.service";
import {
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
} from "./dto/product-category.dto";

const CATEGORY_INCLUDE = {
  parent: true,
  _count: {
    select: {
      children: true,
      products: true,
    },
  },
} satisfies Prisma.ProductCategoryInclude;

@Injectable()
export class ProductCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: ProductCatalogLookupService,
  ) {}

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
      const category = await this.prisma.productCategory.create({
        data: {
          businessId,
          parentId: dto.parentId ?? null,
          name: this.lookup.normalizeName(dto.name),
          description: this.lookup.normalizeNullableText(dto.description),
          imageUrl: this.lookup.normalizeNullableText(dto.imageUrl),
          status: dto.status ?? ProductSimpleStatus.ACTIVE,
          sortOrder: dto.sortOrder ?? 0,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        },
        include: CATEGORY_INCLUDE,
      });

      return apiResponse(category, "Category created successfully");
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

    const where: Prisma.ProductCategoryWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.productCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { sortOrder: "asc" },
          { createdAt: query.sortOrder ?? "desc" },
        ],
        include: CATEGORY_INCLUDE,
      }),
      this.prisma.productCategory.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, categoryId: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id: categoryId, businessId, deletedAt: null },
      include: {
        ...CATEGORY_INCLUDE,
        children: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    return apiResponse(category);
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
      const existing = await this.prisma.productCategory.findUnique({
        where: { id: categoryId },
        select: { name: true, parentId: true },
      });

      await this.lookup.assertCategoryNameAvailable(
        businessId,
        dto.name ?? existing!.name,
        nextParentId !== undefined ? nextParentId : existing!.parentId,
        categoryId,
      );
    }

    try {
      const category = await this.prisma.productCategory.update({
        where: { id: categoryId },
        data: {
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
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          updatedBy: currentUser.id,
        },
        include: CATEGORY_INCLUDE,
      });

      return apiResponse(category, "Category updated successfully");
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

    await this.prisma.productCategory.update({
      where: { id: categoryId },
      data: {
        status: ProductSimpleStatus.INACTIVE,
        deletedAt: new Date(),
        updatedBy: currentUser.id,
      },
    });

    return apiResponse(null, "Category deleted successfully");
  }

  private async findCategoryOrThrow(businessId: string, categoryId: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id: categoryId, businessId, deletedAt: null },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }
  }

  private async assertCategoryCanBeDeleted(
    businessId: string,
    categoryId: string,
  ) {
    const [childCount, productCount] = await Promise.all([
      this.prisma.productCategory.count({
        where: { businessId, parentId: categoryId, deletedAt: null },
      }),
      this.prisma.product.count({
        where: { businessId, categoryId, deletedAt: null },
      }),
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
}
