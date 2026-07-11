import Decimal from "decimal.js";

import {
  customerWishlist,
  orderCart,
  orderCartItem,
  OrderCartStatus,
  OrderStatus,
  productReview,
  ProductReviewStatus,
} from "@/database/schema";
import { describe, expect, it, jest } from "@jest/globals";

import { StorefrontCustomerService } from "./storefront-customer.service";
import { StorefrontCheckoutPaymentMethod } from "./dto/storefront-customer.dto";

const currentCustomer = {
  accountId: "account-1",
  customerId: "customer-1",
  websiteId: "website-1",
  businessId: "business-1",
  email: "buyer@example.com",
  name: "Buyer One",
};

function createService() {
  const deletes: unknown[] = [];
  const updates: { table: unknown; values: Record<string, unknown> }[] = [];
  const inserts: { table: unknown; values: Record<string, unknown> }[] = [];
  const db = {
    delete: jest.fn((table) => {
      deletes.push(table);

      return { where: jest.fn(() => Promise.resolve(undefined)) };
    }),
    update: jest.fn((table) => ({
      set: jest.fn((values: Record<string, unknown>) => {
        updates.push({ table, values });

        return { where: jest.fn(() => Promise.resolve(undefined)) };
      }),
    })),
    insert: jest.fn((table) => ({
      values: jest.fn((values: Record<string, unknown>) => {
        inserts.push({ table, values });

        return {
          returning: jest.fn(() =>
            Promise.resolve([
              {
                id: "created-1",
                ...values,
              },
            ]),
          ),
        };
      }),
    })),
  };
  const websites = {
    findPublishedById: jest.fn(() =>
      Promise.resolve({
        id: "website-1",
        businessId: "business-1",
      }),
    ),
  };
  const orders = {
    createStorefrontOrder: jest.fn(),
    cancelByCustomer: jest.fn(),
  };
  const orderCodes = {
    generateUniqueReturnNo: jest.fn(),
  };
  const couriers = {
    prepareStorefrontOrderCourier: jest.fn(),
  };
  const service = new StorefrontCustomerService(
    { db } as never,
    websites as never,
    orders as never,
    orderCodes as never,
    couriers as never,
  );

  return {
    couriers,
    db,
    deletes,
    inserts,
    orderCodes,
    orders,
    service,
    updates,
  };
}

