import { Injectable } from "@nestjs/common";
import {
  CourierShipmentStatus,
  FinanceReceivableStatus,
  FinanceSourceType,
  InventoryOrderAllocationStatus,
  InvoiceStatus,
  OrderStatus,
  courierReceivable,
  courierShipment,
  financeReceivable,
  inventoryOrderAllocation,
  invoice,
  order as orderTable,
  orderStatusLog,
} from "@/database/schema";
import Decimal from "decimal.js";
import { and, eq, isNull } from "drizzle-orm";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import {
  assertCanCancelOrder,
  assertCanDeliverOrder,
  assertCanShipOrder,
} from "../domain/order-status-machine";
import { OrderRepository } from "../infrastructure/order.repository";
import { DatabaseService } from "../../../database/database.service";
import { InventoryLookupService } from "../../inventory/common/inventory-lookup.service";
import { apiResponse } from "../../../common/utils/api-response.util";

@Injectable()
export class OrderStatusService {
  constructor(
    private readonly database: DatabaseService,
    private readonly inventory: InventoryLookupService,
    private readonly orders: OrderRepository,
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

    return apiResponse(updatedOrder, "Order shipped successfully");
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
            .select({ id: courierReceivable.id })
            .from(courierReceivable)
            .where(eq(courierReceivable.shipmentId, shipment.id));

          if (!existingReceivable && shipment.courierId) {
            await tx.insert(courierReceivable).values({
              businessId,
              courierId: shipment.courierId,
              shipmentId: shipment.id,
              orderId,
              codAmount: shipment.codAmount,
              courierFee: shipment.courierFee,
              netReceivable: new Decimal(shipment.codAmount).minus(
                shipment.courierFee,
              ),
            });
          }
        }
      }

      return this.orders.hydrate(updated, tx);
    });

    return apiResponse(updatedOrder, "Order delivered successfully");
  }

  async cancel(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
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
          currentUser.id,
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
        changedBy: currentUser.id,
      });

      return this.orders.hydrate(updated, tx);
    });

    return apiResponse(updatedOrder, "Order cancelled successfully");
  }
}
