import Decimal from "decimal.js";
import { describe, expect, it } from "@jest/globals";

import {
  isProductOfferActive,
  resolveProductEffectivePrice,
} from "./product-offer-price";

describe("product offer pricing", () => {
  const now = new Date("2026-07-21T12:00:00.000Z");

  it("uses the offer price inside an enabled offer period", () => {
    const product = {
      price: new Decimal("1200"),
      inOffer: true,
      offerPrice: new Decimal("999"),
      startingFrom: new Date("2026-07-21T00:00:00.000Z"),
      endsIn: new Date("2026-07-22T00:00:00.000Z"),
    };

    expect(isProductOfferActive(product, now)).toBe(true);
    expect(resolveProductEffectivePrice(product, now).toString()).toBe("999");
  });

  it("falls back to the base price outside the offer period", () => {
    const product = {
      price: new Decimal("1200"),
      inOffer: true,
      offerPrice: new Decimal("999"),
      startingFrom: new Date("2026-07-22T00:00:00.000Z"),
      endsIn: new Date("2026-07-23T00:00:00.000Z"),
    };

    expect(isProductOfferActive(product, now)).toBe(false);
    expect(resolveProductEffectivePrice(product, now).toString()).toBe("1200");
  });
});
