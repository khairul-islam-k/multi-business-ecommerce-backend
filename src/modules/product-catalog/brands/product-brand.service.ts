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
  CreateProductBrandDto,
  UpdateProductBrandDto,
} from "./dto/product-brand.dto";

const BRAND_INCLUDE = {
  _count: { select: { products: true } },
} satisfies Prisma.ProductBrandInclude;

@Injectable()
export class ProductBrandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: ProductCatalogLookupService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateProductBrandDto,
  ) {
    try {
      const brand = await this.prisma.productBrand.create({
        data: {
          businessId,
          name: this.lookup.normalizeName(dto.name),
          description: this.lookup.normalizeNullableText(dto.description),
          logoUrl: this.lookup.normalizeNullableText(dto.logoUrl),
          status: dto.status ?? ProductSimpleStatus.ACTIVE,
          sortOrder: dto.sortOrder ?? 0,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        },
        include: BRAND_INCLUDE,
      });

      return apiResponse(brand, "Brand created successfully");
    } catch (error) {
      this.lookup.handleUniqueError(error, "Brand name already exists");
    }
  }

  async findAll(businessId: string, query: QueryCatalogDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where: Prisma.ProductBrandWhereInput = {
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
      this.prisma.productBrand.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { sortOrder: "asc" },
          { createdAt: query.sortOrder ?? "desc" },
        ],
        include: BRAND_INCLUDE,
      }),
      this.prisma.productBrand.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, brandId: string) {
    const brand = await this.prisma.productBrand.findFirst({
      where: { id: brandId, businessId, deletedAt: null },
      include: BRAND_INCLUDE,
    });

    if (!brand) {
      throw new NotFoundException("Brand not found");
    }

    return apiResponse(brand);
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    brandId: string,
    dto: UpdateProductBrandDto,
  ) {
    await this.findBrandOrThrow(businessId, brandId);

    try {
      const brand = await this.prisma.productBrand.update({
        where: { id: brandId },
        data: {
          ...(dto.name !== undefined && {
            name: this.lookup.normalizeName(dto.name),
          }),
          ...(dto.description !== undefined && {
            description: this.lookup.normalizeNullableText(dto.description),
          }),
          ...(dto.logoUrl !== undefined && {
            logoUrl: this.lookup.normalizeNullableText(dto.logoUrl),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          updatedBy: currentUser.id,
        },
        include: BRAND_INCLUDE,
      });

      return apiResponse(brand, "Brand updated successfully");
    } catch (error) {
      this.lookup.handleUniqueError(error, "Brand name already exists");
    }
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    brandId: string,
  ) {
    await this.findBrandOrThrow(businessId, brandId);
    await this.assertBrandCanBeDeleted(businessId, brandId);

    await this.prisma.productBrand.update({
      where: { id: brandId },
      data: {
        status: ProductSimpleStatus.INACTIVE,
        deletedAt: new Date(),
        updatedBy: currentUser.id,
      },
    });

    return apiResponse(null, "Brand deleted successfully");
  }

  private async findBrandOrThrow(businessId: string, brandId: string) {
    const brand = await this.prisma.productBrand.findFirst({
      where: { id: brandId, businessId, deletedAt: null },
      select: { id: true },
    });

    if (!brand) {
      throw new NotFoundException("Brand not found");
    }
  }

  private async assertBrandCanBeDeleted(businessId: string, brandId: string) {
    const productCount = await this.prisma.product.count({
      where: { businessId, brandId, deletedAt: null },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        "Brand cannot be deleted while assigned to active products",
      );
    }
  }
}
