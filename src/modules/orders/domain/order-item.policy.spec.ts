import { describe, expect, it } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";

import { assertOrderItems } from "./order-item.policy";

describe("assertOrderItems", () => {
  it("requires at least one order item", () => {
    expect(() => assertOrderItems([])).toThrow(BadRequestException);
  });

  it("rejects duplicate product and variant pairs", () => {
    expect(() =>
      assertOrderItems([
        { productId: "product-1", variantId: "variant-1", quantity: 1 },
        { productId: "product-1", variantId: "variant-1", quantity: 2 },
      ]),
    ).toThrow(BadRequestException);
  });

  it("allows the same product when variants differ", () => {
    expect(() =>
      assertOrderItems([
        { productId: "product-1", variantId: "variant-1", quantity: 1 },
        { productId: "product-1", variantId: "variant-2", quantity: 1 },
      ]),
    ).not.toThrow();
  });
});
