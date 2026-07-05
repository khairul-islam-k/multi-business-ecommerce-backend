import Decimal from "decimal.js";
import { and, eq, isNull } from "drizzle-orm";

import {
  courierShipment,
  CourierShipmentStatus,
  FinancePartyType,
  financeReceivable,
  FinanceReceivableStatus,
  FinanceSourceType,
  inventoryOrderAllocation,
  InventoryOrderAllocationStatus,
  invoice,
  InvoiceStatus,
  order as orderTable,
  OrderStatus,
  orderStatusLog,
} from "@/database/schema";
import { Injectable } from "@nestjs/common";

import { apiResponse } from "../../../common/utils/api-response.util";
import { DatabaseService } from "../../../database/database.service";
import { FinanceCodeService } from "../../finance/application/finance-code.service";
import { InventoryLookupService } from "../../inventory/common/inventory-lookup.service";
import {
  assertCanCancelOrder,
  assertCanDeliverOrder,
  assertCanShipOrder,
} from "../domain/order-status-machine";
import { OrderRepository } from "../infrastructure/order.repository";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@Injectable()
export class OrderStatusService {
  constructor(
    private readonly database: DatabaseService,
    private readonly inventory: InventoryLookupService,
    private readonly orders: OrderRepository,
    private readonly financeCodes: FinanceCodeService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async ship(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
  ) {
    const order = await this.orders.getByIdOrThrow(businessId, orderId);

    assertCanShipOrder(order.status);

    const updatedOrder = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(orderTable)
        .set({ status: OrderStatus.SHIPPED })
        .where(eq(orderTable.id, orderId))
        .returning();

      await tx.insert(orderStatusLog).values({
        orderId,
        fromStatus: order.status,
        toStatus: OrderStatus.SHIPPED,
        changedBy: currentUser.id,
      });

      await tx
        .update(courierShipment)
        .set({
          status: CourierShipmentStatus.BOOKED,
          shippedAt: new Date(),
        })
        .where(
          and(
            eq(courierShipment.businessId, businessId),
            eq(courierShipment.orderId, orderId),
            isNull(courierShipment.deletedAt),
            eq(courierShipment.status, CourierShipmentStatus.PENDING),
          ),
        );

      return this.orders.hydrate(updated, tx);
    });

