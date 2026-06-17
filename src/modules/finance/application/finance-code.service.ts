import { BadRequestException, Injectable } from "@nestjs/common";
import {
  financeAccountTransaction,
  financeExpense,
  financePayable,
  financeReceivable,
  supplierInvoice,
  supplierPayment,
} from "@/database/schema";
import { and, eq } from "drizzle-orm";

import { DatabaseService } from "../../../database/database.service";
import { generateRandomCode } from "../../../common/utils/code-generator.util";
import { BusinessCodePrefixService } from "../../../common/code/business-code-prefix.service";

const FINANCE_CODE_RETRY_LIMIT = 5;

@Injectable()
export class FinanceCodeService {
  constructor(
    private readonly database: DatabaseService,
    private readonly prefixes: BusinessCodePrefixService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async generateUniqueTransactionNo(businessId: string) {
    const prefix = await this.prefixes.resolve(
      businessId,
      "transactionPrefix",
      "TXN",
    );

    return this.generateUniqueCode(businessId, prefix, (code) =>
      this.exists(financeAccountTransaction, businessId, "transactionNo", code),
    );
  }

  async generateUniqueExpenseNo(businessId: string) {
    const prefix = await this.prefixes.resolve(
      businessId,
      "expensePrefix",
      "EXP",
    );

    return this.generateUniqueCode(businessId, prefix, (code) =>
      this.exists(financeExpense, businessId, "expenseNo", code),
    );
  }

  async generateUniqueSupplierInvoiceNo(businessId: string) {
    const prefix = await this.prefixes.resolve(
      businessId,
      "supplierInvoicePrefix",
      "SIN",
    );

    return this.generateUniqueCode(businessId, prefix, (code) =>
      this.exists(supplierInvoice, businessId, "invoiceNo", code),
    );
  }

  async generateUniqueSupplierPaymentNo(businessId: string) {
    const prefix = await this.prefixes.resolve(
      businessId,
      "supplierPaymentPrefix",
      "SPAY",
    );

    return this.generateUniqueCode(businessId, prefix, (code) =>
      this.exists(supplierPayment, businessId, "paymentNo", code),
    );
  }

  async generateUniqueReceivableNo(businessId: string) {
    const prefix = await this.prefixes.resolve(
      businessId,
      "receivablePrefix",
      "REC",
    );

    return this.generateUniqueCode(businessId, prefix, (code) =>
      this.exists(financeReceivable, businessId, "receivableNo", code),
    );
  }

  async generateUniquePayableNo(businessId: string) {
    const prefix = await this.prefixes.resolve(
      businessId,
      "payablePrefix",
      "PAYB",
    );

    return this.generateUniqueCode(businessId, prefix, (code) =>
      this.exists(financePayable, businessId, "payableNo", code),
    );
  }

  private exists(
    table:
      | typeof financeAccountTransaction
      | typeof financeExpense
      | typeof supplierInvoice
      | typeof supplierPayment
      | typeof financeReceivable
      | typeof financePayable,
    businessId: string,
    field:
      | "transactionNo"
      | "expenseNo"
      | "invoiceNo"
      | "paymentNo"
      | "receivableNo"
      | "payableNo",
    code: string,
  ) {
    return this.db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.businessId, businessId), eq(table[field], code)))
      .limit(1)
      .then(([row]) => row ?? null);
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
