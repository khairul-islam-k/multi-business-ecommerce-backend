import { Injectable } from "@nestjs/common";
import {
  InventoryMovementType,
  InventoryReferenceType,
  SupplierInvoiceStatus,
  SupplierProductMapStatus,
  SupplierPurchaseOrderStatus,
  supplierInvoice,
  supplierInvoiceItem,
  supplierProductMap,
  supplierPurchaseOrder,
  supplierPurchaseOrderItem,
} from "@/database/schema";
import Decimal from "decimal.js";
import { eq } from "drizzle-orm";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { ReceivePurchaseOrderDto } from "../dto/supplier.dto";
import { assertPurchaseOrderCanReceive } from "../domain/purchase-order-status.policy";
import { PurchaseOrderRepository } from "../infrastructure/purchase-order.repository";
import { DatabaseService } from "../../../database/database.service";
import { FinanceLedgerService } from "../../finance/common/finance-ledger.service";
import { InventoryLookupService } from "../../inventory/common/inventory-lookup.service";
import { apiResponse } from "../../../common/utils/api-response.util";

@Injectable()
export class PurchaseOrderReceivingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly inventoryLookup: InventoryLookupService,
    private readonly finance: FinanceLedgerService,
    private readonly purchaseOrders: PurchaseOrderRepository,
  ) {}

  private get db() {
    return this.database.db;
  }

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

    const receivedOrder = await this.db.transaction(async (tx) => {
      for (const orderItem of purchaseOrder.items) {
        const quantityReceived = new Decimal(orderItem.quantityOrdered);

        await tx
          .update(supplierPurchaseOrderItem)
          .set({ quantityReceived })
          .where(eq(supplierPurchaseOrderItem.id, orderItem.id));

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

        const itemKey = this.inventoryLookup.buildStockItemKey(
          orderItem.productId,
          orderItem.variantId,
        );

        await tx
          .insert(supplierProductMap)
          .values({
            businessId,
            supplierId: purchaseOrder.supplierId,
            productId: orderItem.productId,
            variantId: orderItem.variantId,
            itemKey,
            lastPurchasePrice: orderItem.unitCost,
            status: SupplierProductMapStatus.ACTIVE,
          })
          .onConflictDoUpdate({
            target: [
              supplierProductMap.businessId,
              supplierProductMap.supplierId,
              supplierProductMap.itemKey,
            ],
            set: {
              lastPurchasePrice: orderItem.unitCost,
              status: SupplierProductMapStatus.ACTIVE,
            },
          });
      }

      const [createdInvoice] = await tx
        .insert(supplierInvoice)
        .values({
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
          paidAmount: new Decimal(0),
          note: dto.note,
          createdBy: currentUser.id,
        })
        .returning();

      await tx.insert(supplierInvoiceItem).values(
        purchaseOrder.items.map((item) => ({
          supplierInvoiceId: createdInvoice.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantityOrdered,
          unitCost: item.unitCost,
          discountAmount: item.discountAmount,
          taxAmount: item.taxAmount,
          lineTotal: item.lineTotal,
        })),
      );

      await this.finance.createSupplierInvoicePayable(tx, {
        businessId,
        supplierId: purchaseOrder.supplierId,
        supplierInvoiceId: createdInvoice.id,
        totalAmount: createdInvoice.totalAmount,
        note: dto.note,
      });

      const [updatedOrder] = await tx
        .update(supplierPurchaseOrder)
        .set({ status: SupplierPurchaseOrderStatus.RECEIVED })
        .where(eq(supplierPurchaseOrder.id, purchaseOrderId))
        .returning();

      return this.purchaseOrders.hydrate(updatedOrder);
    });

    return apiResponse(receivedOrder, "Purchase order received successfully");
  }
}
