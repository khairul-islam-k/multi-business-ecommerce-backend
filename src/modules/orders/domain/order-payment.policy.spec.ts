import {
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
} from "@/database/schema";
import { describe, expect, it } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";

import {
  assertOrderCanAcceptPayment,
  assertOrderPaymentInput,
  getOrderPaymentStatus,
} from "./order-payment.policy";

describe("order payment policy", () => {
  it("rejects direct payment for COD orders", () => {
    expect(() =>
      assertOrderPaymentInput(
        { paymentMethod: OrderPaymentMethod.CASH, financeAccountId: "account" },
        true,
      ),
    ).toThrow(BadRequestException);
  });

  it("rejects payment for cancelled orders", () => {
    expect(() => assertOrderCanAcceptPayment(OrderStatus.CANCELLED)).toThrow(
      BadRequestException,
    );
  });

  it("calculates payment status from totals", () => {
    expect(getOrderPaymentStatus(100, 0)).toBe(OrderPaymentStatus.UNPAID);
    expect(getOrderPaymentStatus(100, 50)).toBe(
      OrderPaymentStatus.PARTIALLY_PAID,
    );
    expect(getOrderPaymentStatus(100, 100)).toBe(OrderPaymentStatus.PAID);
  });
});
