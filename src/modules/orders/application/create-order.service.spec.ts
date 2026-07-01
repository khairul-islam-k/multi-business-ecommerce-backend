import { OrderSource, OrderStatus, OrderType } from "@/database/schema";
import { describe, expect, it, jest } from "@jest/globals";

import { CreateOrderService } from "./create-order.service";

function createService() {
  return new CreateOrderService(
    { db: {} } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe("CreateOrderService", () => {
  it("uses the business default warehouse for storefront orders", async () => {
    const service = createService();
    const createOrderFlow = jest
      .spyOn(service as any, "createOrderFlow")
      .mockResolvedValue({ data: { id: "order-1" } });

    jest
      .spyOn(service as any, "resolveDefaultWarehouseIdOrThrow")
      .mockResolvedValue("warehouse-default");
    jest
      .spyOn(service as any, "assertStorefrontPaymentSettings")
      .mockResolvedValue({ autoConfirmOrder: false });

    await service.createStorefrontOrder("business-1", {
      warehouseId: "warehouse-from-client",
      items: [
        {
          productId: "product-1",
          quantity: 1,
        },
      ],
    });

    expect(createOrderFlow).toHaveBeenCalledWith(
      undefined,
      "business-1",
      expect.objectContaining({
        warehouseId: "warehouse-default",
        orderType: OrderType.ONLINE,
        orderSource: OrderSource.WEBSITE,
        fulfillImmediately: false,
        initialStatus: OrderStatus.PLACED,
      }),
    );
  });

  it("confirms storefront orders on creation when auto-confirm is enabled", async () => {
    const service = createService();
    const createOrderFlow = jest
      .spyOn(service as any, "createOrderFlow")
      .mockResolvedValue({ data: { id: "order-1" } });

    jest
      .spyOn(service as any, "resolveDefaultWarehouseIdOrThrow")
      .mockResolvedValue("warehouse-default");
    jest
      .spyOn(service as any, "assertStorefrontPaymentSettings")
      .mockResolvedValue({ autoConfirmOrder: true });

    await service.createStorefrontOrder("business-1", {
      items: [
        {
          productId: "product-1",
          quantity: 1,
        },
      ],
    });

    expect(createOrderFlow).toHaveBeenCalledWith(
      undefined,
      "business-1",
      expect.objectContaining({
        initialStatus: OrderStatus.CONFIRMED,
      }),
    );
  });
});
