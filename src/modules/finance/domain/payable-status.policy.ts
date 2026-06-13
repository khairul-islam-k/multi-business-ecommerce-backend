import { FinancePayableStatus, Prisma } from "@prisma/client";

import { toMoney } from "./money";

export function getPayableStatus(
  totalAmount: Prisma.Decimal.Value,
  paidAmount: Prisma.Decimal.Value,
) {
  const total = toMoney(totalAmount);
  const paid = toMoney(paidAmount);

  if (paid.greaterThanOrEqualTo(total)) {
    return FinancePayableStatus.PAID;
  }

  return paid.isZero()
    ? FinancePayableStatus.PENDING
    : FinancePayableStatus.PARTIALLY_PAID;
}
