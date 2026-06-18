import { describe, expect, it, jest } from "@jest/globals";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import Decimal from "decimal.js";

import {
  FinanceAccountStatus,
  FinanceSourceType,
  FinanceTransactionType,
  financeAccount,
  financeAccountTransaction,
} from "@/database/schema";

import { AccountBalanceService } from "./account-balance.service";

function createService() {
  const financeCodes = {
    generateUniqueTransactionNo: jest.fn(async () => "TXN-001"),
  };

  return {
    financeCodes,
    service: new AccountBalanceService(financeCodes as never),
  };
}

function createTx(account: Record<string, unknown> | null) {
  const insertedValues: Record<string, unknown>[] = [];
  const updatedValues: Record<string, unknown>[] = [];

  const tx = {
    insertedValues,
    updatedValues,
    select: jest.fn(() => {
      let selectedTable: unknown;
      const builder = {
        from(table: unknown) {
          selectedTable = table;
          return builder;
        },
        where: () => builder,
        limit: () =>
          selectedTable === financeAccount && account ? [account] : [],
      };

      return builder;
    }),
    insert: jest.fn((table) => {
      if (table !== financeAccountTransaction) {
        throw new Error("Unexpected insert table");
      }

      return {
        values(values: Record<string, unknown>) {
          insertedValues.push(values);
          return {
            returning: jest.fn(async () => [
              {
                id: "transaction-1",
                ...values,
              },
            ]),
          };
        },
      };
    }),
    update: jest.fn((table) => {
      if (table !== financeAccount) {
        throw new Error("Unexpected update table");
      }

      return {
        set(values: Record<string, unknown>) {
          updatedValues.push(values);
          return { where: jest.fn(async () => undefined) };
        },
      };
    }),
  };

  return tx;
}

describe("AccountBalanceService", () => {
  it("credits active accounts and records the balance snapshot", async () => {
    const { service } = createService();
    const tx = createTx({
      id: "account-1",
      businessId: "business-1",
      status: FinanceAccountStatus.ACTIVE,
      currentBalance: new Decimal(100),
    });

    const transaction = await service.creditAccount(tx as never, {
      businessId: "business-1",
      accountId: "account-1",
      amount: "25.50",
      referenceType: FinanceSourceType.ORDER,
      referenceId: "order-1",
      note: " Order payment ",
      createdBy: "user-1",
    });

    expect(transaction.transactionType).toBe(FinanceTransactionType.CREDIT);
    expect(new Decimal(transaction.balanceBefore).toString()).toBe("100");
    expect(new Decimal(transaction.balanceAfter).toString()).toBe("125.5");
    expect(
      new Decimal(
        tx.updatedValues[0].currentBalance as Decimal.Value,
      ).toString(),
    ).toBe("125.5");
    expect(tx.insertedValues[0]).toMatchObject({
      transactionNo: "TXN-001",
      referenceType: FinanceSourceType.ORDER,
      referenceId: "order-1",
      note: "Order payment",
    });
  });

  it("rejects debits that would make an account negative", async () => {
    const { service } = createService();
    const tx = createTx({
      id: "account-1",
      businessId: "business-1",
      status: FinanceAccountStatus.ACTIVE,
      currentBalance: new Decimal(10),
    });

    await expect(
      service.debitAccount(tx as never, {
        businessId: "business-1",
        accountId: "account-1",
        amount: 11,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("requires an active finance account", async () => {
    const { service } = createService();
    const tx = createTx(null);

    await expect(
      service.creditAccount(tx as never, {
        businessId: "business-1",
        accountId: "missing-account",
        amount: 1,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
