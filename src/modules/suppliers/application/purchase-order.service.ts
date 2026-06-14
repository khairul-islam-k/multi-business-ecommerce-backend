import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, SupplierPurchaseOrderStatus } from "@prisma/client";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import {
  CancelPurchaseOrderDto,
  CreatePurchaseOrderDto,
  QueryPurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from "../dto/supplier.dto";
import {
  assertManualPurchaseOrderStatus,
  assertPurchaseOrderCanCancel,
  assertPurchaseOrderCanRemove,
  assertPurchaseOrderCanUpdate,
} from "../domain/purchase-order-status.policy";
import {
  calculateLineTax,
  calculateLineTotal,
  calculatePurchaseOrderTotals,
} from "../domain/purchase-order-totals.calculator";
import { assertPurchaseOrderItems } from "../domain/purchase-return.policy";
import { normalizeNullableText } from "../domain/supplier-contact.policy";
import { PurchaseOrderRepository } from "../infrastructure/purchase-order.repository";
import { SupplierCodeRepository } from "../infrastructure/supplier-code.repository";
import { SupplierRepository } from "../infrastructure/supplier.repository";
import { PURCHASE_ORDER_INCLUDE } from "../infrastructure/supplier.selects";
import { PrismaService } from "../../../prisma/prisma.service";
import { FinanceLedgerService } from "../../finance/common/finance-ledger.service";
import { InventoryLookupService } from "../../inventory/common/inventory-lookup.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryLookup: InventoryLookupService,
    private readonly finance: FinanceLedgerService,
    private readonly suppliers: SupplierRepository,
    private readonly purchaseOrders: PurchaseOrderRepository,
    private readonly codes: SupplierCodeRepository,
  ) {}

  async createPurchaseOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreatePurchaseOrderDto,
  ) {
    assertPurchaseOrderItems(dto.items);
    assertManualPurchaseOrderStatus(
      dto.status ?? SupplierPurchaseOrderStatus.DRAFT,
    );

    await Promise.all([
      this.suppliers.assertSupplierExists(businessId, dto.supplierId, true),
      this.inventoryLookup.assertWarehouseExists(businessId, dto.warehouseId),
      ...dto.items.map((item) =>
        this.inventoryLookup.assertStockItem(
          businessId,
          item.productId,
          item.variantId ?? null,
        ),
      ),
    ]);

    const tax = await this.finance.assertActiveTax(
      this.prisma,
      businessId,
      dto.taxId,
    );
    const totals = calculatePurchaseOrderTotals(
      dto.items,
      dto.shippingCost ?? 0,
      tax.rate,
    );
    const purchaseOrderNo =
      await this.codes.generateUniquePurchaseOrderNo(businessId);

    try {
      const purchaseOrder = await this.prisma.supplierPurchaseOrder.create({
        data: {
          businessId,
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          taxId: tax.id,
          purchaseOrderNo,
          orderDate: new Date(),
          expectedDeliveryDate: dto.expectedDeliveryDate,
          status: dto.status ?? SupplierPurchaseOrderStatus.DRAFT,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          taxRate: tax.rate,
          shippingCost: totals.shippingCost,
          totalAmount: totals.totalAmount,
          note: normalizeNullableText(dto.note),
          createdBy: currentUser.id,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId ?? null,
              quantityOrdered: item.quantityOrdered,
              unitCost: item.unitCost,
              discountAmount: item.discountAmount ?? 0,
              taxAmount: calculateLineTax(item, tax.rate),
              lineTotal: calculateLineTotal(item, tax.rate),
            })),
          },
        },
        include: PURCHASE_ORDER_INCLUDE,
      });

      return apiResponse(
        purchaseOrder,
        "Supplier purchase order created successfully",
      );
    } catch (error) {
      this.handleUniqueError(error, "Purchase order number already exists");
    }
  }

  async findPurchaseOrders(businessId: string, query: QueryPurchaseOrderDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierPurchaseOrderWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                purchaseOrderNo: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              { note: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.supplierPurchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: PURCHASE_ORDER_INCLUDE,
      }),
      this.prisma.supplierPurchaseOrder.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findPurchaseOrder(businessId: string, purchaseOrderId: string) {
    const purchaseOrder = await this.prisma.supplierPurchaseOrder.findFirst({
      where: { id: purchaseOrderId, businessId, deletedAt: null },
      include: PURCHASE_ORDER_INCLUDE,
    });

    if (!purchaseOrder) {
      await this.purchaseOrders.getPurchaseOrderOrThrow(
        businessId,
        purchaseOrderId,
      );
    }

    return apiResponse(purchaseOrder);
  }

  async updatePurchaseOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseOrderId: string,
    dto: UpdatePurchaseOrderDto,
  ) {
    const existingOrder = await this.purchaseOrders.getPurchaseOrderOrThrow(
      businessId,
      purchaseOrderId,
    );

    assertPurchaseOrderCanUpdate(existingOrder.status);

    if (dto.status !== undefined) {
      assertManualPurchaseOrderStatus(dto.status);
    }

    const shippingCost = dto.shippingCost ?? existingOrder.shippingCost;
    const totalAmount = new Prisma.Decimal(existingOrder.subtotal)
      .minus(existingOrder.discountTotal)
      .plus(existingOrder.taxTotal)
      .plus(shippingCost);

    const purchaseOrder = await this.prisma.supplierPurchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        ...(dto.expectedDeliveryDate !== undefined && {
          expectedDeliveryDate: dto.expectedDeliveryDate,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.shippingCost !== undefined && {
          shippingCost: dto.shippingCost,
          totalAmount,
        }),
        ...(dto.note !== undefined && {
          note: normalizeNullableText(dto.note),
        }),
        approvedBy:
          dto.status === SupplierPurchaseOrderStatus.ORDERED
            ? currentUser.id
            : undefined,
        approvedAt:
          dto.status === SupplierPurchaseOrderStatus.ORDERED
            ? new Date()
            : undefined,
      },
      include: PURCHASE_ORDER_INCLUDE,
    });

    return apiResponse(purchaseOrder, "Purchase order updated successfully");
  }

  async cancelPurchaseOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseOrderId: string,
    dto: CancelPurchaseOrderDto,
  ) {
    void currentUser;
    const purchaseOrder = await this.purchaseOrders.getPurchaseOrderOrThrow(
      businessId,
      purchaseOrderId,
    );

    assertPurchaseOrderCanCancel(purchaseOrder.status);

    const cancelledOrder = await this.prisma.$transaction(async (tx) => {
      return tx.supplierPurchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          status: SupplierPurchaseOrderStatus.CANCELLED,
          note: dto.note,
        },
        include: PURCHASE_ORDER_INCLUDE,
      });
    });

    return apiResponse(cancelledOrder, "Purchase order received successfully");
  }

  async removePurchaseOrder(businessId: string, purchaseOrderId: string) {
    const purchaseOrder = await this.purchaseOrders.getPurchaseOrderOrThrow(
      businessId,
      purchaseOrderId,
    );

    assertPurchaseOrderCanRemove(purchaseOrder.status);

    await this.prisma.supplierPurchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { deletedAt: new Date() },
    });

    return apiResponse(null, "Purchase order deleted successfully");
  }

  private handleUniqueError(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new BadRequestException(message);
    }

    throw error;
  }
}
