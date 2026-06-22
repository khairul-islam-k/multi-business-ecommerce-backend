import Decimal from "decimal.js";
import { describe, expect, it, jest } from "@jest/globals";

import {
  orderCartItem,
  productReview,
  ProductReviewStatus,
} from "@/database/schema";

import { StorefrontCustomerService } from "./storefront-customer.service";

const currentCustomer = {
  accountId: "account-1",
  customerId: "customer-1",
  websiteId: "website-1",
  businessId: "business-1",
  email: "buyer@example.com",
  name: "Buyer One",
};

function createService() {
  const updates: { table: unknown; values: Record<string, unknown> }[] = [];
  const inserts: { table: unknown; values: Record<string, unknown> }[] = [];
  const db = {
    update: jest.fn((table) => ({
      set: jest.fn((values: Record<string, unknown>) => {
        updates.push({ table, values });

        return { where: jest.fn(async () => undefined) };
      }),
    })),
    insert: jest.fn((table) => ({
      values: jest.fn((values: Record<string, unknown>) => {
        inserts.push({ table, values });

        return {
          returning: jest.fn(async () => [
            {
              id: "created-1",
              ...values,
            },
          ]),
        };
      }),
    })),
  };
  const websites = {
    findPublishedById: jest.fn(async () => ({
      id: "website-1",
      businessId: "business-1",
    })),
  };
  const service = new StorefrontCustomerService(
    { db } as never,
    websites as never,
  );

  return { db, inserts, service, updates };
}

describe("StorefrontCustomerService", () => {
  it("merges duplicate cart items by increasing quantity", async () => {
    const { service, updates } = createService();
    const cart = {
      id: "cart-1",
      businessId: "business-1",
      customerId: "customer-1",
    };
    const hydratedCart = { ...cart, items: [] };

    jest
      .spyOn(service as any, "assertStorefrontCustomer")
      .mockResolvedValue({ id: "website-1" } as never);
    jest
      .spyOn(service as any, "assertCartItemTarget")
      .mockResolvedValue(undefined as never);
    jest
      .spyOn(service as any, "findOrCreateActiveCart")
      .mockResolvedValue(cart as never);
    jest.spyOn(service as any, "findCartItemByProduct").mockResolvedValue({
      id: "item-1",
      quantity: new Decimal(2),
    } as never);
    jest
      .spyOn(service as any, "hydrateCart")
      .mockResolvedValue(hydratedCart as never);

    const result = await service.addCartItem(currentCustomer, "website-1", {
      productId: "product-1",
      quantity: 3,
    });

    expect(result.data).toBe(hydratedCart);
    expect(updates).toContainEqual({
      table: orderCartItem,
      values: expect.objectContaining({
        quantity: expect.any(Decimal),
      }),
    });
    expect((updates[0].values.quantity as Decimal).equals(new Decimal(5))).toBe(
      true,
    );
  });

  it("stores authenticated customer id when creating a storefront review", async () => {
    const { inserts, service } = createService();

    jest
      .spyOn(service as any, "assertStorefrontCustomer")
      .mockResolvedValue({ id: "website-1" } as never);
    jest
      .spyOn(service as any, "assertReviewTarget")
      .mockResolvedValue(undefined as never);
    jest.spyOn(service as any, "getCustomerOrThrow").mockResolvedValue({
      id: "customer-1",
      name: "Buyer One",
      phone: "+8801700000000",
    } as never);

    const result = await service.createReview(
      currentCustomer,
      "website-1",
      "product-1",
      {
        rating: 5,
        title: "Great",
        comment: "Loved it",
      },
    );

    expect(result.data).toMatchObject({
      id: "created-1",
      customerId: "customer-1",
      status: ProductReviewStatus.PENDING,
    });
    expect(inserts).toContainEqual({
      table: productReview,
      values: expect.objectContaining({
        businessId: "business-1",
        customerId: "customer-1",
        productId: "product-1",
        reviewerName: "Buyer One",
        reviewerEmail: "buyer@example.com",
        reviewerPhone: "+8801700000000",
        status: ProductReviewStatus.PENDING,
      }),
    });
  });
});
