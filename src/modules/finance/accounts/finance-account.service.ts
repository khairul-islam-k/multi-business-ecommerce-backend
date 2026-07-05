import Decimal from "decimal.js";
import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

import {
  businessSetting,
  FinanceAccount,
  financeAccount,
  FinanceAccountStatus,
  financeAccountTransaction,
  financeExpense,
  FinanceSourceType,
  orderPayment,
  paymentGatewayConfig,
} from "@/database/schema";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { isUniqueConstraintError } from "../../../common/database/db-error.util";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import { DatabaseService } from "../../../database/database.service";
import { FinanceLedgerService } from "../common/finance-ledger.service";
import {
  AddFinanceAccountMoneyDto,
  CreateFinanceAccountDto,
  QueryFinanceAccountDto,
  QueryFinanceTransactionDto,
  UpdateFinanceAccountDto,
} from "./dto/finance-account.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

type FinanceAccountWithCount = FinanceAccount & {
  _count: {
    transactions: number;
    expenses: number;
    orderPayments: number;
  };
};

@Injectable()
export class FinanceAccountService {
  constructor(
    private readonly database: DatabaseService,
    private readonly ledger: FinanceLedgerService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateFinanceAccountDto,
  ) {
    const openingBalance = new Decimal(dto.openingBalance ?? 0);

    try {
      const account = await this.db.transaction(async (tx) => {
        const [createdAccount] = await tx
          .insert(financeAccount)
          .values({
            businessId,
            name: this.normalizeName(dto.name),
            accountType: dto.accountType,
            accountNumber: this.normalizeNullableText(dto.accountNumber),
            currencyCode: dto.currencyCode?.trim().toUpperCase() || "BDT",
            openingBalance,
            currentBalance: new Decimal(0),
            status: dto.status ?? FinanceAccountStatus.ACTIVE,
            createdBy: currentUser.id,
            updatedBy: currentUser.id,
          })
          .returning();

        if (openingBalance.greaterThan(0)) {
          await this.ledger.creditAccount(tx, {
            businessId,
            accountId: createdAccount.id,
            amount: openingBalance,
            referenceType: FinanceSourceType.MANUAL,
            note: "Opening balance",
            createdBy: currentUser.id,
          });
        }

        const latest = await this.findAccountRow(businessId, createdAccount.id);

        return latest ? this.withAccountCount(latest) : null;
      });

      return apiResponse(account, "Finance account created successfully");
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findAll(businessId: string, query: QueryFinanceAccountDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(financeAccount.businessId, businessId),
      isNull(financeAccount.deletedAt),
      query.accountType
        ? eq(financeAccount.accountType, query.accountType)
        : undefined,
      query.status ? eq(financeAccount.status, query.status) : undefined,
      query.search
        ? or(
            ilike(financeAccount.name, `%${query.search}%`),
            ilike(financeAccount.accountNumber, `%${query.search}%`),
          )
        : undefined,
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(financeAccount)
        .where(where)
        .orderBy(desc(financeAccount.createdAt))
        .limit(limit)
        .offset(skip)
        .then((rows) => this.withAccountsCount(rows)),
      this.db
        .select({ value: count() })
        .from(financeAccount)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      items,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Finance accounts were loaded successfully. The response includes the requested page of accounts for this business and pagination metadata for browsing more results.",
    );
  }

  async findOne(businessId: string, accountId: string) {
    const account = await this.findAccountRow(businessId, accountId);

    if (!account) {
      throw new NotFoundException(
        "Finance account could not be found. It may not exist, may have been deleted, or may not belong to the current business.",
      );
    }

    return apiResponse(await this.withAccountCount(account));
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    accountId: string,
    dto: UpdateFinanceAccountDto,
  ) {
    await this.assertAccountExists(businessId, accountId);

    if (dto.openingBalance !== undefined) {
      throw new BadRequestException("Opening balance cannot be edited");
    }

    try {
      const [account] = await this.db
        .update(financeAccount)
        .set({
          ...(dto.name !== undefined && {
            name: this.normalizeName(dto.name),
          }),
          ...(dto.accountType !== undefined && {
            accountType: dto.accountType,
          }),
          ...(dto.accountNumber !== undefined && {
            accountNumber: this.normalizeNullableText(dto.accountNumber),
          }),
          ...(dto.currencyCode !== undefined && {
            currencyCode: dto.currencyCode.trim().toUpperCase(),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          updatedBy: currentUser.id,
        })
        .where(eq(financeAccount.id, accountId))
        .returning();

      return apiResponse(
        await this.withAccountCount(account),
        "Finance account updated successfully",
      );
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async addMoney(
    currentUser: CurrentUserPayload,
    businessId: string,
    accountId: string,
    dto: AddFinanceAccountMoneyDto,
  ) {
    await this.assertAccountExists(businessId, accountId);

    const account = await this.db.transaction(async (tx) => {
      await this.ledger.creditAccount(tx, {
        businessId,
        accountId,
        amount: dto.amount,
        referenceType: FinanceSourceType.MANUAL,
        note: dto.note,
        createdBy: currentUser.id,
      });

      return this.findAccountRow(businessId, accountId);
    });

    return apiResponse(
      account ? await this.withAccountCount(account) : null,
      "Money added to finance account",
    );
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    accountId: string,
  ) {
    const account = await this.assertAccountExists(businessId, accountId);

    if (new Decimal(account.currentBalance).greaterThan(0)) {
      throw new BadRequestException(
        "Finance account cannot be deleted while it has a balance",
      );
    }

    await this.assertAccountCanBeDeleted(businessId, accountId);

    await this.db
      .update(financeAccount)
      .set({
        status: FinanceAccountStatus.INACTIVE,
        deletedAt: new Date(),
        deletedBy: currentUser.id,
        updatedBy: currentUser.id,
      })
      .where(eq(financeAccount.id, accountId));

    return apiResponse(null, "Finance account deleted successfully");
  }

  async findTransactions(
    businessId: string,
    accountId: string,
    query: QueryFinanceTransactionDto,
  ) {
    await this.assertAccountExists(businessId, accountId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(financeAccountTransaction.businessId, businessId),
      eq(financeAccountTransaction.accountId, accountId),
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(financeAccountTransaction)
        .where(where)
        .orderBy(desc(financeAccountTransaction.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(financeAccountTransaction)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      items,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Finance account transactions were loaded successfully. The response includes the requested page of transactions for this account and pagination metadata for browsing more results.",
    );
  }

  private async assertAccountExists(businessId: string, accountId: string) {
    const account = await this.findAccountRow(businessId, accountId);

    if (!account) {
      throw new NotFoundException(
        "Finance account could not be found. It may not exist, may have been deleted, or may not belong to the current business.",
      );
    }

    return account;
  }

  private findAccountRow(businessId: string, accountId: string) {
    return this.db
      .select()
      .from(financeAccount)
      .where(
        and(
          eq(financeAccount.id, accountId),
          eq(financeAccount.businessId, businessId),
          isNull(financeAccount.deletedAt),
        ),
      )
      .limit(1)
      .then(([account]) => account ?? null);
  }

  private async withAccountsCount(accounts: FinanceAccount[]) {
    return Promise.all(
      accounts.map((account) => this.withAccountCount(account)),
    );
  }

  private async assertAccountCanBeDeleted(
    businessId: string,
    accountId: string,
  ) {
    const [defaultReference, gatewayConfigReference] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(businessSetting)
        .where(
          and(
            eq(businessSetting.businessId, businessId),
            eq(businessSetting.defaultFinanceAccountId, accountId),
          ),
        )
        .then(([row]) => row?.value ?? 0),
      this.db
        .select({ value: count() })
        .from(paymentGatewayConfig)
        .where(
          and(
            eq(paymentGatewayConfig.businessId, businessId),
            eq(paymentGatewayConfig.financeAccountId, accountId),
            isNull(paymentGatewayConfig.deletedAt),
          ),
        )
        .then(([row]) => row?.value ?? 0),
    ]);

    if (defaultReference > 0) {
      throw new BadRequestException(
        "Default finance account cannot be deleted. Select another active default account in business settings first.",
      );
    }

    if (gatewayConfigReference > 0) {
      throw new BadRequestException(
        "Finance account cannot be deleted while active payment gateway configurations use it.",
      );
    }
  }

  private async withAccountCount(
    account: FinanceAccount,
  ): Promise<FinanceAccountWithCount> {
    const [transactions, expenses, orderPayments] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(financeAccountTransaction)
        .where(eq(financeAccountTransaction.accountId, account.id))
        .then(([row]) => row?.value ?? 0),
      this.db
        .select({ value: count() })
        .from(financeExpense)
        .where(eq(financeExpense.accountId, account.id))
        .then(([row]) => row?.value ?? 0),
      this.db
        .select({ value: count() })
        .from(orderPayment)
        .where(eq(orderPayment.financeAccountId, account.id))
        .then(([row]) => row?.value ?? 0),
    ]);

    return {
      ...account,
      _count: {
        transactions,
        expenses,
        orderPayments,
      },
    };
  }

  private normalizeName(value: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException("Finance account name is required");
    }

    return normalized;
  }

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }

  private handleDatabaseError(error: unknown): never {
    if (isUniqueConstraintError(error)) {
      throw new ConflictException("Finance account name already exists");
    }

    throw error;
  }
}
