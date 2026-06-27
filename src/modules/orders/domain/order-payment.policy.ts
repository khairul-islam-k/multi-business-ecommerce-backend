import Decimal from "decimal.js";

import {
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
} from "@/database/schema";
import { BadRequestException } from "@nestjs/common";

import type { OrderPaymentInputDto } from "../dto/order.dto";

export function assertOrderPaymentInput(
  payment: OrderPaymentInputDto | undefined,
  isCod?: boolean,
) {
  if (isCod && payment) {
    throw new BadRequestException("COD order cannot include direct payment");
  }

  if (payment?.paymentMethod === OrderPaymentMethod.COD) {
    throw new BadRequestException("COD should not be recorded as a payment");
  }
}

export function assertOrderCanAcceptPayment(status: OrderStatus) {
  const paymentBlockedStatuses: OrderStatus[] = [
    OrderStatus.CANCELLED,
    OrderStatus.RETURNED,
  ];

  if (paymentBlockedStatuses.includes(status)) {
    throw new BadRequestException(
      `Payment cannot be added to this order as it's been ${status}`,
    );
  }
}

export function assertDirectOrderPayment(payment: OrderPaymentInputDto) {
  if (payment.paymentMethod === OrderPaymentMethod.COD) {
    throw new BadRequestException("COD is recorded through courier settlement");
  }
}

export function assertSettlementPayment(
  payment: OrderPaymentInputDto,
): asserts payment is OrderPaymentInputDto & { financeAccountId: string } {
  if (payment.paymentMethod === OrderPaymentMethod.COD) {
    throw new BadRequestException(
      "COD payment is handled by courier settlement",
    );
  }

  if (!payment.financeAccountId) {
    throw new BadRequestException("Finance account is required for payment");
  }
}

export function getOrderPaymentStatus(
  totalAmount: Decimal.Value,
  paidAmount: Decimal.Value,
) {
  const paid = new Decimal(paidAmount);
  const total = new Decimal(totalAmount);

  return paid.isZero()
    ? OrderPaymentStatus.UNPAID
    : paid.lessThan(total)
      ? OrderPaymentStatus.PARTIALLY_PAID
      : OrderPaymentStatus.PAID;
}

export function calculatePaidAmount(
  payments: { amount: Decimal.Value; paymentStatus: OrderPaymentStatus }[],
) {
  return payments
    .filter((payment) => payment.paymentStatus === OrderPaymentStatus.PAID)
    .reduce((total, payment) => total.plus(payment.amount), new Decimal(0));
}
