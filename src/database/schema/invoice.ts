import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { business } from "./business";
import { decimal, type JsonValue } from "./common";
import { financeTax } from "./finance";
import { systemUser } from "./system";

export const InvoiceStatus = {
  DRAFT: "DRAFT",
  ISSUED: "ISSUED",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
  CANCELLED: "CANCELLED",
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];
export const invoiceStatusEnum = pgEnum("InvoiceStatus", [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
]);

export const InvoiceTemplateStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type InvoiceTemplateStatus =
  (typeof InvoiceTemplateStatus)[keyof typeof InvoiceTemplateStatus];
export const invoiceTemplateStatusEnum = pgEnum("InvoiceTemplateStatus", [
  "ACTIVE",
  "INACTIVE",
]);

export const invoice = pgTable(
  "invoices",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    orderId: uuid("order_id"),
    customerId: uuid("customer_id"),
    taxId: uuid("tax_id").references((): AnyPgColumn => financeTax.id, {
      onDelete: "restrict",
    }),
    invoiceNo: varchar("invoice_no", { length: 100 }).notNull(),
    invoiceDate: timestamp("invoice_date", { mode: "date" }).notNull(),
    dueDate: timestamp("due_date", { mode: "date" }),
    status: invoiceStatusEnum().notNull(),
    customerName: varchar("customer_name", { length: 150 }),
    customerPhone: varchar("customer_phone", { length: 30 }),
    customerEmail: varchar("customer_email", { length: 150 }),
    billingAddressSnapshot: jsonb(
      "billing_address_snapshot",
    ).$type<JsonValue>(),
    subtotal: decimal({ precision: 12, scale: 2 }).notNull(),
    discountTotal: decimal("discount_total", {
      precision: 12,
      scale: 2,
    }).notNull(),
    taxTotal: decimal("tax_total", { precision: 12, scale: 2 }).notNull(),
    taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull(),
    shippingCharge: decimal("shipping_charge", {
      precision: 12,
      scale: 2,
    }).notNull(),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).notNull(),
    note: text(),
    createdBy: uuid("created_by").references((): AnyPgColumn => systemUser.id, {
      onDelete: "set null",
    }),
    deletedBy: uuid("deleted_by").references((): AnyPgColumn => systemUser.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [
    uniqueIndex("invoice_invoices_business_id_invoice_no_unique").on(
      table.businessId,
      table.invoiceNo,
    ),
    index("invoice_invoices_business_id_idx").on(table.businessId),
    index("invoice_invoices_order_id_idx").on(table.orderId),
    index("invoice_invoices_customer_id_idx").on(table.customerId),
    index("invoice_invoices_tax_id_idx").on(table.taxId),
    index("invoice_invoices_status_idx").on(table.status),
    index("invoice_invoices_invoice_date_idx").on(table.invoiceDate),
    index("invoice_invoices_due_date_idx").on(table.dueDate),
  ],
);
export type Invoice = typeof invoice.$inferSelect;
export type NewInvoice = typeof invoice.$inferInsert;

export const invoiceItem = pgTable(
  "invoice_items",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references((): AnyPgColumn => invoice.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id"),
    productId: uuid("product_id").notNull(),
    variantId: uuid("variant_id"),
    quantity: decimal({ precision: 14, scale: 3 }).notNull(),
    unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
    discountAmount: decimal("discount_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull(),
    lineTotal: decimal("line_total", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("invoice_items_invoice_id_idx").on(table.invoiceId),
    index("invoice_items_order_item_id_idx").on(table.orderItemId),
    index("invoice_items_product_id_idx").on(table.productId),
    index("invoice_items_variant_id_idx").on(table.variantId),
  ],
);
export type InvoiceItem = typeof invoiceItem.$inferSelect;
export type NewInvoiceItem = typeof invoiceItem.$inferInsert;

export const invoiceTemplate = pgTable(
  "invoice_templates",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    name: varchar({ length: 150 }).notNull(),
    logoUrl: text("logo_url"),
    headerText: text("header_text"),
    footerText: text("footer_text"),
    termsAndConditions: text("terms_and_conditions"),
    isDefault: boolean("is_default").notNull(),
    status: invoiceTemplateStatusEnum().notNull(),
    createdBy: uuid("created_by").references((): AnyPgColumn => systemUser.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references((): AnyPgColumn => systemUser.id, {
      onDelete: "set null",
    }),
    deletedBy: uuid("deleted_by").references((): AnyPgColumn => systemUser.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [
    index("invoice_templates_business_id_idx").on(table.businessId),
    index("invoice_templates_is_default_idx").on(table.isDefault),
    index("invoice_templates_status_idx").on(table.status),
  ],
);
export type InvoiceTemplate = typeof invoiceTemplate.$inferSelect;
export type NewInvoiceTemplate = typeof invoiceTemplate.$inferInsert;
