import { Prisma } from "@prisma/client";

import type { OrderItemWithPrice } from "./order.types";

export function calculateOrderTotals(
  items: OrderItemWithPrice[],
  shippingCharge: number,
) {
  const subtotal = items.reduce(
    (total, item) =>
      total.plus(new Prisma.Decimal(item.quantity).mul(item.unitPrice)),
    new Prisma.Decimal(0),
  );
  const discountTotal = items.reduce(
    (total, item) => total.plus(item.discountAmount ?? 0),
    new Prisma.Decimal(0),
  );
  const taxTotal = items.reduce(
    (total, item) => total.plus(item.taxAmount),
    new Prisma.Decimal(0),
  );
  const shipping = new Prisma.Decimal(shippingCharge);

  return {
    subtotal,
    discountTotal,
    taxTotal,
    shippingCharge: shipping,
    totalAmount: subtotal.minus(discountTotal).plus(taxTotal).plus(shipping),
  };
}
