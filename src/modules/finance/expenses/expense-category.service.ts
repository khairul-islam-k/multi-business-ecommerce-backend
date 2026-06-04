import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { FinanceExpenseCategoryStatus, Prisma } from "@prisma/client";

import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  CreateExpenseCategoryDto,
  QueryExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from "./dto/finance-expense.dto";

@Injectable()
export class ExpenseCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(businessId: string, dto: CreateExpenseCategoryDto) {
    try {
      const category = await this.prisma.financeExpenseCategory.create({
        data: {
          businessId,
          name: this.normalizeName(dto.name),
          description: this.normalizeNullableText(dto.description),
          status: dto.status ?? FinanceExpenseCategoryStatus.ACTIVE,
        },
      });

      return apiResponse(category, "Expense category created successfully");
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(businessId: string, query: QueryExpenseCategoryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.FinanceExpenseCategoryWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              {
                description: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.financeExpenseCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.financeExpenseCategory.count({ where }),
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
      const category = await this.prisma.financeExpenseCategory.update({
        where: { id: categoryId },
        data: {
          ...(dto.name !== undefined && { name: this.normalizeName(dto.name) }),
          ...(dto.description !== undefined && {
            description: this.normalizeNullableText(dto.description),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
      });

      return apiResponse(category, "Expense category updated successfully");
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(businessId: string, categoryId: string) {
    await this.assertCategoryExists(businessId, categoryId);

    const activeExpenseCount = await this.prisma.financeExpense.count({
      where: {
        businessId,
        expenseCategoryId: categoryId,
        deletedAt: null,
      },
    });

    if (activeExpenseCount > 0) {
      throw new BadRequestException(
        "Expense category cannot be deleted while expenses reference it",
      );
    }

    await this.prisma.financeExpenseCategory.update({
      where: { id: categoryId },
      data: {
        status: FinanceExpenseCategoryStatus.INACTIVE,
        deletedAt: new Date(),
      },
    });

    return apiResponse(null, "Expense category deleted successfully");
  }

  private async assertCategoryExists(businessId: string, categoryId: string) {
    const category = await this.prisma.financeExpenseCategory.findFirst({
      where: { id: categoryId, businessId, deletedAt: null },
      select: { id: true },
    });

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

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("Expense category name already exists");
    }

    throw error;
  }
}
