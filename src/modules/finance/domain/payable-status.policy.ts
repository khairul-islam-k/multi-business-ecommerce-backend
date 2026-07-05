import Decimal from "decimal.js";

import { FinancePayableStatus } from "@/database/schema";

import { toMoney } from "./money";

export function getPayableStatus(
  totalAmount: Decimal.Value,
  paidAmount: Decimal.Value,
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
