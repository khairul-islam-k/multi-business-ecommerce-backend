import { Module } from "@nestjs/common";

import { AccountBalanceService } from "./application/account-balance.service";
import { FinanceCodeService } from "./application/finance-code.service";
import { PayableSyncService } from "./application/payable-sync.service";
import { ReceivableSyncService } from "./application/receivable-sync.service";
import { TaxLookupService } from "./application/tax-lookup.service";
import { FinanceAccountService } from "./accounts/finance-account.service";
import { FinanceLedgerService } from "./common/finance-ledger.service";
import { ExpenseCategoryService } from "./expenses/expense-category.service";
import { ExpenseService } from "./expenses/expense.service";
import { FinancePayableService } from "./payables/finance-payable.service";
import { FinanceReceivableService } from "./receivables/finance-receivable.service";
import { FinanceTaxService } from "./taxes/finance-tax.service";
import { FinanceAccountController } from "./accounts/finance-account.controller";
import { ExpenseCategoryController } from "./expenses/expense-category.controller";
import { ExpenseController } from "./expenses/expense.controller";
import { FinancePayableController } from "./payables/finance-payable.controller";
import { FinanceReceivableController } from "./receivables/finance-receivable.controller";
import { FinanceTaxController } from "./taxes/finance-tax.controller";
import { AccessModule } from "../access/access.module";
import { BusinessModule } from "../business/business.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";

@Module({
  imports: [AccessModule, BusinessModule, PermissionModule, PackageModule],
  controllers: [
    FinanceAccountController,
    FinanceTaxController,
    ExpenseCategoryController,
    ExpenseController,
    FinanceReceivableController,
    FinancePayableController,
  ],
  providers: [
    FinanceLedgerService,
    TaxLookupService,
    AccountBalanceService,
    ReceivableSyncService,
    PayableSyncService,
    FinanceCodeService,
    FinanceAccountService,
    FinanceTaxService,
    ExpenseCategoryService,
    ExpenseService,
    FinanceReceivableService,
    FinancePayableService,
  ],
  exports: [
    FinanceLedgerService,
    TaxLookupService,
    AccountBalanceService,
    ReceivableSyncService,
    PayableSyncService,
    FinanceCodeService,
  ],
})
export class FinanceModule {}
