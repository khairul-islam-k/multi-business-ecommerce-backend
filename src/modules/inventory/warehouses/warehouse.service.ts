import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, WarehouseStatus } from "@prisma/client";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import {
  CreateWarehouseDto,
  QueryWarehouseDto,
  UpdateWarehouseDto,
} from "./dto/warehouse.dto";
import { PrismaService } from "../../../prisma/prisma.service";
import { InventoryLookupService } from "../common/inventory-lookup.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";

const WAREHOUSE_INCLUDE = {
  _count: {
    select: {
      stocks: true,
      movements: true,
    },
  },
} satisfies Prisma.WarehouseInclude;

@Injectable()
export class WarehouseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: InventoryLookupService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateWarehouseDto,
  ) {
    try {
      const warehouse = await this.prisma.warehouse.create({
        data: {
          businessId,
          name: this.lookup.normalizeName(dto.name),
          phone: this.lookup.normalizeNullableText(dto.phone),
          address: this.lookup.normalizeNullableText(dto.address),
          status: dto.status ?? WarehouseStatus.ACTIVE,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        },
        include: WAREHOUSE_INCLUDE,
      });

      return apiResponse(warehouse, "Warehouse created successfully");
    } catch (error) {
      this.lookup.handleUniqueError(error, "Warehouse name already exists");
    }
  }

  async findAll(businessId: string, query: QueryWarehouseDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.WarehouseWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
              { address: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: query.sortOrder ?? "desc" },
        include: WAREHOUSE_INCLUDE,
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, businessId, deletedAt: null },
      include: WAREHOUSE_INCLUDE,
    });

    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }

    return apiResponse(warehouse);
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    warehouseId: string,
    dto: UpdateWarehouseDto,
  ) {
    await this.findWarehouseOrThrow(businessId, warehouseId);

    try {
      const warehouse = await this.prisma.warehouse.update({
        where: { id: warehouseId },
        data: {
          ...(dto.name !== undefined && {
            name: this.lookup.normalizeName(dto.name),
          }),
          ...(dto.phone !== undefined && {
            phone: this.lookup.normalizeNullableText(dto.phone),
          }),
          ...(dto.address !== undefined && {
            address: this.lookup.normalizeNullableText(dto.address),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          updatedBy: currentUser.id,
        },
        include: WAREHOUSE_INCLUDE,
      });

      return apiResponse(warehouse, "Warehouse updated successfully");
    } catch (error) {
      this.lookup.handleUniqueError(error, "Warehouse name already exists");
    }
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    warehouseId: string,
  ) {
    await this.findWarehouseOrThrow(businessId, warehouseId);
    await this.assertWarehouseCanBeDeleted(businessId, warehouseId);

    await this.prisma.warehouse.update({
      where: { id: warehouseId },
      data: {
        status: WarehouseStatus.INACTIVE,
        deletedAt: new Date(),
        updatedBy: currentUser.id,
      },
    });

    return apiResponse(null, "Warehouse deleted successfully");
  }

  private async findWarehouseOrThrow(businessId: string, warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, businessId, deletedAt: null },
      select: { id: true },
    });

    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }
  }

  private async assertWarehouseCanBeDeleted(
    businessId: string,
    warehouseId: string,
  ) {
    const referenceCounts = await Promise.all([
      this.prisma.inventoryWarehouseStock.count({
        where: { businessId, warehouseId },
      }),
      this.prisma.inventoryStockMovement.count({
        where: { businessId, warehouseId },
      }),
      this.prisma.supplierPurchaseOrder.count({
        where: { businessId, warehouseId },
      }),
    ]);

    if (referenceCounts.some((count) => count > 0)) {
      throw new BadRequestException(
        "Warehouse cannot be deleted while referenced by stock or purchase records",
      );
    }
  }
}
