import { Injectable } from "@nestjs/common";
import {
  CourierShipmentStatus,
  FinanceReceivableStatus,
  FinanceSourceType,
  InvoiceStatus,
  OrderStatus,
  Prisma,
} from "@prisma/client";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import {
  assertCanCancelOrder,
  assertCanDeliverOrder,
  assertCanShipOrder,
} from "../domain/order-status-machine";
import { OrderRepository } from "../infrastructure/order.repository";
import { ORDER_INCLUDE } from "../infrastructure/order.selects";
import { PrismaService } from "../../../prisma/prisma.service";
import { InventoryLookupService } from "../../inventory/common/inventory-lookup.service";
import { apiResponse } from "../../../common/utils/api-response.util";

@Injectable()
export class OrderStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryLookupService,
    private readonly orders: OrderRepository,
  ) {}

  async ship(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
  ) {
    const order = await this.orders.getByIdOrThrow(businessId, orderId);

    assertCanShipOrder(order.status);

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.orderOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.SHIPPED },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.SHIPPED,
          changedBy: currentUser.id,
        },
      });

      await tx.courierShipment.updateMany({
        where: {
          businessId,
          orderId,
          deletedAt: null,
          status: CourierShipmentStatus.PENDING,
        },
        data: {
          status: CourierShipmentStatus.BOOKED,
          shippedAt: new Date(),
        },
      });

      return tx.orderOrder.findFirst({
        where: { id: orderId, businessId },
        include: ORDER_INCLUDE,
      });
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

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const allocations = await tx.inventoryOrderAllocation.findMany({
        where: { businessId, orderId, status: "RESERVED" },
        select: { id: true },
      });

      for (const allocation of allocations) {
        await this.inventory.fulfillOrderAllocation(
          tx,
          { businessId, allocationId: allocation.id },
          currentUser.id,
        );
      }

      await tx.orderOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.DELIVERED },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.DELIVERED,
          changedBy: currentUser.id,
        },
      });

      const shipment = await tx.courierShipment.findFirst({
        where: { businessId, orderId, deletedAt: null },
      });

      if (shipment) {
        await tx.courierShipment.update({
          where: { id: shipment.id },
          data: {
            status: CourierShipmentStatus.DELIVERED,
            deliveredAt: new Date(),
          },
        });

        if (new Prisma.Decimal(shipment.codAmount).greaterThan(0)) {
          const existingReceivable = await tx.courierReceivable.findUnique({
            where: { shipmentId: shipment.id },
            select: { id: true },
          });

          if (!existingReceivable && shipment.courierId) {
            await tx.courierReceivable.create({
              data: {
                businessId,
                courierId: shipment.courierId,
                shipmentId: shipment.id,
                orderId,
                codAmount: shipment.codAmount,
                courierFee: shipment.courierFee,
                netReceivable: new Prisma.Decimal(shipment.codAmount).minus(
                  shipment.courierFee,
                ),
              },
            });
          }
        }
      }

      return tx.orderOrder.findFirst({
        where: { id: orderId, businessId },
        include: ORDER_INCLUDE,
      });
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

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const allocations = await tx.inventoryOrderAllocation.findMany({
        where: { businessId, orderId, status: "RESERVED" },
        select: { id: true },
      });

      for (const allocation of allocations) {
        await this.inventory.releaseOrderReservation(
          tx,
          { businessId, allocationId: allocation.id },
          currentUser.id,
        );
      }

      await tx.orderOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });

      await tx.invoice.updateMany({
        where: { businessId, orderId, deletedAt: null },
        data: { status: InvoiceStatus.CANCELLED },
      });

      await tx.courierShipment.updateMany({
        where: { businessId, orderId, deletedAt: null },
        data: {
          status: CourierShipmentStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      await tx.financeReceivable.updateMany({
        where: {
          businessId,
          sourceType: FinanceSourceType.ORDER,
          sourceId: orderId,
        },
        data: {
          status: FinanceReceivableStatus.CANCELLED,
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          changedBy: currentUser.id,
        },
      });

      return tx.orderOrder.findFirst({
        where: { id: orderId, businessId },
        include: ORDER_INCLUDE,
      });
    });

    return apiResponse(updatedOrder, "Order cancelled successfully");
  }
}
