import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FinanceReceivableStatus,
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
  QueryFinanceReceivableDto,
  ReceiveFinanceReceivableDto,
} from "./dto/finance-receivable.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@Injectable()
export class FinanceReceivableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: FinanceLedgerService,
  ) {}

  async findAll(businessId: string, query: QueryFinanceReceivableDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.FinanceReceivableWhereInput = {
      businessId,
      ...(query.partyType ? { partyType: query.partyType } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                receivableNo: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              { note: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.financeReceivable.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.financeReceivable.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, receivableId: string) {
    const receivable = await this.prisma.financeReceivable.findFirst({
      where: { id: receivableId, businessId },
    });

    if (!receivable) {
      throw new NotFoundException("Finance receivable not found");
    }

    return apiResponse(receivable);
  }

  async receive(
    currentUser: CurrentUserPayload,
    businessId: string,
    receivableId: string,
    dto: ReceiveFinanceReceivableDto,
  ) {
    const receivable = await this.prisma.financeReceivable.findFirst({
      where: { id: receivableId, businessId },
    });

    if (!receivable) {
      throw new NotFoundException("Finance receivable not found");
    }

    if (receivable.status === FinanceReceivableStatus.CANCELLED) {
      throw new BadRequestException("Cancelled receivable cannot be received");
    }

    if (receivable.sourceType === FinanceSourceType.ORDER) {
      throw new BadRequestException("Order receivable must be paid from order");
    }

    if (receivable.sourceType === FinanceSourceType.COURIER_RECEIVABLE) {
      throw new BadRequestException(
        "Courier receivable must be settled from courier module",
      );
    }

    const dueAmount = new Prisma.Decimal(receivable.totalAmount).minus(
      receivable.receivedAmount,
    );

    if (dueAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Finance receivable is already received");
    }

    const receiveAmount =
      dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : dueAmount;

    if (receiveAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Receive amount must be greater than 0");
    }

    if (receiveAmount.greaterThan(dueAmount)) {
      throw new BadRequestException(
        "Receive amount cannot exceed receivable due amount",
      );
    }

    const updatedReceivable = await this.prisma.$transaction(async (tx) => {
      await this.ledger.creditAccount(tx, {
        businessId,
        accountId: dto.financeAccountId,
        amount: receiveAmount,
        referenceType: receivable.sourceType ?? FinanceSourceType.MANUAL,
        referenceId: receivable.sourceId ?? undefined,
        note: dto.note,
        createdBy: currentUser.id,
      });

      const receivedAmount = new Prisma.Decimal(receivable.receivedAmount).plus(
        receiveAmount,
      );
      const status = receivedAmount.greaterThanOrEqualTo(receivable.totalAmount)
        ? FinanceReceivableStatus.RECEIVED
        : FinanceReceivableStatus.PARTIALLY_RECEIVED;

      return tx.financeReceivable.update({
        where: { id: receivable.id },
        data: {
          receivedAmount,
          status,
          note: this.normalizeNullableText(dto.note) ?? receivable.note,
        },
      });
    });

    return apiResponse(updatedReceivable, "Finance receivable received");
  }

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }
}
