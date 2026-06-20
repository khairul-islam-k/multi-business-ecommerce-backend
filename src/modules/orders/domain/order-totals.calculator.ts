import Decimal from "decimal.js";

import type { OrderItemWithPrice } from "./order.types";

export function calculateOrderTotals(
  items: OrderItemWithPrice[],
  shippingCharge: number,
) {
  const subtotal = items.reduce(
    (total, item) => total.plus(new Decimal(item.quantity).mul(item.unitPrice)),
    new Decimal(0),
  );
  const discountTotal = items.reduce(
    (total, item) => total.plus(item.discountAmount ?? 0),
    new Decimal(0),
  );
  const taxTotal = items.reduce(
    (total, item) => total.plus(item.taxAmount),
    new Decimal(0),
  );
  const shipping = new Decimal(shippingCharge);

  return {
    subtotal,
    discountTotal,
    taxTotal,
    shippingCharge: shipping,
    totalAmount: subtotal.minus(discountTotal).plus(taxTotal).plus(shipping),
  };
}
