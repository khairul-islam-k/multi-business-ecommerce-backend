import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { QueryStockDto, UpdateStockAlertDto } from "./dto/stock.dto";

const STOCK_INCLUDE = {
  warehouse: true,
} satisfies Prisma.InventoryStockInclude;

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(businessId: string, query: QueryStockDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryStockWhereInput = {
      businessId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.search
        ? {
            OR: [
              {
                warehouse: {
                  name: { contains: query.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.inventoryStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: STOCK_INCLUDE,
      }),
      this.prisma.inventoryStock.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, stockId: string) {
    const stock = await this.prisma.inventoryStock.findFirst({
      where: { id: stockId, businessId },
      include: STOCK_INCLUDE,
    });

    if (!stock) {
      throw new NotFoundException("Stock not found");
    }

    return apiResponse(stock);
  }

  async updateAlert(
    _currentUser: CurrentUserPayload,
    businessId: string,
    stockId: string,
    dto: UpdateStockAlertDto,
  ) {
    await this.findStockOrThrow(businessId, stockId);

    const stock = await this.prisma.inventoryStock.update({
      where: { id: stockId },
      data: { lowStockAlertQty: dto.lowStockAlertQty },
      include: STOCK_INCLUDE,
    });

    return apiResponse(stock, "Stock alert updated successfully");
  }

  async findMovements(businessId: string, query: QueryStockDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryStockMovementWhereInput = {
      businessId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.variantId ? { variantId: query.variantId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.inventoryStockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { warehouse: true },
      }),
      this.prisma.inventoryStockMovement.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  private async findStockOrThrow(businessId: string, stockId: string) {
    const stock = await this.prisma.inventoryStock.findFirst({
      where: { id: stockId, businessId },
      select: { id: true },
    });

    if (!stock) {
      throw new NotFoundException("Stock not found");
    }
  }
}
