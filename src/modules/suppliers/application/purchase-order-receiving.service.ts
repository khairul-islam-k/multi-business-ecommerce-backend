import { Injectable } from "@nestjs/common";
import {
  InventoryMovementType,
  InventoryReferenceType,
  Prisma,
  SupplierInvoiceStatus,
  SupplierProductMapStatus,
  SupplierPurchaseOrderStatus,
} from "@prisma/client";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { ReceivePurchaseOrderDto } from "../dto/supplier.dto";
import { assertPurchaseOrderCanReceive } from "../domain/purchase-order-status.policy";
import { PurchaseOrderRepository } from "../infrastructure/purchase-order.repository";
import { PURCHASE_ORDER_INCLUDE } from "../infrastructure/supplier.selects";
import { PrismaService } from "../../../prisma/prisma.service";
import { FinanceLedgerService } from "../../finance/common/finance-ledger.service";
import { InventoryLookupService } from "../../inventory/common/inventory-lookup.service";
import { apiResponse } from "../../../common/utils/api-response.util";

@Injectable()
export class PurchaseOrderReceivingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryLookup: InventoryLookupService,
    private readonly finance: FinanceLedgerService,
    private readonly purchaseOrders: PurchaseOrderRepository,
  ) {}

  async receivePurchaseOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseOrderId: string,
    dto: ReceivePurchaseOrderDto,
  ) {
    const purchaseOrder = await this.purchaseOrders.getPurchaseOrderOrThrow(
      businessId,
      purchaseOrderId,
    );

    assertPurchaseOrderCanReceive(purchaseOrder.status);

    const receivedOrder = await this.prisma.$transaction(async (tx) => {
      for (const orderItem of purchaseOrder.items) {
        const quantityReceived = new Prisma.Decimal(orderItem.quantityOrdered);

        await tx.supplierPurchaseOrderItem.update({
          where: { id: orderItem.id },
          data: {
            quantityReceived,
          },
        });

        await this.inventoryLookup.applyStockDelta(tx, {
          businessId,
          warehouseId: purchaseOrder.warehouseId,
          productId: orderItem.productId,
          variantId: orderItem.variantId,
          quantityDelta: quantityReceived,
          movementType: InventoryMovementType.PURCHASE_IN,
          referenceType: InventoryReferenceType.PURCHASE_ORDER,
          referenceId: purchaseOrder.id,
          note: dto.note,
          createdBy: currentUser.id,
        });

        await tx.supplierProductMap.upsert({
          where: {
            businessId_supplierId_itemKey: {
              businessId,
              supplierId: purchaseOrder.supplierId,
              itemKey: this.inventoryLookup.buildStockItemKey(
                orderItem.productId,
                orderItem.variantId,
              ),
            },
          },
          update: {
            lastPurchasePrice: orderItem.unitCost,
            status: SupplierProductMapStatus.ACTIVE,
          },
          create: {
            businessId,
            supplierId: purchaseOrder.supplierId,
            productId: orderItem.productId,
            variantId: orderItem.variantId,
            itemKey: this.inventoryLookup.buildStockItemKey(
              orderItem.productId,
              orderItem.variantId,
            ),
            lastPurchasePrice: orderItem.unitCost,
            status: SupplierProductMapStatus.ACTIVE,
          },
        });
      }

      const supplierInvoice = await tx.supplierInvoice.create({
        data: {
          businessId,
          supplierId: purchaseOrder.supplierId,
          purchaseOrderId: purchaseOrder.id,
          taxId: purchaseOrder.taxId,
          invoiceNo:
            await this.finance.generateUniqueSupplierInvoiceNo(businessId),
          invoiceDate: new Date(),
          status: SupplierInvoiceStatus.UNPAID,
          subtotal: purchaseOrder.subtotal,
          discountTotal: purchaseOrder.discountTotal,
          taxTotal: purchaseOrder.taxTotal,
          taxRate: purchaseOrder.taxRate,
          shippingCost: purchaseOrder.shippingCost,
          totalAmount: purchaseOrder.totalAmount,
          paidAmount: 0,
          note: dto.note,
          createdBy: currentUser.id,
          items: {
            create: purchaseOrder.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantityOrdered,
              unitCost: item.unitCost,
              discountAmount: item.discountAmount,
              taxAmount: item.taxAmount,
              lineTotal: item.lineTotal,
            })),
          },
        },
      });

      await this.finance.createSupplierInvoicePayable(tx, {
        businessId,
        supplierId: purchaseOrder.supplierId,
        supplierInvoiceId: supplierInvoice.id,
        totalAmount: supplierInvoice.totalAmount,
        note: dto.note,
      });

      return tx.supplierPurchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          status: SupplierPurchaseOrderStatus.RECEIVED,
        },
        include: PURCHASE_ORDER_INCLUDE,
      });
    });

    return apiResponse(receivedOrder, "Purchase order received successfully");
  }
}
