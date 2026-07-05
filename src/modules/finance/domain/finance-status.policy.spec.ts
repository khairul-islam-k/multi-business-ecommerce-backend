import {
  FinancePayableStatus,
  FinanceReceivableStatus,
} from "@/database/schema";
import { describe, expect, it } from "@jest/globals";

import { getPayableStatus } from "./payable-status.policy";
import { getReceivableStatus } from "./receivable-status.policy";

describe("finance status policies", () => {
  it("derives receivable statuses", () => {
    expect(getReceivableStatus(100, 0)).toBe(FinanceReceivableStatus.PENDING);
    expect(getReceivableStatus(100, 40)).toBe(
      FinanceReceivableStatus.PARTIALLY_RECEIVED,
    );
    expect(getReceivableStatus(100, 100)).toBe(
      FinanceReceivableStatus.RECEIVED,
    );
  });

  it("derives payable statuses", () => {
    expect(getPayableStatus(100, 0)).toBe(FinancePayableStatus.PENDING);
    expect(getPayableStatus(100, 40)).toBe(FinancePayableStatus.PARTIALLY_PAID);
    expect(getPayableStatus(100, 100)).toBe(FinancePayableStatus.PAID);
  });
});
