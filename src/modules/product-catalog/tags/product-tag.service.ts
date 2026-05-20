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
  CreateProductTagDto,
  UpdateProductTagDto,
} from "./dto/product-tag.dto";

const TAG_INCLUDE = {
  _count: { select: { products: true } },
} satisfies Prisma.ProductTagInclude;

@Injectable()
export class ProductTagService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: ProductCatalogLookupService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateProductTagDto,
  ) {
    try {
      const tag = await this.prisma.productTag.create({
        data: {
          businessId,
          name: this.lookup.normalizeName(dto.name),
          status: dto.status ?? ProductSimpleStatus.ACTIVE,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        },
        include: TAG_INCLUDE,
      });
      return apiResponse(tag, "Tag created successfully");
    } catch (error) {
      this.lookup.handleUniqueError(error, "Tag name already exists");
    }
  }

  async findAll(businessId: string, query: QueryCatalogDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where: Prisma.ProductTagWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.productTag.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: query.sortOrder ?? "desc" },
        include: TAG_INCLUDE,
      }),
      this.prisma.productTag.count({ where }),
    ]);
    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, tagId: string) {
    const tag = await this.prisma.productTag.findFirst({
      where: { id: tagId, businessId, deletedAt: null },
      include: TAG_INCLUDE,
    });
    if (!tag) throw new NotFoundException("Tag not found");
    return apiResponse(tag);
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    tagId: string,
    dto: UpdateProductTagDto,
  ) {
    await this.findTagOrThrow(businessId, tagId);
    try {
      const tag = await this.prisma.productTag.update({
        where: { id: tagId },
        data: {
          ...(dto.name !== undefined && {
            name: this.lookup.normalizeName(dto.name),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          updatedBy: currentUser.id,
        },
        include: TAG_INCLUDE,
      });
      return apiResponse(tag, "Tag updated successfully");
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

    await this.prisma.productTag.update({
      where: { id: tagId },
      data: {
        status: ProductSimpleStatus.INACTIVE,
        deletedAt: new Date(),
        updatedBy: currentUser.id,
      },
    });
    return apiResponse(null, "Tag deleted successfully");
  }

  private async findTagOrThrow(businessId: string, tagId: string) {
    const tag = await this.prisma.productTag.findFirst({
      where: { id: tagId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!tag) throw new NotFoundException("Tag not found");
  }

  private async assertTagCanBeDeleted(tagId: string) {
    const productCount = await this.prisma.productTagMap.count({
      where: {
        tagId,
        product: {
          deletedAt: null,
        },
      },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        "Tag cannot be deleted while assigned to active products",
      );
    }
  }
}
