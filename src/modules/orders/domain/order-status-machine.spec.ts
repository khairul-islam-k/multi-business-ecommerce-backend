import { describe, expect, it } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";

import {
  assertCanCancelOrder,
  assertCanDeliverOrder,
  assertCanShipOrder,
} from "./order-status-machine";

describe("order status machine", () => {
  it("allows valid ship and deliver transitions", () => {
    expect(() => assertCanShipOrder(OrderStatus.CONFIRMED)).not.toThrow();
    expect(() => assertCanDeliverOrder(OrderStatus.SHIPPED)).not.toThrow();
  });

  it("rejects invalid transitions", () => {
    expect(() => assertCanShipOrder(OrderStatus.DELIVERED)).toThrow(
      BadRequestException,
    );
    expect(() => assertCanCancelOrder(OrderStatus.DELIVERED)).toThrow(
      BadRequestException,
    );
  });
});
