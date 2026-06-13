import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FinanceReceivableStatus,
  FinanceSourceType,
  InventoryMovementType,
  InventoryReferenceType,
  Prisma,
  SupplierInvoiceStatus,
  SupplierPurchaseOrderStatus,
  SupplierPurchaseReturnStatus,
} from "@prisma/client";

import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { FinanceLedgerService } from "../../finance/common/finance-ledger.service";
import { InventoryLookupService } from "../../inventory/common/inventory-lookup.service";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  CreateSupplierPurchaseReturnDto,
  QuerySupplierPurchaseReturnDto,
} from "../dto/supplier.dto";
import {
  assertPurchaseReturnItems,
  calculatePurchaseReturnTotals,
} from "../domain/purchase-return.policy";
import { normalizeNullableText } from "../domain/supplier-contact.policy";
import { SupplierCodeRepository } from "../infrastructure/supplier-code.repository";
import { PURCHASE_RETURN_INCLUDE } from "../infrastructure/supplier.selects";

@Injectable()
export class PurchaseReturnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryLookup: InventoryLookupService,
    private readonly finance: FinanceLedgerService,
    private readonly codes: SupplierCodeRepository,
  ) {}

  async createPurchaseReturn(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseOrderId: string,
    dto: CreateSupplierPurchaseReturnDto,
  ) {
    assertPurchaseReturnItems(dto.items);

    const purchaseOrder = await this.prisma.supplierPurchaseOrder.findFirst({
      where: {
        id: purchaseOrderId,
        businessId,
        deletedAt: null,
        status: SupplierPurchaseOrderStatus.RECEIVED,
      },
      include: {
        items: true,
        invoices: {
          where: {
            deletedAt: null,
            status: {
              not: SupplierInvoiceStatus.CANCELLED,
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!purchaseOrder) {
      throw new NotFoundException("Received purchase order not found");
    }

    const supplierInvoice = purchaseOrder.invoices[0];

    if (!supplierInvoice) {
      throw new BadRequestException(
        "Purchase order must be received before return",
      );
    }

    const items = await this.buildPurchaseReturnItems(
      businessId,
      purchaseOrder,
      dto.items,
    );
    const totals = calculatePurchaseReturnTotals(items);

    const purchaseReturn = await this.prisma.$transaction(async (tx) => {
      const createdReturn = await tx.supplierPurchaseReturn.create({
        data: {
          businessId,
          supplierId: purchaseOrder.supplierId,
          purchaseOrderId: purchaseOrder.id,
          supplierInvoiceId: supplierInvoice.id,
          warehouseId: purchaseOrder.warehouseId,
          taxId: purchaseOrder.taxId,
          returnNo: await this.codes.generateUniqueReturnNo(businessId),
          returnDate: new Date(),
          status: SupplierPurchaseReturnStatus.PENDING,
          reason: normalizeNullableText(dto.reason),
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          taxRate: purchaseOrder.taxRate,
          totalAmount: totals.totalAmount,
          createdBy: currentUser.id,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitCost: item.unitCost,
              discountAmount: item.discountAmount,
              taxAmount: item.taxAmount,
              lineTotal: item.lineTotal,
              reason: normalizeNullableText(item.reason),
            })),
          },
        },
      });

      for (const item of items) {
        await this.inventoryLookup.reserveStock(tx, {
          businessId,
          warehouseId: purchaseOrder.warehouseId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          referenceType: InventoryReferenceType.PURCHASE_RETURN,
          referenceId: createdReturn.id,
          note: dto.reason,
          createdBy: currentUser.id,
        });
      }

      await this.finance.createSupplierReturnReceivable(tx, {
        businessId,
        supplierId: purchaseOrder.supplierId,
        supplierReturnId: createdReturn.id,
        totalAmount: totals.totalAmount,
        note: dto.reason,
      });

      return tx.supplierPurchaseReturn.findFirst({
        where: { id: createdReturn.id, businessId },
        include: PURCHASE_RETURN_INCLUDE,
      });
    });

    return apiResponse(
      purchaseReturn,
      "Supplier purchase return request created successfully",
    );
  }

  async findPurchaseReturns(
    businessId: string,
    query: QuerySupplierPurchaseReturnDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierPurchaseReturnWhereInput = {
      businessId,
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.purchaseOrderId
        ? { purchaseOrderId: query.purchaseOrderId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { returnNo: { contains: query.search, mode: "insensitive" } },
              { reason: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.supplierPurchaseReturn.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: PURCHASE_RETURN_INCLUDE,
      }),
      this.prisma.supplierPurchaseReturn.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findPurchaseReturn(businessId: string, purchaseReturnId: string) {
    const purchaseReturn = await this.prisma.supplierPurchaseReturn.findFirst({
      where: { id: purchaseReturnId, businessId },
      include: PURCHASE_RETURN_INCLUDE,
    });

    if (!purchaseReturn) {
      throw new NotFoundException("Supplier purchase return not found");
    }

    return apiResponse(purchaseReturn);
  }

  async completePurchaseReturn(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseReturnId: string,
  ) {
    const purchaseReturn = await this.prisma.supplierPurchaseReturn.findFirst({
      where: {
        id: purchaseReturnId,
        businessId,
        status: SupplierPurchaseReturnStatus.PENDING,
      },
      include: { items: true },
    });

    if (!purchaseReturn) {
      throw new NotFoundException("Pending supplier purchase return not found");
    }

    const completedReturn = await this.prisma.$transaction(async (tx) => {
      for (const item of purchaseReturn.items) {
        await this.inventoryLookup.deductReservedStock(tx, {
          businessId,
          warehouseId: purchaseReturn.warehouseId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          movementType: InventoryMovementType.PURCHASE_RETURN_OUT,
          referenceType: InventoryReferenceType.PURCHASE_RETURN,
          referenceId: purchaseReturn.id,
          note: purchaseReturn.reason,
          createdBy: currentUser.id,
        });
      }

      return tx.supplierPurchaseReturn.update({
        where: { id: purchaseReturn.id },
        data: {
          status: SupplierPurchaseReturnStatus.COMPLETED,
        },
        include: PURCHASE_RETURN_INCLUDE,
      });
    });

    return apiResponse(
      completedReturn,
      "Supplier purchase return completed successfully",
    );
  }

  async cancelPurchaseReturn(businessId: string, purchaseReturnId: string) {
    const purchaseReturn = await this.prisma.supplierPurchaseReturn.findFirst({
      where: {
        id: purchaseReturnId,
        businessId,
        status: SupplierPurchaseReturnStatus.PENDING,
      },
      include: { items: true },
    });

    if (!purchaseReturn) {
      throw new NotFoundException("Pending supplier purchase return not found");
    }

    const cancelledReturn = await this.prisma.$transaction(async (tx) => {
      for (const item of purchaseReturn.items) {
        await this.inventoryLookup.releaseStockReservation(tx, {
          businessId,
          warehouseId: purchaseReturn.warehouseId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          referenceType: InventoryReferenceType.PURCHASE_RETURN,
          referenceId: purchaseReturn.id,
          note: purchaseReturn.reason,
        });
      }

      await tx.financeReceivable.updateMany({
        where: {
          businessId,
          sourceType: FinanceSourceType.SUPPLIER_RETURN,
          sourceId: purchaseReturn.id,
          status: {
            not: FinanceReceivableStatus.RECEIVED,
          },
        },
        data: {
          status: FinanceReceivableStatus.CANCELLED,
        },
      });

      return tx.supplierPurchaseReturn.update({
        where: { id: purchaseReturn.id },
        data: {
          status: SupplierPurchaseReturnStatus.CANCELLED,
        },
        include: PURCHASE_RETURN_INCLUDE,
      });
    });

    return apiResponse(
      cancelledReturn,
      "Supplier purchase return cancelled successfully",
    );
  }

  private async buildPurchaseReturnItems(
    businessId: string,
    purchaseOrder: Prisma.SupplierPurchaseOrderGetPayload<{
      include: {
        items: true;
        invoices: true;
      };
    }>,
    requestedItems: {
      productId: string;
      variantId?: string | null;
      quantity: number;
      reason?: string;
    }[],
  ) {
    const purchaseOrderItemMap = new Map(
      purchaseOrder.items.map((item) => [
        this.inventoryLookup.buildStockItemKey(item.productId, item.variantId),
        item,
      ]),
    );
    const existingReturnItems =
      await this.prisma.supplierPurchaseReturnItem.findMany({
        where: {
          purchaseReturn: {
            businessId,
            purchaseOrderId: purchaseOrder.id,
            status: {
              not: SupplierPurchaseReturnStatus.CANCELLED,
            },
          },
        },
        select: {
          productId: true,
          variantId: true,
          quantity: true,
        },
      });
    const returnedQuantityByItem = new Map<string, Prisma.Decimal>();

    for (const item of existingReturnItems) {
      const itemKey = this.inventoryLookup.buildStockItemKey(
        item.productId,
        item.variantId,
      );
      const current =
        returnedQuantityByItem.get(itemKey) ?? new Prisma.Decimal(0);

      returnedQuantityByItem.set(itemKey, current.plus(item.quantity));
    }

    return requestedItems.map((requestedItem) => {
      const itemKey = this.inventoryLookup.buildStockItemKey(
        requestedItem.productId,
        requestedItem.variantId,
      );
      const purchaseOrderItem = purchaseOrderItemMap.get(itemKey);

      if (
        !purchaseOrderItem ||
        purchaseOrderItem.productId !== requestedItem.productId
      ) {
        throw new BadRequestException(
          "One or more purchase return items are invalid",
        );
      }

      const quantity = new Prisma.Decimal(requestedItem.quantity);
      const alreadyReturned =
        returnedQuantityByItem.get(itemKey) ?? new Prisma.Decimal(0);
      const remainingReturnable = new Prisma.Decimal(
        purchaseOrderItem.quantityReceived,
      ).minus(alreadyReturned);

      if (quantity.greaterThan(remainingReturnable)) {
        throw new BadRequestException(
          "Return quantity cannot exceed remaining received quantity",
        );
      }

      const orderedQuantity = new Prisma.Decimal(
        purchaseOrderItem.quantityOrdered,
      );
      const discountPerUnit = new Prisma.Decimal(
        purchaseOrderItem.discountAmount,
      ).div(orderedQuantity);
      const subtotal = quantity.mul(purchaseOrderItem.unitCost);
      const discountAmount = discountPerUnit.mul(quantity).toDecimalPlaces(2);
      const taxableAmount = subtotal.minus(discountAmount);
      const taxAmount = taxableAmount
        .mul(purchaseOrder.taxRate)
        .div(100)
        .toDecimalPlaces(2);

      return {
        productId: requestedItem.productId,
        variantId: requestedItem.variantId ?? null,
        quantity,
        unitCost: purchaseOrderItem.unitCost,
        discountAmount,
        taxAmount,
        lineTotal: taxableAmount.plus(taxAmount),
        reason: requestedItem.reason,
      };
    });
  }
}
