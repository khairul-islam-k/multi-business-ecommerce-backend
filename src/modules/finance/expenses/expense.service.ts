import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FinanceAccountStatus,
  FinanceExpenseCategoryStatus,
  FinanceExpenseStatus,
  FinanceSourceType,
  Prisma,
} from "@prisma/client";

import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import { PrismaService } from "../../../prisma/prisma.service";
import { FinanceLedgerService } from "../common/finance-ledger.service";
import {
  CreateExpenseDto,
  QueryExpenseDto,
  UpdateExpenseDto,
} from "./dto/finance-expense.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

const EXPENSE_INCLUDE = {
  account: true,
  category: true,
} satisfies Prisma.FinanceExpenseInclude;

@Injectable()
export class ExpenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: FinanceLedgerService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateExpenseDto,
  ) {
    await Promise.all([
      this.assertActiveAccount(businessId, dto.accountId),
      this.assertActiveCategory(businessId, dto.expenseCategoryId),
    ]);

    const expense = await this.prisma.financeExpense.create({
      data: {
        businessId,
        accountId: dto.accountId,
        expenseCategoryId: dto.expenseCategoryId,
        expenseNo: await this.ledger.generateUniqueExpenseNo(businessId),
        title: this.normalizeName(dto.title),
        amount: dto.amount,
        expenseDate: dto.expenseDate,
        status: FinanceExpenseStatus.DRAFT,
        note: this.normalizeNullableText(dto.note),
        createdBy: currentUser.id,
      },
      include: EXPENSE_INCLUDE,
    });

    return apiResponse(expense, "Expense created successfully");
  }

  async findAll(businessId: string, query: QueryExpenseDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.FinanceExpenseWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.expenseCategoryId
        ? { expenseCategoryId: query.expenseCategoryId }
        : {}),
      ...(query.search
        ? {
            OR: [
              { expenseNo: { contains: query.search, mode: "insensitive" } },
              { title: { contains: query.search, mode: "insensitive" } },
              { referenceNo: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.financeExpense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: EXPENSE_INCLUDE,
      }),
      this.prisma.financeExpense.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, expenseId: string) {
    const expense = await this.prisma.financeExpense.findFirst({
      where: { id: expenseId, businessId, deletedAt: null },
      include: EXPENSE_INCLUDE,
    });

    if (!expense) {
      throw new NotFoundException("Expense not found");
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

    const expense = await this.prisma.financeExpense.update({
      where: { id: expenseId },
      data: {
        ...(dto.accountId !== undefined && { accountId: dto.accountId }),
        ...(dto.expenseCategoryId !== undefined && {
          expenseCategoryId: dto.expenseCategoryId,
        }),
        ...(dto.title !== undefined && {
          title: this.normalizeName(dto.title),
        }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.expenseDate !== undefined && {
          expenseDate: dto.expenseDate,
        }),
        ...(dto.note !== undefined && {
          note: this.normalizeNullableText(dto.note),
        }),
      },
      include: EXPENSE_INCLUDE,
    });

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

    const paidExpense = await this.prisma.$transaction(async (tx) => {
      await this.ledger.debitAccount(tx, {
        businessId,
        accountId: expense.accountId,
        amount: expense.amount,
        referenceType: FinanceSourceType.EXPENSE,
        referenceId: expense.id,
        note: expense.title,
        createdBy: currentUser.id,
      });

      return tx.financeExpense.update({
        where: { id: expense.id },
        data: {
          status: FinanceExpenseStatus.PAID,
        },
        include: EXPENSE_INCLUDE,
      });
    });

    return apiResponse(paidExpense, "Expense paid successfully");
  }

  async cancel(businessId: string, expenseId: string) {
    const expense = await this.getExpenseOrThrow(businessId, expenseId);

    if (expense.status !== FinanceExpenseStatus.DRAFT) {
      throw new BadRequestException("Only draft expenses can be cancelled");
    }

    const cancelledExpense = await this.prisma.financeExpense.update({
      where: { id: expense.id },
      data: {
        status: FinanceExpenseStatus.CANCELLED,
        deletedAt: new Date(),
      },
      include: EXPENSE_INCLUDE,
    });

    return apiResponse(cancelledExpense, "Expense cancelled successfully");
  }

  private async getExpenseOrThrow(businessId: string, expenseId: string) {
    const expense = await this.prisma.financeExpense.findFirst({
      where: { id: expenseId, businessId, deletedAt: null },
    });

    if (!expense) {
      throw new NotFoundException("Expense not found");
    }

    return expense;
  }

  private async assertActiveAccount(businessId: string, accountId: string) {
    const account = await this.prisma.financeAccount.findFirst({
      where: {
        id: accountId,
        businessId,
        deletedAt: null,
        status: FinanceAccountStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!account) {
      throw new NotFoundException("Finance account not found");
    }
  }

  private async assertActiveCategory(businessId: string, categoryId: string) {
    const category = await this.prisma.financeExpenseCategory.findFirst({
      where: {
        id: categoryId,
        businessId,
        deletedAt: null,
        status: FinanceExpenseCategoryStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException("Expense category not found");
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
