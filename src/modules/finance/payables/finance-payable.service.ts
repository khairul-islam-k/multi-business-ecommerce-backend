import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type FinancePayable,
  FinancePayableStatus,
  FinanceSourceType,
  SupplierInvoiceStatus,
  financePayable,
  supplierInvoice,
  supplierPayment,
} from "@/database/schema";
import Decimal from "decimal.js";
import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import {
  PayFinancePayableDto,
  QueryFinancePayableDto,
} from "./dto/finance-payable.dto";
import {
  DatabaseService,
  type DatabaseTransaction,
} from "../../../database/database.service";
import { FinanceLedgerService } from "../common/finance-ledger.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";

@Injectable()
export class FinancePayableService {
  constructor(
    private readonly database: DatabaseService,
    private readonly ledger: FinanceLedgerService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async findAll(businessId: string, query: QueryFinancePayableDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(financePayable.businessId, businessId),
      query.partyType ? eq(financePayable.partyType, query.partyType) : undefined,
      query.sourceType
        ? eq(financePayable.sourceType, query.sourceType)
        : undefined,
      query.status ? eq(financePayable.status, query.status) : undefined,
      query.search
        ? or(
            ilike(financePayable.payableNo, `%${query.search}%`),
            ilike(financePayable.note, `%${query.search}%`),
          )
        : undefined,
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(financePayable)
        .where(where)
        .orderBy(desc(financePayable.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(financePayable)
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

  async findOne(businessId: string, payableId: string) {
    const payable = await this.getPayableOrThrow(businessId, payableId);

    return apiResponse(payable);
  }

  async pay(
    currentUser: CurrentUserPayload,
    businessId: string,
    payableId: string,
    dto: PayFinancePayableDto,
  ) {
    const payable = await this.getPayableOrThrow(businessId, payableId);

    if (payable.status === FinancePayableStatus.CANCELLED) {
      throw new BadRequestException("Cancelled payable cannot be paid");
    }

    const dueAmount = new Decimal(payable.totalAmount).minus(
      payable.paidAmount,
    );

    if (dueAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Finance payable is already paid");
    }

    const paymentAmount =
      dto.amount !== undefined ? new Decimal(dto.amount) : dueAmount;

    if (paymentAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Payment amount must be greater than 0");
    }

    if (paymentAmount.greaterThan(dueAmount)) {
      throw new BadRequestException("Payment cannot exceed payable due amount");
    }

    const updatedPayable = await this.db.transaction(async (tx) => {
      let referenceType = payable.sourceType;
      let referenceId = payable.sourceId ?? undefined;

      if (payable.sourceType === FinanceSourceType.SUPPLIER_INVOICE) {
        const supplierPayment = await this.paySupplierInvoicePayable(tx, {
          businessId,
          payable,
          paymentAmount,
          dto,
          currentUserId: currentUser.id,
        });

        referenceType = FinanceSourceType.SUPPLIER_PAYMENT;
        referenceId = supplierPayment.id;
      }

      await this.ledger.debitAccount(tx, {
        businessId,
        accountId: dto.financeAccountId,
        amount: paymentAmount,
        referenceType,
        referenceId,
        note: dto.note,
        createdBy: currentUser.id,
      });

      const paidAmount = new Decimal(payable.paidAmount).plus(paymentAmount);
      const status = paidAmount.greaterThanOrEqualTo(payable.totalAmount)
        ? FinancePayableStatus.PAID
        : FinancePayableStatus.PARTIALLY_PAID;

      const [updated] = await tx
        .update(financePayable)
        .set({
          paidAmount,
          status,
          note: this.normalizeNullableText(dto.note) ?? payable.note,
        })
        .where(eq(financePayable.id, payable.id))
        .returning();

      return updated;
    });

    return apiResponse(updatedPayable, "Finance payable paid");
  }

  private async paySupplierInvoicePayable(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      payable: FinancePayable;
      paymentAmount: Decimal;
      dto: PayFinancePayableDto;
      currentUserId: string;
    },
  ) {
    if (!params.dto.paymentMethod) {
      throw new BadRequestException(
        "Payment method is required for supplier invoice payable",
      );
    }

    if (!params.payable.sourceId) {
      throw new BadRequestException("Supplier invoice payable has no source");
    }

    const [invoice] = await tx
      .select()
      .from(supplierInvoice)
      .where(
        and(
          eq(supplierInvoice.id, params.payable.sourceId),
          eq(supplierInvoice.businessId, params.businessId),
          isNull(supplierInvoice.deletedAt),
        ),
      );

    if (!invoice) {
      throw new NotFoundException("Supplier invoice not found");
    }

    if (invoice.status === SupplierInvoiceStatus.CANCELLED) {
      throw new BadRequestException(
        "Cancelled supplier invoice cannot be paid",
      );
    }

    const [payment] = await tx
      .insert(supplierPayment)
      .values({
        businessId: params.businessId,
        supplierId: invoice.supplierId,
        supplierInvoiceId: invoice.id,
        paymentNo: await this.ledger.generateUniqueSupplierPaymentNo(
          params.businessId,
        ),
        amount: params.paymentAmount,
        paymentDate: new Date(),
        paymentMethod: params.dto.paymentMethod,
        note: this.normalizeNullableText(params.dto.note),
        createdBy: params.currentUserId,
      })
      .returning();

    const paidAmount = new Decimal(params.payable.paidAmount).plus(
      params.paymentAmount,
    );
    const status = paidAmount.greaterThanOrEqualTo(invoice.totalAmount)
      ? SupplierInvoiceStatus.PAID
      : SupplierInvoiceStatus.PARTIALLY_PAID;

    await tx
      .update(supplierInvoice)
      .set({
        paidAmount,
        status,
      })
      .where(eq(supplierInvoice.id, invoice.id));

    return payment;
  }

  private async getPayableOrThrow(businessId: string, payableId: string) {
    const [payable] = await this.db
      .select()
      .from(financePayable)
      .where(
        and(
          eq(financePayable.id, payableId),
          eq(financePayable.businessId, businessId),
        ),
      );

    if (!payable) {
      throw new NotFoundException("Finance payable not found");
    }

    return payable;
  }

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }
}
