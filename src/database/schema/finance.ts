import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { decimal } from "./common";

export const FinanceAccountType = {
  CASH: "CASH",
  BANK: "BANK",
  MOBILE_BANKING: "MOBILE_BANKING",
  PAYMENT_GATEWAY: "PAYMENT_GATEWAY",
  OTHER: "OTHER",
} as const;
export type FinanceAccountType =
  (typeof FinanceAccountType)[keyof typeof FinanceAccountType];
export const financeAccountTypeEnum = pgEnum("FinanceAccountType", [
  "CASH",
  "BANK",
  "MOBILE_BANKING",
  "PAYMENT_GATEWAY",
  "OTHER",
]);

export const FinanceAccountStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type FinanceAccountStatus =
  (typeof FinanceAccountStatus)[keyof typeof FinanceAccountStatus];
export const financeAccountStatusEnum = pgEnum("FinanceAccountStatus", [
  "ACTIVE",
  "INACTIVE",
]);

export const FinanceTransactionType = {
  DEBIT: "DEBIT",
  CREDIT: "CREDIT",
} as const;
export type FinanceTransactionType =
  (typeof FinanceTransactionType)[keyof typeof FinanceTransactionType];
export const financeTransactionTypeEnum = pgEnum("FinanceTransactionType", [
  "DEBIT",
  "CREDIT",
]);

export const FinanceExpenseCategoryStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type FinanceExpenseCategoryStatus =
  (typeof FinanceExpenseCategoryStatus)[keyof typeof FinanceExpenseCategoryStatus];
export const financeExpenseCategoryStatusEnum = pgEnum(
  "FinanceExpenseCategoryStatus",
  ["ACTIVE", "INACTIVE"],
);

export const FinanceExpenseStatus = {
  DRAFT: "DRAFT",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
} as const;
export type FinanceExpenseStatus =
  (typeof FinanceExpenseStatus)[keyof typeof FinanceExpenseStatus];
export const financeExpenseStatusEnum = pgEnum("FinanceExpenseStatus", [
  "DRAFT",
  "PAID",
  "CANCELLED",
]);

export const FinanceTaxStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type FinanceTaxStatus =
  (typeof FinanceTaxStatus)[keyof typeof FinanceTaxStatus];
export const financeTaxStatusEnum = pgEnum("FinanceTaxStatus", [
  "ACTIVE",
  "INACTIVE",
]);

export const FinancePartyType = {
  CUSTOMER: "CUSTOMER",
  SUPPLIER: "SUPPLIER",
  COURIER: "COURIER",
  PAYMENT_GATEWAY: "PAYMENT_GATEWAY",
  EMPLOYEE: "EMPLOYEE",
  OTHER: "OTHER",
} as const;
export type FinancePartyType =
  (typeof FinancePartyType)[keyof typeof FinancePartyType];
export const financePartyTypeEnum = pgEnum("FinancePartyType", [
  "CUSTOMER",
  "SUPPLIER",
  "COURIER",
  "PAYMENT_GATEWAY",
  "EMPLOYEE",
  "OTHER",
]);

export const FinanceReceivableStatus = {
  PENDING: "PENDING",
  PARTIALLY_RECEIVED: "PARTIALLY_RECEIVED",
  RECEIVED: "RECEIVED",
  CANCELLED: "CANCELLED",
} as const;
export type FinanceReceivableStatus =
  (typeof FinanceReceivableStatus)[keyof typeof FinanceReceivableStatus];
export const financeReceivableStatusEnum = pgEnum("FinanceReceivableStatus", [
  "PENDING",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
]);

export const FinancePayableStatus = {
  PENDING: "PENDING",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
} as const;
export type FinancePayableStatus =
  (typeof FinancePayableStatus)[keyof typeof FinancePayableStatus];
export const financePayableStatusEnum = pgEnum("FinancePayableStatus", [
  "PENDING",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
]);

export const FinanceSourceType = {
  ORDER: "ORDER",
  INVOICE: "INVOICE",
  SUPPLIER_INVOICE: "SUPPLIER_INVOICE",
  SUPPLIER_PAYMENT: "SUPPLIER_PAYMENT",
  SUPPLIER_RETURN: "SUPPLIER_RETURN",
  COURIER_RECEIVABLE: "COURIER_RECEIVABLE",
  COURIER_SETTLEMENT: "COURIER_SETTLEMENT",
  EXPENSE: "EXPENSE",
  REFUND: "REFUND",
  MANUAL: "MANUAL",
} as const;
export type FinanceSourceType =
  (typeof FinanceSourceType)[keyof typeof FinanceSourceType];
export const financeSourceTypeEnum = pgEnum("FinanceSourceType", [
  "ORDER",
  "INVOICE",
  "SUPPLIER_INVOICE",
  "SUPPLIER_PAYMENT",
  "SUPPLIER_RETURN",
  "COURIER_RECEIVABLE",
  "COURIER_SETTLEMENT",
  "EXPENSE",
  "REFUND",
  "MANUAL",
]);

