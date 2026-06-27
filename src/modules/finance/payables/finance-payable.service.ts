import { isUUID } from "class-validator";
import Decimal from "decimal.js";
import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

import {
  FinancePayable,
  financePayable,
  FinancePayableStatus,
  FinanceSourceType,
  supplierInvoice,
  SupplierInvoiceStatus,
  supplierPayment,
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
  DatabaseService,
  DatabaseTransaction,
} from "../../../database/database.service";
import { FinanceLedgerService } from "../common/finance-ledger.service";
import {
  PayFinancePayableDto,
  QueryFinancePayableDto,
} from "./dto/finance-payable.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

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
    const search = query.search?.trim();
    const searchUuid = search && isUUID(search) ? search : undefined;
    const where = and(
      eq(financePayable.businessId, businessId),
      query.partyType
        ? eq(financePayable.partyType, query.partyType)
        : undefined,
      query.partyId ? eq(financePayable.partyId, query.partyId) : undefined,
      query.sourceType
        ? eq(financePayable.sourceType, query.sourceType)
        : undefined,
      query.sourceId ? eq(financePayable.sourceId, query.sourceId) : undefined,
      query.status ? eq(financePayable.status, query.status) : undefined,
      search
        ? or(
            ilike(financePayable.payableNo, `%${search}%`),
            ilike(financePayable.note, `%${search}%`),
            searchUuid ? eq(financePayable.id, searchUuid) : undefined,
            searchUuid ? eq(financePayable.partyId, searchUuid) : undefined,
            searchUuid ? eq(financePayable.sourceId, searchUuid) : undefined,
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
      throw new BadRequestException(
        "This payable cannot be paid because it has been cancelled. Cancelled payables are locked so the financial record does not change after cancellation.",
      );
    }

    const dueAmount = new Decimal(payable.totalAmount).minus(
      payable.paidAmount,
    );

    if (dueAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        "This payable is already fully paid. There is no remaining due amount to record another payment against.",
      );
    }

    const paymentAmount =
      dto.amount !== undefined ? new Decimal(dto.amount) : dueAmount;

    if (paymentAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        "Payment amount must be greater than 0. Enter a positive amount, or leave the amount empty to pay the remaining balance.",
      );
    }

    if (paymentAmount.greaterThan(dueAmount)) {
      throw new BadRequestException(
        `Payment cannot exceed the payable due amount. The remaining payable balance is ${dueAmount.toString()}, but the requested payment is ${paymentAmount.toString()}.`,
      );
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

    return apiResponse(
      updatedPayable,
      "Payable payment recorded successfully. The payable balance and status were updated, and the selected finance account was debited.",
    );
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
        "Payment method is required because this payable came from a supplier invoice. Choose how the supplier was paid before recording the payment.",
      );
    }

    if (!params.payable.sourceId) {
      throw new BadRequestException(
        "This supplier invoice payable cannot be paid because it is missing the linked supplier invoice ID. Please review the payable record before trying again.",
      );
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
      throw new NotFoundException(
        "The supplier invoice linked to this payable could not be found. It may have been deleted or may belong to another business.",
      );
    }

    if (invoice.status === SupplierInvoiceStatus.CANCELLED) {
      throw new BadRequestException(
        "This supplier invoice cannot be paid because the invoice has been cancelled. Reopen or recreate the invoice before paying it.",
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
      throw new NotFoundException(
        "Finance payable not found. It may have been deleted, or it may belong to a different business.",
      );
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
