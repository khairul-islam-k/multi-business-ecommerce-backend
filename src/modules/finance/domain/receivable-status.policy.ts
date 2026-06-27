import Decimal from "decimal.js";

import { FinanceReceivableStatus } from "@/database/schema";

import { toMoney } from "./money";

export function getReceivableStatus(
  totalAmount: Decimal.Value,
  receivedAmount: Decimal.Value,
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