    return apiResponse(
      updatedOrder,
      "Order status updated to shipped. If this order had a pending courier shipment, the shipment was also marked as booked.",
    );
  }

  async deliver(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
  ) {
    const order = await this.orders.getByIdOrThrow(businessId, orderId);

    assertCanDeliverOrder(order.status);

    const updatedOrder = await this.db.transaction(async (tx) => {
      const allocations = await tx
        .select({ id: inventoryOrderAllocation.id })
        .from(inventoryOrderAllocation)
        .where(
          and(
            eq(inventoryOrderAllocation.businessId, businessId),
            eq(inventoryOrderAllocation.orderId, orderId),
            eq(
              inventoryOrderAllocation.status,
              InventoryOrderAllocationStatus.RESERVED,
            ),
          ),
        );

      for (const allocation of allocations) {
        await this.inventory.fulfillOrderAllocation(
          tx,
          { businessId, allocationId: allocation.id },
          currentUser.id,
        );
      }

      const [updated] = await tx
        .update(orderTable)
        .set({ status: OrderStatus.DELIVERED })
        .where(eq(orderTable.id, orderId))
        .returning();

      await tx.insert(orderStatusLog).values({
        orderId,
        fromStatus: order.status,
        toStatus: OrderStatus.DELIVERED,
        changedBy: currentUser.id,
      });

      const [shipment] = await tx
        .select()
        .from(courierShipment)
        .where(
          and(
            eq(courierShipment.businessId, businessId),
            eq(courierShipment.orderId, orderId),
            isNull(courierShipment.deletedAt),
          ),
        );

      if (shipment) {
        await tx
          .update(courierShipment)
          .set({
            status: CourierShipmentStatus.DELIVERED,
            deliveredAt: new Date(),
          })
          .where(eq(courierShipment.id, shipment.id));

        if (new Decimal(shipment.codAmount).greaterThan(0)) {
          const [existingReceivable] = await tx
            .select({ id: financeReceivable.id })
            .from(financeReceivable)
            .where(
              and(
                eq(financeReceivable.businessId, businessId),
                eq(
                  financeReceivable.sourceType,
                  FinanceSourceType.COURIER_RECEIVABLE,
                ),
                eq(financeReceivable.sourceId, shipment.id),
              ),
            );

          if (!existingReceivable && shipment.courierId) {
            const netReceivable = new Decimal(shipment.codAmount)
              .minus(shipment.courierFee)
              .toDecimalPlaces(2);

            if (netReceivable.greaterThan(0)) {
              await tx.insert(financeReceivable).values({
                businessId,
                receivableNo:
                  await this.financeCodes.generateUniqueReceivableNo(
                    businessId,
                  ),
                partyType: FinancePartyType.COURIER,
                partyId: shipment.courierId,
                sourceType: FinanceSourceType.COURIER_RECEIVABLE,
                sourceId: shipment.id,
                totalAmount: netReceivable,
                receivedAmount: new Decimal(0),
                status: FinanceReceivableStatus.PENDING,
                note: `COD receivable for shipment ${shipment.shipmentNo}`,
              });
            }
          }
        }
      }

      return this.orders.hydrate(updated, tx);
    });

    return apiResponse(
      updatedOrder,
      "Order status updated to delivered. Reserved stock was fulfilled, and any courier collection receivable was prepared when cash on delivery was due.",
    );
  }

  async cancel(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
  ) {
    return this.cancelOrder(businessId, orderId, currentUser.id);
  }

  async cancelByCustomer(
    businessId: string,
    orderId: string,
    note?: string | null,
  ) {
    return this.cancelOrder(businessId, orderId, undefined, note);
  }

  private async cancelOrder(
    businessId: string,
    orderId: string,
    changedBy?: string,
    note?: string | null,
  ) {
    const order = await this.orders.getByIdOrThrow(businessId, orderId);

    assertCanCancelOrder(order.status);

    const updatedOrder = await this.db.transaction(async (tx) => {
      const allocations = await tx
        .select({ id: inventoryOrderAllocation.id })
        .from(inventoryOrderAllocation)
        .where(
          and(
            eq(inventoryOrderAllocation.businessId, businessId),
            eq(inventoryOrderAllocation.orderId, orderId),
            eq(
              inventoryOrderAllocation.status,
              InventoryOrderAllocationStatus.RESERVED,
            ),
          ),
        );

      for (const allocation of allocations) {
        await this.inventory.releaseOrderReservation(
          tx,
          { businessId, allocationId: allocation.id },
          changedBy,
        );
      }

      const [updated] = await tx
        .update(orderTable)
        .set({ status: OrderStatus.CANCELLED })
        .where(eq(orderTable.id, orderId))
        .returning();

      await tx
        .update(invoice)
        .set({ status: InvoiceStatus.CANCELLED })
        .where(
          and(
            eq(invoice.businessId, businessId),
            eq(invoice.orderId, orderId),
            isNull(invoice.deletedAt),
          ),
        );

      await tx
        .update(courierShipment)
        .set({
          status: CourierShipmentStatus.CANCELLED,
          cancelledAt: new Date(),
        })
        .where(
          and(
            eq(courierShipment.businessId, businessId),
            eq(courierShipment.orderId, orderId),
            isNull(courierShipment.deletedAt),
          ),
        );

      await tx
        .update(financeReceivable)
        .set({
          status: FinanceReceivableStatus.CANCELLED,
        })
        .where(
          and(
            eq(financeReceivable.businessId, businessId),
            eq(financeReceivable.sourceType, FinanceSourceType.ORDER),
            eq(financeReceivable.sourceId, orderId),
          ),
        );

      await tx.insert(orderStatusLog).values({
        orderId,
        fromStatus: order.status,
        toStatus: OrderStatus.CANCELLED,
        changedBy,
        note,
      });

      return this.orders.hydrate(updated, tx);
    });

    return apiResponse(
      updatedOrder,
      "Order cancelled successfully. Reserved stock was released, the related invoice and courier shipment were cancelled when present, and the order receivable was cancelled.",
    );
  }
}
