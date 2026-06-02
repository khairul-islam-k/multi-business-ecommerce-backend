import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FinanceAccountStatus,
  FinancePayableStatus,
  FinancePartyType,
  FinanceReceivableStatus,
  FinanceSourceType,
  FinanceTaxStatus,
  FinanceTransactionType,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { generateRandomCode } from "../../../common/utils/code-generator.util";

const FINANCE_CODE_RETRY_LIMIT = 5;

@Injectable()
export class FinanceLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async assertActiveTax(
    client: Prisma.TransactionClient | PrismaService,
    businessId: string,
    taxId: string,
  ) {
    const tax = await client.financeTax.findFirst({
      where: {
        id: taxId,
        businessId,
        deletedAt: null,
        status: FinanceTaxStatus.ACTIVE,
      },
    });

    if (!tax) {
      throw new NotFoundException("Tax not found");
    }

    return tax;
  }

  async creditAccount(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      accountId: string;
      amount: Prisma.Decimal.Value;
      referenceType?: FinanceSourceType;
      referenceId?: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    return this.moveAccountBalance(tx, {
      ...params,
      transactionType: FinanceTransactionType.CREDIT,
    });
  }

  async debitAccount(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      accountId: string;
      amount: Prisma.Decimal.Value;
      referenceType?: FinanceSourceType;
      referenceId?: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    return this.moveAccountBalance(tx, {
      ...params,
      transactionType: FinanceTransactionType.DEBIT,
    });
  }

  async syncOrderReceivable(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      orderId: string;
      customerId?: string | null;
      totalAmount: Prisma.Decimal.Value;
      receivedAmount: Prisma.Decimal.Value;
      note?: string | null;
    },
  ) {
    const totalAmount = new Prisma.Decimal(params.totalAmount);
    const receivedAmount = new Prisma.Decimal(params.receivedAmount);

    if (receivedAmount.greaterThanOrEqualTo(totalAmount)) {
      await tx.financeReceivable.updateMany({
        where: {
          businessId: params.businessId,
          sourceType: FinanceSourceType.ORDER,
          sourceId: params.orderId,
          status: {
            not: FinanceReceivableStatus.CANCELLED,
          },
        },
        data: {
          receivedAmount,
          status: FinanceReceivableStatus.RECEIVED,
        },
      });

      return null;
    }

    const existing = await tx.financeReceivable.findFirst({
      where: {
        businessId: params.businessId,
        sourceType: FinanceSourceType.ORDER,
        sourceId: params.orderId,
        status: {
          not: FinanceReceivableStatus.CANCELLED,
        },
      },
    });

    const status = receivedAmount.isZero()
      ? FinanceReceivableStatus.PENDING
      : FinanceReceivableStatus.PARTIALLY_RECEIVED;

    if (existing) {
      return tx.financeReceivable.update({
        where: { id: existing.id },
        data: {
          partyId: params.customerId ?? null,
          totalAmount,
          receivedAmount,
          status,
          note: this.normalizeNullableText(params.note),
        },
      });
    }

    return tx.financeReceivable.create({
      data: {
        businessId: params.businessId,
        receivableNo: await this.generateUniqueReceivableNo(params.businessId),
        partyType: FinancePartyType.CUSTOMER,
        partyId: params.customerId ?? null,
        sourceType: FinanceSourceType.ORDER,
        sourceId: params.orderId,
        totalAmount,
        receivedAmount,
        status,
        note: this.normalizeNullableText(params.note),
      },
    });
  }

  async createSupplierInvoicePayable(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      supplierId: string;
      supplierInvoiceId: string;
      totalAmount: Prisma.Decimal.Value;
      note?: string | null;
    },
  ) {
    const existing = await tx.financePayable.findFirst({
      where: {
        businessId: params.businessId,
        sourceType: FinanceSourceType.SUPPLIER_INVOICE,
        sourceId: params.supplierInvoiceId,
        status: {
          not: FinancePayableStatus.CANCELLED,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException("Supplier invoice payable already exists");
    }

    return tx.financePayable.create({
      data: {
        businessId: params.businessId,
        payableNo: await this.generateUniquePayableNo(params.businessId),
        partyType: FinancePartyType.SUPPLIER,
        partyId: params.supplierId,
        sourceType: FinanceSourceType.SUPPLIER_INVOICE,
        sourceId: params.supplierInvoiceId,
        totalAmount: params.totalAmount,
        paidAmount: 0,
        status: FinancePayableStatus.PENDING,
        note: this.normalizeNullableText(params.note),
      },
    });
  }

  async createSupplierReturnReceivable(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      supplierId: string;
      supplierReturnId: string;
      totalAmount: Prisma.Decimal.Value;
      note?: string | null;
    },
  ) {
    const existing = await tx.financeReceivable.findFirst({
      where: {
        businessId: params.businessId,
        sourceType: FinanceSourceType.SUPPLIER_RETURN,
        sourceId: params.supplierReturnId,
        status: {
          not: FinanceReceivableStatus.CANCELLED,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException("Supplier return receivable already exists");
    }

    return tx.financeReceivable.create({
      data: {
        businessId: params.businessId,
        receivableNo: await this.generateUniqueReceivableNo(params.businessId),
        partyType: FinancePartyType.SUPPLIER,
        partyId: params.supplierId,
        sourceType: FinanceSourceType.SUPPLIER_RETURN,
        sourceId: params.supplierReturnId,
        totalAmount: params.totalAmount,
        receivedAmount: 0,
        status: FinanceReceivableStatus.PENDING,
        note: this.normalizeNullableText(params.note),
      },
    });
  }

  async syncSupplierInvoicePayablePayment(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      supplierInvoiceId: string;
      paidAmount: Prisma.Decimal.Value;
    },
  ) {
    const payable = await tx.financePayable.findFirst({
      where: {
        businessId: params.businessId,
        sourceType: FinanceSourceType.SUPPLIER_INVOICE,
        sourceId: params.supplierInvoiceId,
        status: {
          not: FinancePayableStatus.CANCELLED,
        },
      },
    });

    if (!payable) {
      throw new NotFoundException("Supplier invoice payable not found");
    }

    const paidAmount = new Prisma.Decimal(params.paidAmount);
    const totalAmount = new Prisma.Decimal(payable.totalAmount);
    const status = paidAmount.greaterThanOrEqualTo(totalAmount)
      ? FinancePayableStatus.PAID
      : paidAmount.isZero()
        ? FinancePayableStatus.PENDING
        : FinancePayableStatus.PARTIALLY_PAID;

    return tx.financePayable.update({
      where: { id: payable.id },
      data: {
        paidAmount,
        status,
      },
    });
  }

  async generateUniqueTransactionNo(businessId: string) {
    return this.generateUniqueCode(businessId, "TXN", (code) =>
      this.prisma.financeAccountTransaction.findFirst({
        where: { businessId, transactionNo: code },
        select: { id: true },
      }),
    );
  }

  async generateUniqueExpenseNo(businessId: string) {
    return this.generateUniqueCode(businessId, "EXP", (code) =>
      this.prisma.financeExpense.findFirst({
        where: { businessId, expenseNo: code },
        select: { id: true },
      }),
    );
  }

  async generateUniqueSupplierInvoiceNo(businessId: string) {
    return this.generateUniqueCode(businessId, "SIN", (code) =>
      this.prisma.supplierInvoice.findFirst({
        where: { businessId, invoiceNo: code },
        select: { id: true },
      }),
    );
  }

  async generateUniqueSupplierPaymentNo(businessId: string) {
    return this.generateUniqueCode(businessId, "SPAY", (code) =>
      this.prisma.supplierPayment.findFirst({
        where: { businessId, paymentNo: code },
        select: { id: true },
      }),
    );
  }

  private async moveAccountBalance(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      accountId: string;
      amount: Prisma.Decimal.Value;
      transactionType: FinanceTransactionType;
      referenceType?: FinanceSourceType;
      referenceId?: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    const amount = new Prisma.Decimal(params.amount);

    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        "Transaction amount must be greater than 0",
      );
    }

    const account = await tx.financeAccount.findFirst({
      where: {
        id: params.accountId,
        businessId: params.businessId,
        deletedAt: null,
        status: FinanceAccountStatus.ACTIVE,
      },
    });

    if (!account) {
      throw new NotFoundException("Finance account not found");
    }

    const balanceBefore = new Prisma.Decimal(account.currentBalance);
    const balanceAfter =
      params.transactionType === FinanceTransactionType.CREDIT
        ? balanceBefore.plus(amount)
        : balanceBefore.minus(amount);

    if (balanceAfter.lessThan(0)) {
      throw new BadRequestException("Finance account balance is insufficient");
    }

    const transaction = await tx.financeAccountTransaction.create({
      data: {
        businessId: params.businessId,
        accountId: account.id,
        transactionNo: await this.generateUniqueTransactionNo(
          params.businessId,
        ),
        transactionType: params.transactionType,
        amount,
        balanceBefore,
        balanceAfter,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        note: this.normalizeNullableText(params.note),
        createdBy: params.createdBy,
      },
    });

    await tx.financeAccount.update({
      where: { id: account.id },
      data: {
        currentBalance: balanceAfter,
      },
    });

    return transaction;
  }

  private async generateUniqueReceivableNo(businessId: string) {
    return this.generateUniqueCode(businessId, "REC", (code) =>
      this.prisma.financeReceivable.findFirst({
        where: { businessId, receivableNo: code },
        select: { id: true },
      }),
    );
  }

  private async generateUniquePayableNo(businessId: string) {
    return this.generateUniqueCode(businessId, "PAYB", (code) =>
      this.prisma.financePayable.findFirst({
        where: { businessId, payableNo: code },
        select: { id: true },
      }),
    );
  }

  private async generateUniqueCode(
    businessId: string,
    prefix: string,
    finder: (code: string) => Promise<{ id: string } | null>,
  ) {
    for (let attempt = 0; attempt < FINANCE_CODE_RETRY_LIMIT; attempt++) {
      const code = generateRandomCode(prefix);
      const existing = await finder(code);

      if (!existing) {
        return code;
      }
    }

    throw new BadRequestException(
      `Could not generate ${prefix} number for business ${businessId}`,
    );
  }

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }
}