describe("StorefrontCustomerService", () => {
  it("merges duplicate cart items by increasing quantity", async () => {
    const { service, updates } = createService();
    const cart = {
      id: "cart-1",
      businessId: "business-1",
      customerId: "customer-1",
    };
    const updatedCart = { ...cart, weight: new Decimal("2.50") };
    const hydratedCart = { ...updatedCart, items: [] };

    jest
      .spyOn(service as any, "assertStorefrontCustomer")
      .mockResolvedValue({ id: "website-1" });
    jest
      .spyOn(service as any, "assertCartItemTarget")
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, "findOrCreateActiveCart")
      .mockResolvedValue(cart);
    jest.spyOn(service as any, "findCartItemByProduct").mockResolvedValue({
      id: "item-1",
      quantity: new Decimal(2),
    });
    const refreshCartWeight = jest
      .spyOn(service as any, "refreshCartWeight")
      .mockResolvedValue(updatedCart);
    jest.spyOn(service as any, "hydrateCart").mockResolvedValue(hydratedCart);

    const result = await service.addCartItem(currentCustomer, "website-1", {
      productId: "product-1",
      quantity: 3,
    });

    expect(result.data).toBe(hydratedCart);
    expect(refreshCartWeight).toHaveBeenCalledWith("cart-1");
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
      .mockResolvedValue({ id: "website-1" });
    jest
      .spyOn(service as any, "assertReviewTarget")
      .mockResolvedValue(undefined);
    jest.spyOn(service as any, "getCustomerOrThrow").mockResolvedValue({
      id: "customer-1",
      name: "Buyer One",
      phone: "+8801700000000",
    });

    const result = await service.createReview(currentCustomer, "website-1", {
      productId: "product-1",
      rating: 5,
      title: "Great",
      comment: "Loved it",
    });

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

  it("places the active cart as an unpaid storefront order", async () => {
    const { orders, service, updates } = createService();
    const cart = {
      id: "cart-1",
      businessId: "business-1",
      customerId: "customer-1",
    };
    const placedOrder = {
      id: "order-1",
      status: OrderStatus.PLACED,
    };

    orders.createStorefrontOrder.mockResolvedValue({
      data: { id: "order-1" },
    } as never);

    jest
      .spyOn(service as any, "assertStorefrontCustomer")
      .mockResolvedValue({ id: "website-1" });
    jest.spyOn(service as any, "getCustomerOrThrow").mockResolvedValue({
      id: "customer-1",
      name: "Buyer One",
      phone: "+8801700000000",
    });
    jest.spyOn(service as any, "findActiveCart").mockResolvedValue(cart);
    jest.spyOn(service as any, "getCartItems").mockResolvedValue([
      {
        productId: "product-1",
        variantId: null,
        quantity: new Decimal(2),
      },
    ] as never);
    jest
      .spyOn(service as any, "findCustomerOrderOrThrow")
      .mockResolvedValue(placedOrder);
    jest
      .spyOn(service as any, "assertCheckoutPaymentSettings")
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, "assertItemInStock")
      .mockResolvedValue(undefined);

    const result = await service.placeOrder(currentCustomer, "website-1", {
      paymentMethod: StorefrontCheckoutPaymentMethod.ONLINE,
      shippingAddressSnapshot: { address: "House 42" },
    });

    expect(result.data).toBe(placedOrder);
    expect(orders.createStorefrontOrder).toHaveBeenCalledWith("business-1", {
      customerId: "customer-1",
      customerName: "Buyer One",
      customerPhone: "+8801700000000",
      customerEmail: "buyer@example.com",
      items: [
        {
          productId: "product-1",
          variantId: undefined,
          quantity: 2,
        },
      ],
      note: undefined,
      shippingAddressSnapshot: { address: "House 42" },
      shippingCharge: 0,
      isCod: false,
    });
    expect(updates).toContainEqual({
      table: orderCart,
      values: {
        status: OrderCartStatus.ORDERED,
      },
    });
  });

  it("places a selected active cart as an unpaid storefront order", async () => {
    const { orders, service, updates } = createService();
    const cart = {
      id: "cart-2",
      businessId: "business-1",
      customerId: "customer-1",
    };
    const placedOrder = {
      id: "order-2",
      status: OrderStatus.PLACED,
    };

    orders.createStorefrontOrder.mockResolvedValue({
      data: { id: "order-2" },
    } as never);

    jest
      .spyOn(service as any, "assertStorefrontCustomer")
      .mockResolvedValue({ id: "website-1" });
    jest
      .spyOn(service as any, "getPlaceableCartOrThrow")
      .mockResolvedValue(cart);
    jest.spyOn(service as any, "getCustomerOrThrow").mockResolvedValue({
      id: "customer-1",
      name: "Buyer One",
      phone: "+8801700000000",
    });
    jest.spyOn(service as any, "getCartItems").mockResolvedValue([
      {
        productId: "product-1",
        variantId: null,
        quantity: new Decimal(2),
      },
    ] as never);
    jest
      .spyOn(service as any, "findCustomerOrderOrThrow")
      .mockResolvedValue(placedOrder);
    jest
      .spyOn(service as any, "assertCheckoutPaymentSettings")
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, "assertItemInStock")
      .mockResolvedValue(undefined);

    const result = await service.placeOrderFromCart(
      currentCustomer,
      "website-1",
      "cart-2",
      {
        paymentMethod: StorefrontCheckoutPaymentMethod.ONLINE,
        shippingAddressSnapshot: { address: "House 42" },
      },
    );

    expect(result.data).toBe(placedOrder);
    expect(service["getPlaceableCartOrThrow"]).toHaveBeenCalledWith(
      currentCustomer,
      "cart-2",
    );
    expect(updates).toContainEqual({
      table: orderCart,
      values: {
        status: OrderCartStatus.ORDERED,
      },
    });
  });

  it("uses a saved customer address snapshot when placing an order", async () => {
    const { orders, service } = createService();
    const cart = {
      id: "cart-1",
      businessId: "business-1",
      customerId: "customer-1",
    };

    orders.createStorefrontOrder.mockResolvedValue({
      data: { id: "order-1" },
    } as never);

    jest
      .spyOn(service as any, "assertStorefrontCustomer")
      .mockResolvedValue({ id: "website-1" });
    jest.spyOn(service as any, "getCustomerOrThrow").mockResolvedValue({
      id: "customer-1",
      name: "Buyer One",
      phone: "+8801700000000",
    });
    jest.spyOn(service as any, "findActiveCart").mockResolvedValue(cart);
    jest.spyOn(service as any, "getCartItems").mockResolvedValue([
      {
        productId: "product-1",
        variantId: "variant-1",
        quantity: new Decimal(1),
      },
    ] as never);
    jest.spyOn(service as any, "getCustomerAddressOrThrow").mockResolvedValue({
      id: "address-1",
      addressType: "HOME",
      name: "Home",
      address: "House 42",
      city: "Dhaka",
      country: "Bangladesh",
    });
    jest.spyOn(service as any, "findCustomerOrderOrThrow").mockResolvedValue({
      id: "order-1",
    });
    jest
      .spyOn(service as any, "assertCheckoutPaymentSettings")
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, "assertItemInStock")
      .mockResolvedValue(undefined);

    await service.placeOrder(currentCustomer, "website-1", {
      paymentMethod: StorefrontCheckoutPaymentMethod.COD,
      shippingAddressId: "address-1",
    });

    expect(orders.createStorefrontOrder).toHaveBeenCalledWith(
      "business-1",
      expect.objectContaining({
        shippingAddressSnapshot: {
          addressId: "address-1",
          addressType: "HOME",
          name: "Home",
          address: "House 42",
          city: "Dhaka",
          country: "Bangladesh",
        },
        isCod: true,
        shippingCharge: 0,
      }),
    );
  });

  it("adds a product to the customer wishlist", async () => {
    const { inserts, service } = createService();
    const wishlistItem = {
      id: "wishlist-1",
      businessId: "business-1",
      customerId: "customer-1",
      productId: "product-1",
      variantId: null,
    };

    jest
      .spyOn(service as any, "assertStorefrontCustomer")
      .mockResolvedValue({ id: "website-1" });
    jest
      .spyOn(service as any, "getActiveProductOrThrow")
      .mockResolvedValue({ id: "product-1" });
    jest
      .spyOn(service as any, "assertVariantSelection")
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, "findWishlistItemByProduct")
      .mockResolvedValue(null);
    jest
      .spyOn(service as any, "hydrateWishlistItem")
      .mockResolvedValue(wishlistItem);

    const result = await service.addWishlistItem(currentCustomer, "website-1", {
      productId: "product-1",
    });

    expect(result.data).toBe(wishlistItem);
    expect(inserts).toContainEqual({
      table: customerWishlist,
      values: expect.objectContaining({
        businessId: "business-1",
        customerId: "customer-1",
        productId: "product-1",
        variantId: null,
      }),
    });
  });
});
