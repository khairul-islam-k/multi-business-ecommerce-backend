import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { systemUser } from "./system";
import { sql } from "drizzle-orm";

export const BusinessStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;
export type BusinessStatus =
  (typeof BusinessStatus)[keyof typeof BusinessStatus];
export const businessStatusEnum = pgEnum("BusinessStatus", [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
]);

export const BusinessMemberStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;
export type BusinessMemberStatus =
  (typeof BusinessMemberStatus)[keyof typeof BusinessMemberStatus];
export const businessMemberStatusEnum = pgEnum("BusinessMemberStatus", [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
]);

export const business = pgTable(
  "businesses",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references((): AnyPgColumn => systemUser.id, { onDelete: "restrict" }),
    name: varchar({ length: 150 }).notNull(),
    slug: varchar({ length: 180 }).notNull(),
    email: varchar({ length: 255 }),
    phone: varchar({ length: 30 }),
    country: varchar({ length: 100 }),
    currencyCode: varchar("currency_code", { length: 10 }),
    timezone: varchar({ length: 100 }),
    status: businessStatusEnum().notNull(),
    createdById: uuid("created_by").references(
      (): AnyPgColumn => systemUser.id,
      { onDelete: "set null" },
    ),
    updatedById: uuid("updated_by").references(
      (): AnyPgColumn => systemUser.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    uniqueIndex("businesses_slug_owner_user_id_unique")
      .on(table.slug, table.ownerUserId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("businesses_owner_user_id_idx").on(table.ownerUserId),
    index("businesses_status_idx").on(table.status),
    index("businesses_deleted_at_idx").on(table.deletedAt),
  ],
);
export type Business = typeof business.$inferSelect;
export type NewBusiness = typeof business.$inferInsert;

export const businessSetting = pgTable(
  "business_settings",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .unique()
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    orderPrefix: varchar("order_prefix", { length: 20 }),
    invoicePrefix: varchar("invoice_prefix", { length: 20 }),
    paymentPrefix: varchar("payment_prefix", { length: 20 }),
    shipmentPrefix: varchar("shipment_prefix", { length: 20 }),
    purchaseOrderPrefix: varchar("purchase_order_prefix", { length: 20 }),
    purchaseReturnPrefix: varchar("purchase_return_prefix", { length: 20 }),
    stockAdjustmentPrefix: varchar("stock_adjustment_prefix", { length: 20 }),
    stockTransferPrefix: varchar("stock_transfer_prefix", { length: 20 }),
    expensePrefix: varchar("expense_prefix", { length: 20 }),
    supplierInvoicePrefix: varchar("supplier_invoice_prefix", { length: 20 }),
    supplierPaymentPrefix: varchar("supplier_payment_prefix", { length: 20 }),
    receivablePrefix: varchar("receivable_prefix", { length: 20 }),
    payablePrefix: varchar("payable_prefix", { length: 20 }),
    transactionPrefix: varchar("transaction_prefix", { length: 20 }),
    productSkuPrefix: varchar("product_sku_prefix", { length: 20 }),
    productBarcodePrefix: varchar("product_barcode_prefix", { length: 20 }),
    variantSkuPrefix: varchar("variant_sku_prefix", { length: 20 }),
    variantBarcodePrefix: varchar("variant_barcode_prefix", { length: 20 }),
    lowStockThreshold: integer("low_stock_threshold"),
    allowBackorder: boolean("allow_backorder"),
    autoConfirmOrder: boolean("auto_confirm_order"),
    codEnabled: boolean("cod_enabled"),
    onlinePaymentEnabled: boolean("online_payment_enabled"),
    createdAt: timestamp("created_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  () => [],
);
export type BusinessSetting = typeof businessSetting.$inferSelect;
export type NewBusinessSetting = typeof businessSetting.$inferInsert;

export const businessBranding = pgTable(
  "business_brandings",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .unique()
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    logoUrl: text("logo_url"),
    faviconUrl: text("favicon_url"),
    primaryColor: varchar("primary_color", { length: 20 }),
    secondaryColor: varchar("secondary_color", { length: 20 }),
    accentColor: varchar("accent_color", { length: 20 }),
    fontFamily: varchar("font_family", { length: 100 }),
    seoTitle: varchar("seo_title", { length: 255 }),
    seoDescription: text("seo_description"),
    createdAt: timestamp("created_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  () => [],
);
export type BusinessBranding = typeof businessBranding.$inferSelect;
export type NewBusinessBranding = typeof businessBranding.$inferInsert;

export const businessMember = pgTable(
  "business_members",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references((): AnyPgColumn => systemUser.id, { onDelete: "cascade" }),
    status: businessMemberStatusEnum().notNull(),
    joinedAt: timestamp("joined_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    uniqueIndex("business_members_business_id_user_id_unique")
      .on(table.businessId, table.userId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("business_members_business_id_idx").on(table.businessId),
    index("business_members_user_id_idx").on(table.userId),
    index("business_members_status_idx").on(table.status),
    index("business_members_deleted_at_idx").on(table.deletedAt),
  ],
);
export type BusinessMember = typeof businessMember.$inferSelect;
export type NewBusinessMember = typeof businessMember.$inferInsert;
