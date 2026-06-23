import { describe, expect, it } from "@jest/globals";

import {
  calculateLineTax,
  calculateLineTotal,
  calculatePurchaseOrderTotals,
} from "./purchase-order-totals.calculator";

describe("purchase order totals calculator", () => {
  it("calculates line tax and total", () => {
    expect(
      calculateLineTax({
        quantityOrdered: 2,
        unitCost: 100,
        discountAmount: 20,
        taxRate: 10,
      }).toString(),
    ).toBe("18");
    expect(
      calculateLineTotal({
        quantityOrdered: 2,
        unitCost: 100,
        discountAmount: 20,
        taxRate: 10,
      }).toString(),
    ).toBe("198");
  });

  it("calculates purchase order totals", () => {
    const totals = calculatePurchaseOrderTotals(
      [
        {
          quantityOrdered: 2,
          unitCost: 100,
          discountAmount: 20,
          taxRate: 10,
        },
      ],
      15,
    );

    expect(totals).toEqual({
      subtotal: 200,
      discountTotal: 20,
      taxTotal: 18,
      shippingCost: 15,
      totalAmount: 213,
    });
  });
});
