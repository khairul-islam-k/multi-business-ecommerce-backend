import Decimal from "decimal.js";
import { and, eq, isNull } from "drizzle-orm";

import {
  financeAccount,
  FinanceAccountStatus,
  financeAccountTransaction,
  FinanceSourceType,
  FinanceTransactionType,
} from "@/database/schema";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { normalizeOptionalText } from "../../../common/text/normalizers";
import { assertPositiveMoney, toMoney } from "../domain/money";
import { FinanceCodeService } from "./finance-code.service";

import type { DatabaseTransaction } from "../../../database/database.service";

@Injectable()
export class AccountBalanceService {
  constructor(private readonly financeCodes: FinanceCodeService) {}

  async creditAccount(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      accountId: string;
      amount: Decimal.Value;
      referenceType?: FinanceSourceType;
      referenceId?: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    return this.moveAccountBalance(tx, {
      ...params,
      transactionType: FinanceTransactionType.CREDIT,
    });
  }

  async debitAccount(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      accountId: string;
      amount: Decimal.Value;
      referenceType?: FinanceSourceType;
      referenceId?: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    return this.moveAccountBalance(tx, {
      ...params,
      transactionType: FinanceTransactionType.DEBIT,
    });
  }

  private async moveAccountBalance(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      accountId: string;
      amount: Decimal.Value;
      transactionType: FinanceTransactionType;
      referenceType?: FinanceSourceType;
      referenceId?: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    const amount = toMoney(params.amount);

    assertPositiveMoney(amount, "Transaction amount must be greater than 0");

    const [account] = await tx
      .select()
      .from(financeAccount)
      .where(
        and(
          eq(financeAccount.id, params.accountId),
          eq(financeAccount.businessId, params.businessId),
          isNull(financeAccount.deletedAt),
          eq(financeAccount.status, FinanceAccountStatus.ACTIVE),
        ),
      )
      .limit(1);

    if (!account) {
      throw new NotFoundException(
        "Finance account could not be found. It may not exist, may have been deleted, or may not belong to the current business.",
      );
    }

    const balanceBefore = toMoney(account.currentBalance);
    const balanceAfter =
      params.transactionType === FinanceTransactionType.CREDIT
        ? balanceBefore.plus(amount)
        : balanceBefore.minus(amount);

    if (balanceAfter.lessThan(0)) {
      throw new BadRequestException("Finance account balance is insufficient");
    }

    const [transaction] = await tx
      .insert(financeAccountTransaction)
      .values({
        businessId: params.businessId,
        accountId: account.id,
        transactionNo: await this.financeCodes.generateUniqueTransactionNo(
          params.businessId,
        ),
        transactionType: params.transactionType,
        amount,
        balanceBefore,
        balanceAfter,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        note: normalizeOptionalText(params.note),
        createdBy: params.createdBy,
      })
      .returning();

    await tx
      .update(financeAccount)
      .set({ currentBalance: balanceAfter })
      .where(eq(financeAccount.id, account.id));

    return transaction;
  }
}
