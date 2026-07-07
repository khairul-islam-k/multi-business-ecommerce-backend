import Decimal from "decimal.js";
import { and, count, desc, eq, exists, ilike, isNull, or } from "drizzle-orm";

import {
  financeAccount,
  FinanceAccountStatus,
  financeExpense,
  financeExpenseCategory,
  FinanceExpenseCategoryStatus,
  FinanceExpenseStatus,
  FinanceSourceType,
} from "@/database/schema";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import {
  normalizeSearch,
  normalizeSearchUuid,
} from "../../../common/http/search.util";
import { DatabaseService } from "../../../database/database.service";
import { FinanceLedgerService } from "../common/finance-ledger.service";
import {
  CreateExpenseDto,
  QueryExpenseDto,
  UpdateExpenseDto,
} from "./dto/finance-expense.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@Injectable()
export class ExpenseService {
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
    dto: CreateExpenseDto,
  ) {
    await Promise.all([
      this.assertActiveAccount(businessId, dto.accountId),
      this.assertActiveCategory(businessId, dto.expenseCategoryId),
    ]);

    const [createdExpense] = await this.db
      .insert(financeExpense)
      .values({
        businessId,
        accountId: dto.accountId,
        expenseCategoryId: dto.expenseCategoryId,
        expenseNo: await this.ledger.generateUniqueExpenseNo(businessId),
        title: this.normalizeName(dto.title),
        amount: new Decimal(dto.amount),
        expenseDate: dto.expenseDate,
        status: FinanceExpenseStatus.DRAFT,
        note: this.normalizeNullableText(dto.note),
        createdBy: currentUser.id,
      })
      .returning();

    const expense = await this.findExpenseWithRelations(
      businessId,
      createdExpense.id,
    );

    return apiResponse(expense, "Expense created successfully");
  }

  async findAll(businessId: string, query: QueryExpenseDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildExpenseWhere(businessId, query);

    const [items, total] = await Promise.all([
      this.selectExpensesWithRelations(where, limit, skip),
      this.db
        .select({ value: count() })
        .from(financeExpense)
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
      "Expenses were loaded successfully. The response includes the requested page of expenses for this business and pagination metadata for browsing more results.",
    );
  }

  async findOne(businessId: string, expenseId: string) {
    const expense = await this.findExpenseWithRelations(businessId, expenseId);

    if (!expense) {
      throw new NotFoundException(
        "Expense could not be found. It may not exist, may have been deleted, or may not belong to the current business.",
      );
    }

    return apiResponse(expense);
  }

  async update(businessId: string, expenseId: string, dto: UpdateExpenseDto) {
    const existingExpense = await this.getExpenseOrThrow(businessId, expenseId);

    if (existingExpense.status !== FinanceExpenseStatus.DRAFT) {
      throw new BadRequestException("Only draft expenses can be updated");
    }

    await Promise.all([
      dto.accountId
        ? this.assertActiveAccount(businessId, dto.accountId)
        : Promise.resolve(),
      dto.expenseCategoryId
        ? this.assertActiveCategory(businessId, dto.expenseCategoryId)
        : Promise.resolve(),
    ]);

    await this.db
      .update(financeExpense)
      .set({
        ...(dto.accountId !== undefined && { accountId: dto.accountId }),
        ...(dto.expenseCategoryId !== undefined && {
          expenseCategoryId: dto.expenseCategoryId,
        }),
        ...(dto.title !== undefined && {
          title: this.normalizeName(dto.title),
        }),
        ...(dto.amount !== undefined && { amount: new Decimal(dto.amount) }),
        ...(dto.expenseDate !== undefined && {
          expenseDate: dto.expenseDate,
        }),
        ...(dto.note !== undefined && {
          note: this.normalizeNullableText(dto.note),
        }),
      })
      .where(eq(financeExpense.id, expenseId));

    const expense = await this.findExpenseWithRelations(businessId, expenseId);

    return apiResponse(expense, "Expense updated successfully");
  }

  async pay(
    currentUser: CurrentUserPayload,
    businessId: string,
    expenseId: string,
  ) {
    const expense = await this.getExpenseOrThrow(businessId, expenseId);

    if (expense.status !== FinanceExpenseStatus.DRAFT) {
      throw new BadRequestException("Only draft expenses can be paid");
    }

    const paidExpense = await this.db.transaction(async (tx) => {
      await this.ledger.debitAccount(tx, {
        businessId,
        accountId: expense.accountId,
        amount: expense.amount,
        referenceType: FinanceSourceType.EXPENSE,
        referenceId: expense.id,
        note: expense.title,
        createdBy: currentUser.id,
      });

      await tx
        .update(financeExpense)
        .set({ status: FinanceExpenseStatus.PAID })
        .where(eq(financeExpense.id, expense.id));

      return this.findExpenseWithRelations(businessId, expense.id);
    });

    return apiResponse(paidExpense, "Expense paid successfully");
  }

  async cancel(businessId: string, expenseId: string) {
    const expense = await this.getExpenseOrThrow(businessId, expenseId);

    if (expense.status !== FinanceExpenseStatus.DRAFT) {
      throw new BadRequestException("Only draft expenses can be cancelled");
    }

    await this.db
      .update(financeExpense)
      .set({
        status: FinanceExpenseStatus.CANCELLED,
      })
      .where(eq(financeExpense.id, expense.id));

    const cancelledExpense = await this.findExpenseWithRelations(
      businessId,
      expense.id,
      true,
    );

    return apiResponse(cancelledExpense, "Expense cancelled successfully");
  }

  async delete(
    currentUser: CurrentUserPayload,
    businessId: string,
    expenseId: string,
  ) {
    const expense = await this.getExpenseOrThrow(businessId, expenseId);

    await this.db
      .update(financeExpense)
      .set({
        deletedAt: new Date(),
        deletedBy: currentUser.id,
      })
      .where(eq(financeExpense.id, expense.id));

    return apiResponse(null, "Expense deleted successfully");
  }

  private buildExpenseWhere(businessId: string, query: QueryExpenseDto) {
    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);

    return and(
      eq(financeExpense.businessId, businessId),
      isNull(financeExpense.deletedAt),
      query.status ? eq(financeExpense.status, query.status) : undefined,
      query.accountId
        ? eq(financeExpense.accountId, query.accountId)
        : undefined,
      query.expenseCategoryId
        ? eq(financeExpense.expenseCategoryId, query.expenseCategoryId)
        : undefined,
      search
        ? or(
            searchUuid ? eq(financeExpense.id, searchUuid) : undefined,
            searchUuid ? eq(financeExpense.accountId, searchUuid) : undefined,
            searchUuid
              ? eq(financeExpense.expenseCategoryId, searchUuid)
              : undefined,
            ilike(financeExpense.expenseNo, `%${search}%`),
            ilike(financeExpense.title, `%${search}%`),
            ilike(financeExpense.referenceNo, `%${search}%`),
            ilike(financeExpense.note, `%${search}%`),
            exists(
              this.db
                .select({ id: financeAccount.id })
                .from(financeAccount)
                .where(
                  and(
                    eq(financeAccount.id, financeExpense.accountId),
                    eq(financeAccount.businessId, businessId),
                    isNull(financeAccount.deletedAt),
                    or(
                      ilike(financeAccount.name, `%${search}%`),
                      ilike(financeAccount.accountNumber, `%${search}%`),
                    ),
                  ),
                ),
            ),
            exists(
              this.db
                .select({ id: financeExpenseCategory.id })
                .from(financeExpenseCategory)
                .where(
                  and(
                    eq(
                      financeExpenseCategory.id,
                      financeExpense.expenseCategoryId,
                    ),
                    eq(financeExpenseCategory.businessId, businessId),
                    isNull(financeExpenseCategory.deletedAt),
                    ilike(financeExpenseCategory.name, `%${search}%`),
                  ),
                ),
            ),
          )
        : undefined,
    );
  }

  private async selectExpensesWithRelations(
    where: ReturnType<typeof this.buildExpenseWhere>,
    limit?: number,
    offset?: number,
  ) {
    const rows = await this.db
      .select({
        expense: financeExpense,
        account: financeAccount,
        category: financeExpenseCategory,
      })
      .from(financeExpense)
      .leftJoin(financeAccount, eq(financeAccount.id, financeExpense.accountId))
      .leftJoin(
        financeExpenseCategory,
        eq(financeExpenseCategory.id, financeExpense.expenseCategoryId),
      )
      .where(where)
      .orderBy(desc(financeExpense.createdAt))
      .limit(limit ?? 10)
      .offset(offset ?? 0);

    return rows.map(({ expense, account, category }) => ({
      ...expense,
      account,
      category,
    }));
  }

  private async findExpenseWithRelations(
    businessId: string,
    expenseId: string,
    includeDeleted = false,
  ) {
    const [row] = await this.db
      .select({
        expense: financeExpense,
        account: financeAccount,
        category: financeExpenseCategory,
      })
      .from(financeExpense)
      .leftJoin(financeAccount, eq(financeAccount.id, financeExpense.accountId))
      .leftJoin(
        financeExpenseCategory,
        eq(financeExpenseCategory.id, financeExpense.expenseCategoryId),
      )
      .where(
        and(
          eq(financeExpense.id, expenseId),
          eq(financeExpense.businessId, businessId),
          includeDeleted ? undefined : isNull(financeExpense.deletedAt),
        ),
      );

    return row
      ? {
          ...row.expense,
          account: row.account,
          category: row.category,
        }
      : null;
  }

  private async getExpenseOrThrow(businessId: string, expenseId: string) {
    const [expense] = await this.db
      .select()
      .from(financeExpense)
      .where(
        and(
          eq(financeExpense.id, expenseId),
          eq(financeExpense.businessId, businessId),
          isNull(financeExpense.deletedAt),
        ),
      );

    if (!expense) {
      throw new NotFoundException(
        "Expense could not be found. It may not exist, may have been deleted, or may not belong to the current business.",
      );
    }

    return expense;
  }

  private async assertActiveAccount(businessId: string, accountId: string) {
    const [account] = await this.db
      .select({ id: financeAccount.id })
      .from(financeAccount)
      .where(
        and(
          eq(financeAccount.id, accountId),
          eq(financeAccount.businessId, businessId),
          isNull(financeAccount.deletedAt),
          eq(financeAccount.status, FinanceAccountStatus.ACTIVE),
        ),
      );

    if (!account) {
      throw new NotFoundException(
        "Finance account could not be found. It may not exist, may have been deleted, or may not belong to the current business.",
      );
    }
  }

  private async assertActiveCategory(businessId: string, categoryId: string) {
    const [category] = await this.db
      .select({ id: financeExpenseCategory.id })
      .from(financeExpenseCategory)
      .where(
        and(
          eq(financeExpenseCategory.id, categoryId),
          eq(financeExpenseCategory.businessId, businessId),
          isNull(financeExpenseCategory.deletedAt),
          eq(
            financeExpenseCategory.status,
            FinanceExpenseCategoryStatus.ACTIVE,
          ),
        ),
      );

    if (!category) {
      throw new NotFoundException(
        "Expense category could not be found. It may not exist, may have been deleted, or may not belong to the current business.",
      );
    }
  }

  private normalizeName(value: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException("Expense title is required");
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
}
