import { describe, expect, it } from "@jest/globals";
import { Prisma } from "@prisma/client";

import { calculateOrderTotals } from "./order-totals.calculator";

describe("calculateOrderTotals", () => {
  it("calculates subtotal, discount, tax, shipping, and total", () => {
    const totals = calculateOrderTotals(
      [
        {
          productId: "product-a",
          variantId: null,
          quantity: 2,
          discountAmount: 10,
          unitPrice: new Prisma.Decimal(100),
          taxAmount: new Prisma.Decimal(9),
          lineTotal: new Prisma.Decimal(199),
        },
      ],
      20,
    );

    expect(totals.subtotal.toString()).toBe("200");
    expect(totals.discountTotal.toString()).toBe("10");
    expect(totals.taxTotal.toString()).toBe("9");
    expect(totals.shippingCharge.toString()).toBe("20");
    expect(totals.totalAmount.toString()).toBe("219");
  });
});
