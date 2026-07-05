import {
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
} from "@/database/schema";
import { describe, expect, it } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";

import {
  assertOrderCanAcceptPayment,
  assertOrderIsNotCod,
  assertOrderPaymentInput,
  calculatePaidAmount,
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

  it("rejects adding direct payment to an existing COD order", () => {
    expect(() => assertOrderIsNotCod(true)).toThrow(BadRequestException);
  });

  it("calculates payment status from totals", () => {
    expect(getOrderPaymentStatus(100, 0)).toBe(OrderPaymentStatus.UNPAID);
    expect(getOrderPaymentStatus(100, 50)).toBe(
      OrderPaymentStatus.PARTIALLY_PAID,
    );
    expect(getOrderPaymentStatus(100, 100)).toBe(OrderPaymentStatus.PAID);
  });

  it("counts only paid payment rows as received money", () => {
    expect(
      calculatePaidAmount([
        { amount: 100, paymentStatus: OrderPaymentStatus.PAID },
        { amount: 75, paymentStatus: OrderPaymentStatus.PENDING },
        { amount: 50, paymentStatus: OrderPaymentStatus.FAILED },
      ]).toString(),
    ).toBe("100");
  });
});
