import { OrderStatus } from "@/database/schema";
import { BadRequestException } from "@nestjs/common";

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PLACED]: "placed",
  [OrderStatus.CONFIRMED]: "confirmed",
  [OrderStatus.PROCESSING]: "processing",
  [OrderStatus.SHIPPED]: "shipped",
  [OrderStatus.DELIVERED]: "delivered",
  [OrderStatus.CANCELLED]: "cancelled",
  [OrderStatus.RETURNED]: "returned",
};

export function assertCanConfirmOrder(status: OrderStatus) {
  const shippableStatuses: OrderStatus[] = [OrderStatus.PLACED];

  if (!shippableStatuses.includes(status)) {
    throw new BadRequestException(
      `This order cannot be marked as shipped because it is currently ${formatOrderStatus(status)}. Only ${formatAllowedStatuses(shippableStatuses)} orders can be confirmed. Please move the order to an allowed status first, or review whether it has already been completed or cancelled.`,
    );
  }
}

export function assertCanProcessOrder(status: OrderStatus) {
  const shippableStatuses: OrderStatus[] = [OrderStatus.CONFIRMED];

  if (!shippableStatuses.includes(status)) {
    throw new BadRequestException(
      `This order cannot be marked as shipped because it is currently ${formatOrderStatus(status)}. Only ${formatAllowedStatuses(shippableStatuses)} orders can be processed. Please move the order to an allowed status first, or review whether it has already been completed or cancelled.`,
    );
  }
}
export function assertCanShipOrder(status: OrderStatus) {
  const shippableStatuses: OrderStatus[] = [
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
  ];

  if (!shippableStatuses.includes(status)) {
    throw new BadRequestException(
      `This order cannot be marked as shipped because it is currently ${formatOrderStatus(status)}. Only ${formatAllowedStatuses(shippableStatuses)} orders can be shipped. Please move the order to an allowed status first, or review whether it has already been completed or cancelled.`,
    );
  }
}

export function assertCanDeliverOrder(status: OrderStatus) {
  const deliverableStatuses: OrderStatus[] = [
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
  ];

  if (!deliverableStatuses.includes(status)) {
    throw new BadRequestException(
      `This order cannot be marked as delivered because it is currently ${formatOrderStatus(status)}. Only ${formatAllowedStatuses(deliverableStatuses)} orders can be delivered. Please confirm, process, or ship the order before marking it delivered.`,
    );
  }
}

export function assertCanCancelOrder(status: OrderStatus) {
  const cancelBlockedStatuses: OrderStatus[] = [
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ];

  if (cancelBlockedStatuses.includes(status)) {
    throw new BadRequestException(
      `This order cannot be cancelled because it is already ${formatOrderStatus(status)}. Delivered or already-cancelled orders are locked from cancellation to protect stock, payment, and delivery history.`,
    );
  }
}

function formatOrderStatus(status: OrderStatus) {
  return ORDER_STATUS_LABELS[status] ?? status.toLowerCase();
}

function formatAllowedStatuses(statuses: OrderStatus[]) {
  return statuses.map(formatOrderStatus).join(", ");
}
