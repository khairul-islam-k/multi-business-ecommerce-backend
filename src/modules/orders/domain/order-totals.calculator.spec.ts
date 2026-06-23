import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";

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
          unitPrice: new Decimal(100),
          taxId: "tax-a",
          taxRate: new Decimal(10),
          taxAmount: new Decimal(9),
          lineTotal: new Decimal(199),
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

  it("sums multiple lines without losing decimal precision", () => {
    const totals = calculateOrderTotals(
      [
        {
          productId: "product-a",
          variantId: null,
          quantity: 3,
          discountAmount: 0.3,
          unitPrice: new Decimal("19.99"),
          taxId: "tax-a",
          taxRate: new Decimal(8),
          taxAmount: new Decimal("4.77"),
          lineTotal: new Decimal("64.44"),
        },
        {
          productId: "product-b",
          variantId: "variant-b",
          quantity: 1,
          discountAmount: 0,
          unitPrice: new Decimal("10.10"),
          taxId: "tax-b",
          taxRate: new Decimal(8),
          taxAmount: new Decimal("0.81"),
          lineTotal: new Decimal("10.91"),
        },
      ],
      5.5,
    );

    expect(totals.subtotal.toString()).toBe("70.07");
    expect(totals.discountTotal.toString()).toBe("0.3");
    expect(totals.taxTotal.toString()).toBe("5.58");
    expect(totals.shippingCharge.toString()).toBe("5.5");
    expect(totals.totalAmount.toString()).toBe("80.85");
  });
});
