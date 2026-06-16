import { describe, expect, it } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";
import Decimal from "decimal.js";

import {
  assertPurchaseOrderItems,
  assertPurchaseReturnItems,
  calculatePurchaseReturnTotals,
} from "./purchase-return.policy";

describe("purchase return policy", () => {
  it("rejects duplicate purchase order and return items", () => {
    const items = [
      { productId: "product-a", variantId: null },
      { productId: "product-a", variantId: null },
    ];

    expect(() => assertPurchaseOrderItems(items)).toThrow(BadRequestException);
    expect(() => assertPurchaseReturnItems(items)).toThrow(BadRequestException);
  });

  it("calculates return totals", () => {
    const totals = calculatePurchaseReturnTotals([
      {
        quantity: new Decimal(2),
        unitCost: new Decimal(100),
        discountAmount: new Decimal(10),
        taxAmount: new Decimal(19),
        lineTotal: new Decimal(209),
      },
    ]);

    expect(totals.subtotal.toString()).toBe("200");
    expect(totals.discountTotal.toString()).toBe("10");
    expect(totals.taxTotal.toString()).toBe("19");
    expect(totals.totalAmount.toString()).toBe("209");
  });
});

