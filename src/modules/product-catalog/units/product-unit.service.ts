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
  CreateProductUnitDto,
  UpdateProductUnitDto,
} from "./dto/product-unit.dto";

const UNIT_INCLUDE = {
  _count: { select: { products: true } },
} satisfies Prisma.ProductUnitInclude;

@Injectable()
export class ProductUnitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: ProductCatalogLookupService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateProductUnitDto,
  ) {
    try {
      const unit = await this.prisma.productUnit.create({
        data: {
          businessId,
          name: this.lookup.normalizeName(dto.name),
          status: dto.status ?? ProductSimpleStatus.ACTIVE,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        },
        include: UNIT_INCLUDE,
      });
      return apiResponse(unit, "Unit created successfully");
    } catch (error) {
      this.lookup.handleUniqueError(error, "Unit name already exists");
    }
  }

  async findAll(businessId: string, query: QueryCatalogDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where: Prisma.ProductUnitWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.productUnit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: query.sortOrder ?? "desc" },
        include: UNIT_INCLUDE,
      }),
      this.prisma.productUnit.count({ where }),
    ]);
    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, unitId: string) {
    const unit = await this.prisma.productUnit.findFirst({
      where: { id: unitId, businessId, deletedAt: null },
      include: UNIT_INCLUDE,
    });
    if (!unit) throw new NotFoundException("Unit not found");
    return apiResponse(unit);
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    unitId: string,
    dto: UpdateProductUnitDto,
  ) {
    await this.findUnitOrThrow(businessId, unitId);
    try {
      const unit = await this.prisma.productUnit.update({
        where: { id: unitId },
        data: {
          ...(dto.name !== undefined && {
            name: this.lookup.normalizeName(dto.name),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          updatedBy: currentUser.id,
        },
        include: UNIT_INCLUDE,
      });
      return apiResponse(unit, "Unit updated successfully");
    } catch (error) {
      this.lookup.handleUniqueError(error, "Unit name already exists");
    }
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    unitId: string,
  ) {
    await this.findUnitOrThrow(businessId, unitId);
    await this.assertUnitCanBeDeleted(businessId, unitId);

    await this.prisma.productUnit.update({
      where: { id: unitId },
      data: {
        status: ProductSimpleStatus.INACTIVE,
        deletedAt: new Date(),
        updatedBy: currentUser.id,
      },
    });
    return apiResponse(null, "Unit deleted successfully");
  }

  private async findUnitOrThrow(businessId: string, unitId: string) {
    const unit = await this.prisma.productUnit.findFirst({
      where: { id: unitId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!unit) throw new NotFoundException("Unit not found");
  }

  private async assertUnitCanBeDeleted(businessId: string, unitId: string) {
    const productCount = await this.prisma.product.count({
      where: { businessId, unitId, deletedAt: null },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        "Unit cannot be deleted while assigned to active products",
      );
    }
  }
}
