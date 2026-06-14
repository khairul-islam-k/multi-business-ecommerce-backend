import { BadRequestException, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import { generateRandomCode } from "../../../common/utils/code-generator.util";

const FINANCE_CODE_RETRY_LIMIT = 5;

@Injectable()
export class FinanceCodeService {
  constructor(private readonly prisma: PrismaService) {}

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

  async generateUniqueReceivableNo(businessId: string) {
    return this.generateUniqueCode(businessId, "REC", (code) =>
      this.prisma.financeReceivable.findFirst({
        where: { businessId, receivableNo: code },
        select: { id: true },
      }),
    );
  }

  async generateUniquePayableNo(businessId: string) {
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
}
