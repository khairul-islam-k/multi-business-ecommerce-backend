import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FinanceExpenseCategoryStatus,
  financeExpense,
  financeExpenseCategory,
} from "@/database/schema";
import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

import {
  CreateExpenseCategoryDto,
  QueryExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from "./dto/finance-expense.dto";
import { DatabaseService } from "../../../database/database.service";
import { isUniqueConstraintError } from "../../../common/database/db-error.util";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";

@Injectable()
export class ExpenseCategoryService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async create(businessId: string, dto: CreateExpenseCategoryDto) {
    try {
      const [category] = await this.db
        .insert(financeExpenseCategory)
        .values({
          businessId,
          name: this.normalizeName(dto.name),
          description: this.normalizeNullableText(dto.description),
          status: dto.status ?? FinanceExpenseCategoryStatus.ACTIVE,
        })
        .returning();

      return apiResponse(category, "Expense category created successfully");
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findAll(businessId: string, query: QueryExpenseCategoryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(financeExpenseCategory.businessId, businessId),
      isNull(financeExpenseCategory.deletedAt),
      query.status
        ? eq(financeExpenseCategory.status, query.status)
        : undefined,
      query.search
        ? or(
            ilike(financeExpenseCategory.name, `%${query.search}%`),
            ilike(financeExpenseCategory.description, `%${query.search}%`),
          )
        : undefined,
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(financeExpenseCategory)
        .where(where)
        .orderBy(desc(financeExpenseCategory.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(financeExpenseCategory)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async update(
    businessId: string,
    categoryId: string,
    dto: UpdateExpenseCategoryDto,
  ) {
    await this.assertCategoryExists(businessId, categoryId);

    try {
      const [category] = await this.db
        .update(financeExpenseCategory)
        .set({
          ...(dto.name !== undefined && { name: this.normalizeName(dto.name) }),
          ...(dto.description !== undefined && {
            description: this.normalizeNullableText(dto.description),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
        })
        .where(eq(financeExpenseCategory.id, categoryId))
        .returning();

      return apiResponse(category, "Expense category updated successfully");
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async remove(businessId: string, categoryId: string) {
    await this.assertCategoryExists(businessId, categoryId);

    const [{ value: activeExpenseCount }] = await this.db
      .select({ value: count() })
      .from(financeExpense)
      .where(
        and(
          eq(financeExpense.businessId, businessId),
          eq(financeExpense.expenseCategoryId, categoryId),
          isNull(financeExpense.deletedAt),
        ),
      );

    if (activeExpenseCount > 0) {
      throw new BadRequestException(
        "Expense category cannot be deleted while expenses reference it",
      );
    }

    await this.db
      .update(financeExpenseCategory)
      .set({
        status: FinanceExpenseCategoryStatus.INACTIVE,
        deletedAt: new Date(),
      })
      .where(eq(financeExpenseCategory.id, categoryId));

    return apiResponse(null, "Expense category deleted successfully");
  }

  private async assertCategoryExists(businessId: string, categoryId: string) {
    const [category] = await this.db
      .select({ id: financeExpenseCategory.id })
      .from(financeExpenseCategory)
      .where(
        and(
          eq(financeExpenseCategory.id, categoryId),
          eq(financeExpenseCategory.businessId, businessId),
          isNull(financeExpenseCategory.deletedAt),
        ),
      )
      .limit(1);

    if (!category) {
      throw new NotFoundException("Expense category not found");
    }
  }

  private normalizeName(value: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException("Expense category name is required");
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
      throw new ConflictException("Expense category name already exists");
    }

    throw error;
  }
}
