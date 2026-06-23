import { OrderStatus } from "@/database/schema";
import { BadRequestException } from "@nestjs/common";

export function assertCanShipOrder(status: OrderStatus) {
  const shippableStatuses: OrderStatus[] = [
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
  ];

  if (!shippableStatuses.includes(status)) {
    throw new BadRequestException("Order cannot be shipped");
  }
}

export function assertCanDeliverOrder(status: OrderStatus) {
  const deliverableStatuses: OrderStatus[] = [
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
  ];

  if (!deliverableStatuses.includes(status)) {
    throw new BadRequestException("Order cannot be delivered");
  }
}

export function assertCanCancelOrder(status: OrderStatus) {
  const cancelBlockedStatuses: OrderStatus[] = [
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ];

  if (cancelBlockedStatuses.includes(status)) {
    throw new BadRequestException("Order cannot be cancelled");
  }
}
