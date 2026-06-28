import { isUUID } from "class-validator";
import Decimal from "decimal.js";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";

import {
  financeReceivable,
  FinanceReceivableStatus,
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
import { DatabaseService } from "../../../database/database.service";
import { FinanceLedgerService } from "../common/finance-ledger.service";
import {
  QueryFinanceReceivableDto,
  ReceiveFinanceReceivableDto,
} from "./dto/finance-receivable.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

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
    const search = query.search?.trim();
    const searchUuid = search && isUUID(search) ? search : undefined;
    const where = and(
      eq(financeReceivable.businessId, businessId),
      query.partyType
        ? eq(financeReceivable.partyType, query.partyType)
        : undefined,
      query.partyId ? eq(financeReceivable.partyId, query.partyId) : undefined,
      query.sourceType
        ? eq(financeReceivable.sourceType, query.sourceType)
        : undefined,
      query.sourceId
        ? eq(financeReceivable.sourceId, query.sourceId)
        : undefined,
      query.status ? eq(financeReceivable.status, query.status) : undefined,
      search
        ? or(
            ilike(financeReceivable.receivableNo, `%${search}%`),
            ilike(financeReceivable.note, `%${search}%`),
            searchUuid ? eq(financeReceivable.id, searchUuid) : undefined,
            searchUuid ? eq(financeReceivable.partyId, searchUuid) : undefined,
            searchUuid ? eq(financeReceivable.sourceId, searchUuid) : undefined,
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

    return paginatedResponse(
      items,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Receivables were loaded successfully. The response includes the requested page of receivable records for this business and pagination metadata for browsing more results.",
    );
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
      throw new BadRequestException(
        "This receivable cannot be received because it has been cancelled. Cancelled receivables are locked so the financial record does not change after cancellation.",
      );
    }

    if (receivable.sourceType === FinanceSourceType.ORDER) {
      throw new BadRequestException(
        "This receivable came from an order, so payment must be recorded from the order payment flow. Use the order payment action so the order, invoice, and receivable stay in sync.",
      );
    }

    if (receivable.sourceType === FinanceSourceType.COURIER_RECEIVABLE) {
      throw new BadRequestException(
        "This receivable came from a courier collection, so it must be settled from the courier module. Use the courier settlement flow so courier balances stay correct.",
      );
    }

    const dueAmount = new Decimal(receivable.totalAmount).minus(
      receivable.receivedAmount,
    );

    if (dueAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        "This receivable is already fully received. There is no remaining due amount to record another receipt against.",
      );
    }

    const receiveAmount =
      dto.amount !== undefined ? new Decimal(dto.amount) : dueAmount;

    if (receiveAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        "Receive amount must be greater than 0. Enter a positive amount, or leave the amount empty to receive the remaining balance.",
      );
    }

    if (receiveAmount.greaterThan(dueAmount)) {
      throw new BadRequestException(
        `Receive amount cannot exceed the receivable due amount. The remaining receivable balance is ${dueAmount.toString()}, but the requested receipt is ${receiveAmount.toString()}.`,
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

    return apiResponse(
      updatedReceivable,
      "Receivable receipt recorded successfully. The receivable balance and status were updated, and the selected finance account was credited.",
    );
  }

  private async getReceivableOrThrow(businessId: string, receivableId: string) {
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
      throw new NotFoundException(
        "Finance receivable not found. It may have been deleted, or it may belong to a different business.",
      );
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
