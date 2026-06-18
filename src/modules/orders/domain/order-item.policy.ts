import { BadRequestException } from "@nestjs/common";

import type { OrderItemInputDto } from "../dto/order.dto";

export function assertOrderItems(items: OrderItemInputDto[]) {
  if (items.length === 0) {
    throw new BadRequestException("At least one order item is required");
  }

  const itemKeys = new Set(
    items.map((item) => `${item.productId}:${item.variantId ?? ""}`),
  );

  if (itemKeys.size !== items.length) {
    throw new BadRequestException("Order cannot contain duplicate items");
  }
}
