import { describe, expect, it } from "@jest/globals";

import { buildStockItemKey } from "./stock-item-key";

describe("buildStockItemKey", () => {
  it("uses variant id when present", () => {
    expect(buildStockItemKey("product-id", "variant-id")).toBe("variant-id");
  });

  it("uses a product key when variant is absent", () => {
    expect(buildStockItemKey("product-id", null)).toBe("product:product-id");
  });
});
