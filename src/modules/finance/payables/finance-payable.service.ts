import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FinancePayableStatus,
  FinanceSourceType,
  Prisma,
  SupplierInvoiceStatus,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { FinanceLedgerService } from "../common/finance-ledger.service";
import {
  PayFinancePayableDto,
  QueryFinancePayableDto,
} from "./dto/finance-payable.dto";

@Injectable()
export class FinancePayableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: FinanceLedgerService,
  ) {}

  async findAll(businessId: string, query: QueryFinancePayableDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.FinancePayableWhereInput = {
      businessId,
      ...(query.partyType ? { partyType: query.partyType } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                payableNo: {
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
      this.prisma.financePayable.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.financePayable.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, payableId: string) {
    const payable = await this.prisma.financePayable.findFirst({
      where: { id: payableId, businessId },
    });

    if (!payable) {
      throw new NotFoundException("Finance payable not found");
    }

    return apiResponse(payable);
  }

  async pay(
    currentUser: CurrentUserPayload,
    businessId: string,
    payableId: string,
    dto: PayFinancePayableDto,
  ) {
    const payable = await this.prisma.financePayable.findFirst({
      where: { id: payableId, businessId },
    });

    if (!payable) {
      throw new NotFoundException("Finance payable not found");
    }

    if (payable.status === FinancePayableStatus.CANCELLED) {
      throw new BadRequestException("Cancelled payable cannot be paid");
    }

    const dueAmount = new Prisma.Decimal(payable.totalAmount).minus(
      payable.paidAmount,
    );

    if (dueAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Finance payable is already paid");
    }

    const paymentAmount =
      dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : dueAmount;

    if (paymentAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Payment amount must be greater than 0");
    }

    if (paymentAmount.greaterThan(dueAmount)) {
      throw new BadRequestException("Payment cannot exceed payable due amount");
    }

    const updatedPayable = await this.prisma.$transaction(async (tx) => {
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

      const paidAmount = new Prisma.Decimal(payable.paidAmount).plus(
        paymentAmount,
      );
      const status = paidAmount.greaterThanOrEqualTo(payable.totalAmount)
        ? FinancePayableStatus.PAID
        : FinancePayableStatus.PARTIALLY_PAID;

      return tx.financePayable.update({
        where: { id: payable.id },
        data: {
          paidAmount,
          status,
          note: this.normalizeNullableText(dto.note) ?? payable.note,
        },
      });
    });

    return apiResponse(updatedPayable, "Finance payable paid");
  }

  private async paySupplierInvoicePayable(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      payable: Prisma.FinancePayableGetPayload<object>;
      paymentAmount: Prisma.Decimal;
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

    const invoice = await tx.supplierInvoice.findFirst({
      where: {
        id: params.payable.sourceId,
        businessId: params.businessId,
        deletedAt: null,
      },
    });

    if (!invoice) {
      throw new NotFoundException("Supplier invoice not found");
    }

    if (invoice.status === SupplierInvoiceStatus.CANCELLED) {
      throw new BadRequestException(
        "Cancelled supplier invoice cannot be paid",
      );
    }

    const payment = await tx.supplierPayment.create({
      data: {
        businessId: params.businessId,
        supplierId: invoice.supplierId,
        supplierInvoiceId: invoice.id,
        paymentNo: await this.ledger.generateUniqueSupplierPaymentNo(
          params.businessId,
        ),
        amount: params.paymentAmount,
        paymentDate: new Date(),
        paymentMethod: params.dto.paymentMethod,
        referenceNo: this.normalizeNullableText(params.dto.referenceNo),
        note: this.normalizeNullableText(params.dto.note),
        createdBy: params.currentUserId,
      },
    });

    const paidAmount = new Prisma.Decimal(params.payable.paidAmount).plus(
      params.paymentAmount,
    );
    const status = paidAmount.greaterThanOrEqualTo(invoice.totalAmount)
      ? SupplierInvoiceStatus.PAID
      : SupplierInvoiceStatus.PARTIALLY_PAID;

    await tx.supplierInvoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount,
        status,
      },
    });

    return payment;
  }

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }
}
