import { Module } from "@nestjs/common";

import { BusinessModule } from "../business/business.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { AccountBalanceService } from "./application/account-balance.service";
import { FinanceCodeService } from "./application/finance-code.service";
import { PayableSyncService } from "./application/payable-sync.service";
import { ReceivableSyncService } from "./application/receivable-sync.service";
import { TaxLookupService } from "./application/tax-lookup.service";
import { FinanceAccountController } from "./accounts/finance-account.controller";
import { FinanceAccountService } from "./accounts/finance-account.service";
import { FinanceLedgerService } from "./common/finance-ledger.service";
import { ExpenseCategoryController } from "./expenses/expense-category.controller";
import { ExpenseCategoryService } from "./expenses/expense-category.service";
import { ExpenseController } from "./expenses/expense.controller";
import { ExpenseService } from "./expenses/expense.service";
import { FinancePayableController } from "./payables/finance-payable.controller";
import { FinancePayableService } from "./payables/finance-payable.service";
import { FinanceReceivableController } from "./receivables/finance-receivable.controller";
import { FinanceReceivableService } from "./receivables/finance-receivable.service";
import { FinanceTaxController } from "./taxes/finance-tax.controller";
import { FinanceTaxService } from "./taxes/finance-tax.service";

@Module({
  imports: [BusinessModule, PermissionModule, PackageModule],
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