export const FinanceJournalLineType = {
  DEBIT: "DEBIT",
  CREDIT: "CREDIT",
} as const;
export type FinanceJournalLineType =
  (typeof FinanceJournalLineType)[keyof typeof FinanceJournalLineType];
export const financeJournalLineTypeEnum = pgEnum("FinanceJournalLineType", [
  "DEBIT",
  "CREDIT",
]);

export const financeTax = pgTable(
  "finance_taxes",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id").notNull(),
    name: varchar({ length: 150 }).notNull(),
    rate: decimal({ precision: 5, scale: 2 }).notNull(),
    description: text(),
    status: financeTaxStatusEnum().notNull(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [
    uniqueIndex("finance_taxes_business_id_name_deleted_at_unique")
      .on(table.businessId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index("finance_taxes_business_id_idx").on(table.businessId),
    index("finance_taxes_status_idx").on(table.status),
    index("finance_taxes_deleted_at_idx").on(table.deletedAt),
  ],
);
export type FinanceTax = typeof financeTax.$inferSelect;
export type NewFinanceTax = typeof financeTax.$inferInsert;

export const financeAccount = pgTable(
  "finance_accounts",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id").notNull(),
    name: varchar({ length: 150 }).notNull(),
    accountType: financeAccountTypeEnum("account_type").notNull(),
    accountNumber: varchar("account_number", { length: 100 }),
    currencyCode: varchar("currency_code", { length: 10 }).notNull(),
    openingBalance: decimal("opening_balance", {
      precision: 12,
      scale: 2,
    }).notNull(),
    currentBalance: decimal("current_balance", {
      precision: 12,
      scale: 2,
    }).notNull(),
    status: financeAccountStatusEnum().notNull(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [
    uniqueIndex("finance_accounts_business_id_name_deleted_at_unique")
      .on(table.businessId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index("finance_accounts_business_id_idx").on(table.businessId),
    index("finance_accounts_account_type_idx").on(table.accountType),
    index("finance_accounts_status_idx").on(table.status),
  ],
);
export type FinanceAccount = typeof financeAccount.$inferSelect;
export type NewFinanceAccount = typeof financeAccount.$inferInsert;

export const financeAccountTransaction = pgTable(
  "finance_account_transactions",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id").notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references((): AnyPgColumn => financeAccount.id, {
        onDelete: "restrict",
      }),
    transactionNo: varchar("transaction_no", { length: 100 }).notNull(),
    transactionType: financeTransactionTypeEnum("transaction_type").notNull(),
    amount: decimal({ precision: 12, scale: 2 }).notNull(),
    balanceBefore: decimal("balance_before", {
      precision: 12,
      scale: 2,
    }).notNull(),
    balanceAfter: decimal("balance_after", {
      precision: 12,
      scale: 2,
    }).notNull(),
    referenceType: financeSourceTypeEnum("reference_type"),
    referenceId: uuid("reference_id"),
    note: text(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex(
      "finance_account_transactions_business_id_transaction_no_unique",
    ).on(table.businessId, table.transactionNo),
    index("finance_account_transactions_business_id_idx").on(table.businessId),
    index("finance_account_transactions_account_id_idx").on(table.accountId),
    index("finance_account_transactions_transaction_type_idx").on(
      table.transactionType,
    ),
    index("finance_account_transactions_reference_type_reference_id_idx").on(
      table.referenceType,
      table.referenceId,
    ),
    index("finance_account_transactions_created_at_idx").on(table.createdAt),
  ],
);
export type FinanceAccountTransaction =
  typeof financeAccountTransaction.$inferSelect;
export type NewFinanceAccountTransaction =
  typeof financeAccountTransaction.$inferInsert;

export const financeExpenseCategory = pgTable(
  "finance_expense_categories",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id").notNull(),
    name: varchar({ length: 150 }).notNull(),
    description: text(),
    status: financeExpenseCategoryStatusEnum().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [
    uniqueIndex("finance_expense_categories_business_id_name_deleted_at_unique")
      .on(table.businessId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index("finance_expense_categories_business_id_idx").on(table.businessId),
    index("finance_expense_categories_status_idx").on(table.status),
  ],
);
export type FinanceExpenseCategory = typeof financeExpenseCategory.$inferSelect;
export type NewFinanceExpenseCategory =
  typeof financeExpenseCategory.$inferInsert;

export const financeExpense = pgTable(
  "finance_expenses",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id").notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references((): AnyPgColumn => financeAccount.id, {
        onDelete: "restrict",
      }),
    expenseCategoryId: uuid("expense_category_id")
      .notNull()
      .references((): AnyPgColumn => financeExpenseCategory.id, {
        onDelete: "restrict",
      }),
    expenseNo: varchar("expense_no", { length: 100 }).notNull(),
    title: varchar({ length: 200 }).notNull(),
    amount: decimal({ precision: 12, scale: 2 }).notNull(),
    expenseDate: timestamp("expense_date", { mode: "date" }).notNull(),
    status: financeExpenseStatusEnum().notNull(),
    referenceNo: varchar("reference_no", { length: 150 }),
    note: text(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [
    uniqueIndex("finance_expenses_business_id_expense_no_deleted_at_unique")
      .on(table.businessId, table.expenseNo)
      .where(sql`${table.deletedAt} IS NULL`),
    index("finance_expenses_business_id_idx").on(table.businessId),
    index("finance_expenses_account_id_idx").on(table.accountId),
    index("finance_expenses_expense_category_id_idx").on(
      table.expenseCategoryId,
    ),
    index("finance_expenses_status_idx").on(table.status),
    index("finance_expenses_expense_date_idx").on(table.expenseDate),
  ],
);
export type FinanceExpense = typeof financeExpense.$inferSelect;
export type NewFinanceExpense = typeof financeExpense.$inferInsert;

export const financeReceivable = pgTable(
  "finance_receivables",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id").notNull(),
    receivableNo: varchar("receivable_no", { length: 100 }).notNull(),
    partyType: financePartyTypeEnum("party_type").notNull(),
    partyId: uuid("party_id"),
    sourceType: financeSourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id"),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    receivedAmount: decimal("received_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    status: financeReceivableStatusEnum().notNull(),
    dueDate: timestamp("due_date", { mode: "date" }),
    note: text(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("finance_receivables_business_id_receivable_no_unique").on(
      table.businessId,
      table.receivableNo,
    ),
    index("finance_receivables_business_id_idx").on(table.businessId),
    index("finance_receivables_party_type_party_id_idx").on(
      table.partyType,
      table.partyId,
    ),
    index("finance_receivables_source_type_source_id_idx").on(
      table.sourceType,
      table.sourceId,
    ),
    index("finance_receivables_status_idx").on(table.status),
    index("finance_receivables_due_date_idx").on(table.dueDate),
  ],
);
export type FinanceReceivable = typeof financeReceivable.$inferSelect;
export type NewFinanceReceivable = typeof financeReceivable.$inferInsert;

export const financePayable = pgTable(
  "finance_payables",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id").notNull(),
    payableNo: varchar("payable_no", { length: 100 }).notNull(),
    partyType: financePartyTypeEnum("party_type").notNull(),
    partyId: uuid("party_id"),
    sourceType: financeSourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id"),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).notNull(),
    status: financePayableStatusEnum().notNull(),
    dueDate: timestamp("due_date", { mode: "date" }),
    note: text(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("finance_payables_business_id_payable_no_unique").on(
      table.businessId,
      table.payableNo,
    ),
    index("finance_payables_business_id_idx").on(table.businessId),
    index("finance_payables_party_type_party_id_idx").on(
      table.partyType,
      table.partyId,
    ),
    index("finance_payables_source_type_source_id_idx").on(
      table.sourceType,
      table.sourceId,
    ),
    index("finance_payables_status_idx").on(table.status),
    index("finance_payables_due_date_idx").on(table.dueDate),
  ],
);
export type FinancePayable = typeof financePayable.$inferSelect;
export type NewFinancePayable = typeof financePayable.$inferInsert;

export const financeJournalEntry = pgTable(
  "finance_journal_entries",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id").notNull(),
    journalNo: varchar("journal_no", { length: 100 }).notNull(),
    journalDate: timestamp("journal_date", { mode: "date" }).notNull(),
    referenceType: financeSourceTypeEnum("reference_type"),
    referenceId: uuid("reference_id"),
    note: text(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("finance_journal_entries_business_id_journal_no_unique").on(
      table.businessId,
      table.journalNo,
    ),
    index("finance_journal_entries_business_id_idx").on(table.businessId),
    index("finance_journal_entries_journal_date_idx").on(table.journalDate),
    index("finance_journal_entries_reference_type_reference_id_idx").on(
      table.referenceType,
      table.referenceId,
    ),
  ],
);
export type FinanceJournalEntry = typeof financeJournalEntry.$inferSelect;
export type NewFinanceJournalEntry = typeof financeJournalEntry.$inferInsert;

export const financeJournalEntryLine = pgTable(
  "finance_journal_entry_lines",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references((): AnyPgColumn => financeJournalEntry.id, {
        onDelete: "cascade",
      }),
    accountId: uuid("account_id")
      .notNull()
      .references((): AnyPgColumn => financeAccount.id, {
        onDelete: "restrict",
      }),
    entryType: financeJournalLineTypeEnum("entry_type").notNull(),
    amount: decimal({ precision: 12, scale: 2 }).notNull(),
    note: text(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("finance_journal_entry_lines_journal_entry_id_idx").on(
      table.journalEntryId,
    ),
    index("finance_journal_entry_lines_account_id_idx").on(table.accountId),
    index("finance_journal_entry_lines_entry_type_idx").on(table.entryType),
  ],
);
export type FinanceJournalEntryLine =
  typeof financeJournalEntryLine.$inferSelect;
export type NewFinanceJournalEntryLine =
  typeof financeJournalEntryLine.$inferInsert;
