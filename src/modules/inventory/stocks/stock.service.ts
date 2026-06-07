import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import { PrismaService } from "../../../prisma/prisma.service";
import { InventoryLookupService } from "../common/inventory-lookup.service";
import {
  FulfillOrderAllocationDto,
  QueryStockDto,
  ReleaseOrderAllocationDto,
  ReserveOrderStockDto,
  UpdateStockAlertDto,
} from "./dto/stock.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
const STOCK_INCLUDE = {
  product: true,
  variant: true,
  warehouseStocks: {
    include: { warehouse: true },
    orderBy: { updatedAt: "desc" },
  },
} satisfies Prisma.InventoryStockInclude;

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: InventoryLookupService,
  ) {}

  async findAll(businessId: string, query: QueryStockDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryStockWhereInput = {
      businessId,
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.warehouseId
        ? {
            warehouseStocks: {
              some: { warehouseId: query.warehouseId },
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                product: {
                  name: { contains: query.search, mode: "insensitive" },
                },
              },
              {
                variant: {
                  title: { contains: query.search, mode: "insensitive" },
                },
              },
              {
                warehouseStocks: {
                  some: {
                    warehouse: {
                      name: { contains: query.search, mode: "insensitive" },
                    },
                  },
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
        include: { stock: true, warehouse: true },
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

  async reserveForOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: ReserveOrderStockDto,
  ) {
    await this.assertOrderItemMatchesRequest(businessId, dto);

    const allocation = await this.prisma.$transaction((tx) =>
      this.lookup.reserveForOrder(tx, {
        businessId,
        orderId: dto.orderId,
        orderItemId: dto.orderItemId,
        productId: dto.productId,
        variantId: dto.variantId ?? null,
        quantity: dto.quantity,
        warehouseId: dto.warehouseId,
        createdBy: currentUser.id,
      }),
    );

    return apiResponse(allocation, "Order stock reserved successfully");
  }

  async releaseOrderAllocation(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: ReleaseOrderAllocationDto,
  ) {
    const allocation = await this.prisma.$transaction((tx) =>
      this.lookup.releaseOrderReservation(
        tx,
        { businessId, allocationId: dto.allocationId },
        currentUser.id,
      ),
    );

    return apiResponse(allocation, "Order stock reservation released");
  }

  async fulfillOrderAllocation(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: FulfillOrderAllocationDto,
  ) {
    const allocation = await this.prisma.$transaction((tx) =>
      this.lookup.fulfillOrderAllocation(
        tx,
        { businessId, allocationId: dto.allocationId },
        currentUser.id,
      ),
    );

    return apiResponse(allocation, "Order stock allocation fulfilled");
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

  private async assertOrderItemMatchesRequest(
    businessId: string,
    dto: ReserveOrderStockDto,
  ) {
    const orderItem = await this.prisma.orderOrderItem.findFirst({
      where: {
        id: dto.orderItemId,
        orderId: dto.orderId,
        productId: dto.productId,
        variantId: dto.variantId ?? null,
        order: {
          businessId,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!orderItem) {
      throw new NotFoundException("Order item not found");
    }
  }
}
