import { BadRequestException } from "@nestjs/common";
import {
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
} from "@prisma/client";

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
    throw new BadRequestException("Payment cannot be added to this order");
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
  totalAmount: Prisma.Decimal.Value,
  paidAmount: Prisma.Decimal.Value,
) {
  const paid = new Prisma.Decimal(paidAmount);
  const total = new Prisma.Decimal(totalAmount);

  return paid.isZero()
    ? OrderPaymentStatus.UNPAID
    : paid.lessThan(total)
      ? OrderPaymentStatus.PARTIALLY_PAID
      : OrderPaymentStatus.PAID;
}
