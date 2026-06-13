import { FinanceReceivableStatus, Prisma } from "@prisma/client";

import { toMoney } from "./money";

export function getReceivableStatus(
  totalAmount: Prisma.Decimal.Value,
  receivedAmount: Prisma.Decimal.Value,
) {
  const total = toMoney(totalAmount);
  const received = toMoney(receivedAmount);

  if (received.greaterThanOrEqualTo(total)) {
    return FinanceReceivableStatus.RECEIVED;
  }

  return received.isZero()
    ? FinanceReceivableStatus.PENDING
    : FinanceReceivableStatus.PARTIALLY_RECEIVED;
}
