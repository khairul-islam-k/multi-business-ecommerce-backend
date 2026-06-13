import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FinanceAccountStatus,
  FinanceSourceType,
  FinanceTransactionType,
  Prisma,
} from "@prisma/client";

import { normalizeOptionalText } from "../../../common/text/normalizers";
import { FinanceCodeService } from "./finance-code.service";
import { assertPositiveMoney, toMoney } from "../domain/money";

@Injectable()
export class AccountBalanceService {
  constructor(private readonly financeCodes: FinanceCodeService) {}

  async creditAccount(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      accountId: string;
      amount: Prisma.Decimal.Value;
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
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      accountId: string;
      amount: Prisma.Decimal.Value;
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
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      accountId: string;
      amount: Prisma.Decimal.Value;
      transactionType: FinanceTransactionType;
      referenceType?: FinanceSourceType;
      referenceId?: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    const amount = toMoney(params.amount);

    assertPositiveMoney(amount, "Transaction amount must be greater than 0");

    const account = await tx.financeAccount.findFirst({
      where: {
        id: params.accountId,
        businessId: params.businessId,
        deletedAt: null,
        status: FinanceAccountStatus.ACTIVE,
      },
    });

    if (!account) {
      throw new NotFoundException("Finance account not found");
    }

    const balanceBefore = toMoney(account.currentBalance);
    const balanceAfter =
      params.transactionType === FinanceTransactionType.CREDIT
        ? balanceBefore.plus(amount)
        : balanceBefore.minus(amount);

    if (balanceAfter.lessThan(0)) {
      throw new BadRequestException("Finance account balance is insufficient");
    }

    const transaction = await tx.financeAccountTransaction.create({
      data: {
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
      },
    });

    await tx.financeAccount.update({
      where: { id: account.id },
      data: {
        currentBalance: balanceAfter,
      },
    });

    return transaction;
  }
}
