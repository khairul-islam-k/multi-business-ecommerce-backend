import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FinanceAccountStatus,
  FinanceSourceType,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { FinanceLedgerService } from "../common/finance-ledger.service";
import {
  CreateFinanceAccountDto,
  QueryFinanceAccountDto,
  QueryFinanceTransactionDto,
  UpdateFinanceAccountDto,
} from "./dto/finance-account.dto";

const ACCOUNT_INCLUDE = {
  _count: {
    select: {
      transactions: true,
      expenses: true,
      orderPayments: true,
    },
  },
} satisfies Prisma.FinanceAccountInclude;

@Injectable()
export class FinanceAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: FinanceLedgerService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateFinanceAccountDto,
  ) {
    const openingBalance = new Prisma.Decimal(dto.openingBalance ?? 0);

    try {
      const account = await this.prisma.$transaction(async (tx) => {
        const createdAccount = await tx.financeAccount.create({
          data: {
            businessId,
            name: this.normalizeName(dto.name),
            accountType: dto.accountType,
            accountNumber: this.normalizeNullableText(dto.accountNumber),
            currencyCode: dto.currencyCode?.trim().toUpperCase() || "BDT",
            openingBalance,
            currentBalance: 0,
            status: dto.status ?? FinanceAccountStatus.ACTIVE,
            createdBy: currentUser.id,
            updatedBy: currentUser.id,
          },
          include: ACCOUNT_INCLUDE,
        });

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

        return tx.financeAccount.findFirst({
          where: { id: createdAccount.id, businessId },
          include: ACCOUNT_INCLUDE,
        });
      });

      return apiResponse(account, "Finance account created successfully");
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(businessId: string, query: QueryFinanceAccountDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.FinanceAccountWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.accountType ? { accountType: query.accountType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              {
                accountNumber: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.financeAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: ACCOUNT_INCLUDE,
      }),
      this.prisma.financeAccount.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, accountId: string) {
    const account = await this.prisma.financeAccount.findFirst({
      where: { id: accountId, businessId, deletedAt: null },
      include: ACCOUNT_INCLUDE,
    });

    if (!account) {
      throw new NotFoundException("Finance account not found");
    }

    return apiResponse(account);
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
      const account = await this.prisma.financeAccount.update({
        where: { id: accountId },
        data: {
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
          ...(dto.currentBalance !== undefined && {
            currentBalance:   dto.currentBalance
          })
        },
        include: ACCOUNT_INCLUDE,
      });

      return apiResponse(account, "Finance account updated successfully");
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    accountId: string,
  ) {
    const account = await this.assertAccountExists(businessId, accountId);

    if (new Prisma.Decimal(account.currentBalance).greaterThan(0)) {
      throw new BadRequestException(
        "Finance account cannot be deleted while it has a balance",
      );
    }

    await this.prisma.financeAccount.update({
      where: { id: accountId },
      data: {
        status: FinanceAccountStatus.INACTIVE,
        deletedAt: new Date(),
        updatedBy: currentUser.id,
      },
    });

    return apiResponse(null, "Finance account deleted successfully");
  }

  async findTransactions(
    businessId: string,
    accountId: string,
    query: QueryFinanceTransactionDto,
  ) {
    await this.assertAccountExists(businessId, accountId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.FinanceAccountTransactionWhereInput = {
      businessId,
      accountId,
    };

    const [items, total] = await Promise.all([
      this.prisma.financeAccountTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.financeAccountTransaction.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  private async assertAccountExists(businessId: string, accountId: string) {
    const account = await this.prisma.financeAccount.findFirst({
      where: { id: accountId, businessId, deletedAt: null },
    });

    if (!account) {
      throw new NotFoundException("Finance account not found");
    }

    return account;
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

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("Finance account name already exists");
    }

    throw error;
  }
}
