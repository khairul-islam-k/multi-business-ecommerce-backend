import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  InventoryMovementType,
  InventoryReferenceType,
  InventoryTransferStatus,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { InventoryLookupService } from "../common/inventory-lookup.service";
import {
  CreateStockTransferDto,
  QueryStockTransferDto,
} from "./dto/stock-transfer.dto";

const TRANSFER_INCLUDE = {
  fromWarehouse: true,
  toWarehouse: true,
  items: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.InventoryStockTransferInclude;

@Injectable()
export class StockTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: InventoryLookupService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateStockTransferDto,
  ) {
    this.assertItems(dto.items);

    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException(
        "Source and destination warehouses must be different",
      );
    }

    await Promise.all([
      this.lookup.assertWarehouseExists(businessId, dto.fromWarehouseId),
      this.lookup.assertWarehouseExists(businessId, dto.toWarehouseId),
      ...dto.items.map((item) =>
        this.lookup.assertVariantForStock(
          businessId,
          item.productId,
          item.variantId,
        ),
      ),
    ]);

    try {
      const transfer = await this.prisma.inventoryStockTransfer.create({
        data: {
          businessId,
          transferNo: this.lookup.normalizeName(dto.transferNo),
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          status: InventoryTransferStatus.DRAFT,
          note: this.lookup.normalizeNullableText(dto.note),
          createdBy: currentUser.id,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              requestedQuantity: item.requestedQuantity,
            })),
          },
        },
        include: TRANSFER_INCLUDE,
      });

      return apiResponse(transfer, "Stock transfer created successfully");
    } catch (error) {
      this.lookup.handleUniqueError(
        error,
        "Stock transfer number already exists",
      );
    }
  }

  async findAll(businessId: string, query: QueryStockTransferDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryStockTransferWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.warehouseId
        ? {
            OR: [
              { fromWarehouseId: query.warehouseId },
              { toWarehouseId: query.warehouseId },
            ],
          }
        : {}),
      ...(query.search
        ? {
            transferNo: { contains: query.search, mode: "insensitive" },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.inventoryStockTransfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: TRANSFER_INCLUDE,
      }),
      this.prisma.inventoryStockTransfer.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, transferId: string) {
    const transfer = await this.prisma.inventoryStockTransfer.findFirst({
      where: { id: transferId, businessId, deletedAt: null },
      include: TRANSFER_INCLUDE,
    });

    if (!transfer) {
      throw new NotFoundException("Stock transfer not found");
    }

    return apiResponse(transfer);
  }

  async ship(
    currentUser: CurrentUserPayload,
    businessId: string,
    transferId: string,
  ) {
    const transfer = await this.getTransferOrThrow(
      businessId,
      transferId,
      InventoryTransferStatus.DRAFT,
    );

    const shippedTransfer = await this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        await this.lookup.applyStockDelta(tx, {
          businessId,
          warehouseId: transfer.fromWarehouseId,
          productId: item.productId,
          variantId: item.variantId,
          quantityDelta: new Prisma.Decimal(item.requestedQuantity).negated(),
          movementType: InventoryMovementType.TRANSFER_OUT,
          referenceType: InventoryReferenceType.STOCK_TRANSFER,
          referenceId: transfer.id,
          note: transfer.note,
          createdBy: currentUser.id,
        });

        await tx.inventoryStockTransferItem.update({
          where: { id: item.id },
          data: { transferredQuantity: item.requestedQuantity },
        });
      }

      return tx.inventoryStockTransfer.update({
        where: { id: transferId },
        data: {
          status: InventoryTransferStatus.SHIPPED,
          approvedBy: currentUser.id,
          shippedAt: new Date(),
        },
        include: TRANSFER_INCLUDE,
      });
    });

    return apiResponse(shippedTransfer, "Stock transfer shipped");
  }

  async receive(
    currentUser: CurrentUserPayload,
    businessId: string,
    transferId: string,
  ) {
    const transfer = await this.getTransferOrThrow(
      businessId,
      transferId,
      InventoryTransferStatus.SHIPPED,
    );

    const receivedTransfer = await this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        await this.lookup.applyStockDelta(tx, {
          businessId,
          warehouseId: transfer.toWarehouseId,
          productId: item.productId,
          variantId: item.variantId,
          quantityDelta: item.transferredQuantity,
          movementType: InventoryMovementType.TRANSFER_IN,
          referenceType: InventoryReferenceType.STOCK_TRANSFER,
          referenceId: transfer.id,
          note: transfer.note,
          createdBy: currentUser.id,
        });

        await tx.inventoryStockTransferItem.update({
          where: { id: item.id },
          data: { receivedQuantity: item.transferredQuantity },
        });
      }

      return tx.inventoryStockTransfer.update({
        where: { id: transferId },
        data: {
          status: InventoryTransferStatus.RECEIVED,
          receivedAt: new Date(),
        },
        include: TRANSFER_INCLUDE,
      });
    });

    return apiResponse(receivedTransfer, "Stock transfer received");
  }

  async cancel(
    _currentUser: CurrentUserPayload,
    businessId: string,
    transferId: string,
  ) {
    await this.getTransferOrThrow(
      businessId,
      transferId,
      InventoryTransferStatus.DRAFT,
    );

    const transfer = await this.prisma.inventoryStockTransfer.update({
      where: { id: transferId },
      data: { status: InventoryTransferStatus.CANCELLED },
      include: TRANSFER_INCLUDE,
    });

    return apiResponse(transfer, "Stock transfer cancelled");
  }

  private async getTransferOrThrow(
    businessId: string,
    transferId: string,
    status: InventoryTransferStatus,
  ) {
    const transfer = await this.prisma.inventoryStockTransfer.findFirst({
      where: {
        id: transferId,
        businessId,
        deletedAt: null,
        status,
      },
      include: { items: true },
    });

    if (!transfer) {
      throw new NotFoundException("Stock transfer not found");
    }

    return transfer;
  }

  private assertItems(items: { variantId: string }[]) {
    if (items.length === 0) {
      throw new BadRequestException(
        "At least one stock transfer item is required",
      );
    }

    const variantIds = new Set(items.map((item) => item.variantId));

    if (variantIds.size !== items.length) {
      throw new BadRequestException(
        "Stock transfer cannot contain duplicate variants",
      );
    }
  }
}
