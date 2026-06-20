import Decimal from "decimal.js";

import { FinanceSourceType } from "@/database/schema";
import { Injectable } from "@nestjs/common";

import { AccountBalanceService } from "../application/account-balance.service";
import { FinanceCodeService } from "../application/finance-code.service";
import { PayableSyncService } from "../application/payable-sync.service";
import { ReceivableSyncService } from "../application/receivable-sync.service";
import { TaxLookupService } from "../application/tax-lookup.service";

import type {
  Database,
  DatabaseTransaction,
} from "../../../database/database.service";

@Injectable()
export class FinanceLedgerService {
  constructor(
    private readonly taxLookup: TaxLookupService,
    private readonly accountBalances: AccountBalanceService,
    private readonly receivables: ReceivableSyncService,
    private readonly payables: PayableSyncService,
    private readonly financeCodes: FinanceCodeService,
  ) {}

  async assertActiveTax(
    client: Database | DatabaseTransaction | undefined,
    businessId: string,
    taxId: string,
  ) {
    return this.taxLookup.assertActiveTax(client, businessId, taxId);
  }

  async creditAccount(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      accountId: string;
      amount: Decimal.Value;
      referenceType?: FinanceSourceType;
      referenceId?: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    return this.accountBalances.creditAccount(tx, params);
  }

  async debitAccount(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      accountId: string;
      amount: Decimal.Value;
      referenceType?: FinanceSourceType;
      referenceId?: string;
      note?: string | null;
      createdBy?: string;
    },
  ) {
    return this.accountBalances.debitAccount(tx, params);
  }

  async syncOrderReceivable(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      orderId: string;
      customerId?: string | null;
      totalAmount: Decimal.Value;
      receivedAmount: Decimal.Value;
      note?: string | null;
    },
  ) {
    return this.receivables.syncOrderReceivable(tx, params);
  }

  async createSupplierInvoicePayable(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      supplierId: string;
      supplierInvoiceId: string;
      totalAmount: Decimal.Value;
      note?: string | null;
    },
  ) {
    return this.payables.createSupplierInvoicePayable(tx, params);
  }

  async createSupplierReturnReceivable(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      supplierId: string;
      supplierReturnId: string;
      totalAmount: Decimal.Value;
      note?: string | null;
    },
  ) {
    return this.receivables.createSupplierReturnReceivable(tx, params);
  }

  async syncSupplierInvoicePayablePayment(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      supplierInvoiceId: string;
      paidAmount: Decimal.Value;
    },
  ) {
    return this.payables.syncSupplierInvoicePayablePayment(tx, params);
  }

  async generateUniqueTransactionNo(businessId: string) {
    return this.financeCodes.generateUniqueTransactionNo(businessId);
  }

  async generateUniqueExpenseNo(businessId: string) {
    return this.financeCodes.generateUniqueExpenseNo(businessId);
  }

  async generateUniqueSupplierInvoiceNo(businessId: string) {
    return this.financeCodes.generateUniqueSupplierInvoiceNo(businessId);
  }

  async generateUniqueSupplierPaymentNo(businessId: string) {
    return this.financeCodes.generateUniqueSupplierPaymentNo(businessId);
  }
}
