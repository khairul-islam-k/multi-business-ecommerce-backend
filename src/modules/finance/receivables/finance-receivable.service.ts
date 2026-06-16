import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FinanceReceivableStatus,
  FinanceSourceType,
  financeReceivable,
} from "@/database/schema";
import Decimal from "decimal.js";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import {
  QueryFinanceReceivableDto,
  ReceiveFinanceReceivableDto,
} from "./dto/finance-receivable.dto";
import { DatabaseService } from "../../../database/database.service";
import { FinanceLedgerService } from "../common/finance-ledger.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";

@Injectable()
export class FinanceReceivableService {
  constructor(
    private readonly database: DatabaseService,
    private readonly ledger: FinanceLedgerService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async findAll(businessId: string, query: QueryFinanceReceivableDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(financeReceivable.businessId, businessId),
      query.partyType
        ? eq(financeReceivable.partyType, query.partyType)
        : undefined,
      query.sourceType
        ? eq(financeReceivable.sourceType, query.sourceType)
        : undefined,
      query.status ? eq(financeReceivable.status, query.status) : undefined,
      query.search
        ? or(
            ilike(financeReceivable.receivableNo, `%${query.search}%`),
            ilike(financeReceivable.note, `%${query.search}%`),
          )
        : undefined,
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(financeReceivable)
        .where(where)
        .orderBy(desc(financeReceivable.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(financeReceivable)
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

  async findOne(businessId: string, receivableId: string) {
    const receivable = await this.getReceivableOrThrow(
      businessId,
      receivableId,
    );

    return apiResponse(receivable);
  }

  async receive(
    currentUser: CurrentUserPayload,
    businessId: string,
    receivableId: string,
    dto: ReceiveFinanceReceivableDto,
  ) {
    const receivable = await this.getReceivableOrThrow(
      businessId,
      receivableId,
    );

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

    const dueAmount = new Decimal(receivable.totalAmount).minus(
      receivable.receivedAmount,
    );

    if (dueAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Finance receivable is already received");
    }

    const receiveAmount =
      dto.amount !== undefined ? new Decimal(dto.amount) : dueAmount;

    if (receiveAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Receive amount must be greater than 0");
    }

    if (receiveAmount.greaterThan(dueAmount)) {
      throw new BadRequestException(
        "Receive amount cannot exceed receivable due amount",
      );
    }

    const updatedReceivable = await this.db.transaction(async (tx) => {
      await this.ledger.creditAccount(tx, {
        businessId,
        accountId: dto.financeAccountId,
        amount: receiveAmount,
        referenceType: receivable.sourceType ?? FinanceSourceType.MANUAL,
        referenceId: receivable.sourceId ?? undefined,
        note: dto.note,
        createdBy: currentUser.id,
      });

      const receivedAmount = new Decimal(receivable.receivedAmount).plus(
        receiveAmount,
      );
      const status = receivedAmount.greaterThanOrEqualTo(receivable.totalAmount)
        ? FinanceReceivableStatus.RECEIVED
        : FinanceReceivableStatus.PARTIALLY_RECEIVED;

      const [updated] = await tx
        .update(financeReceivable)
        .set({
          receivedAmount,
          status,
          note: this.normalizeNullableText(dto.note) ?? receivable.note,
        })
        .where(eq(financeReceivable.id, receivable.id))
        .returning();

      return updated;
    });

    return apiResponse(updatedReceivable, "Finance receivable received");
  }

  private async getReceivableOrThrow(
    businessId: string,
    receivableId: string,
  ) {
    const [receivable] = await this.db
      .select()
      .from(financeReceivable)
      .where(
        and(
          eq(financeReceivable.id, receivableId),
          eq(financeReceivable.businessId, businessId),
        ),
      );

    if (!receivable) {
      throw new NotFoundException("Finance receivable not found");
    }

    return receivable;
  }

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }
}
