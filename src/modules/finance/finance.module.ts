import { Module } from "@nestjs/common";

import { BusinessModule } from "../business/business.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
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
    FinanceAccountService,
    FinanceTaxService,
    ExpenseCategoryService,
    ExpenseService,
    FinanceReceivableService,
    FinancePayableService,
  ],
  exports: [FinanceLedgerService],
})
export class FinanceModule {}
