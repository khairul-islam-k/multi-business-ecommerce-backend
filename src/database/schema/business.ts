import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
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
} from "drizzle-orm/pg-core";

import { financeAccount, financeTax } from "./finance";
import { warehouse } from "./inventory";
import { productUnit } from "./product";
import { systemUser } from "./system";

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

export const BusinessBrandingDensity = {
  COMPACT: "COMPACT",
  DEFAULT: "DEFAULT",
  COMFORTABLE: "COMFORTABLE",
} as const;
export type BusinessBrandingDensity =
  (typeof BusinessBrandingDensity)[keyof typeof BusinessBrandingDensity];
export const businessBrandingDensityEnum = pgEnum("BusinessBrandingDensity", [
  "COMPACT",
  "DEFAULT",
  "COMFORTABLE",
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
    deletedById: uuid("deleted_by").references(
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
    uniqueIndex("businesses_name_deleted_at_unique")
      .on(table.name)
      .where(sql`${table.deletedAt} IS NULL`),
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
    defaultWarehouseId: uuid("default_warehouse_id")
      .notNull()
      .references((): AnyPgColumn => warehouse.id, { onDelete: "restrict" }),
    defaultFinanceAccountId: uuid("default_finance_account_id")
      .notNull()
      .references((): AnyPgColumn => financeAccount.id, {
        onDelete: "restrict",
      }),
    defaultUnitId: uuid("default_unit_id")
      .notNull()
      .references((): AnyPgColumn => productUnit.id, {
        onDelete: "restrict",
      }),
    defaultTaxId: uuid("default_tax_id")
      .notNull()
      .references((): AnyPgColumn => financeTax.id, {
        onDelete: "restrict",
      }),
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
  (table) => [
    index("business_settings_default_warehouse_id_idx").on(
      table.defaultWarehouseId,
    ),
    index("business_settings_default_finance_account_id_idx").on(
      table.defaultFinanceAccountId,
    ),
    index("business_settings_default_unit_id_idx").on(table.defaultUnitId),
    index("business_settings_default_tax_id_idx").on(table.defaultTaxId),
  ],
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
    primaryHoverColor: varchar("primary_hover_color", { length: 20 }),
    primaryActiveColor: varchar("primary_active_color", { length: 20 }),
    secondaryColor: varchar("secondary_color", { length: 20 }),
    accentColor: varchar("accent_color", { length: 20 }),
    successColor: varchar("success_color", { length: 20 }),
    warningColor: varchar("warning_color", { length: 20 }),
    errorColor: varchar("error_color", { length: 20 }),
    infoColor: varchar("info_color", { length: 20 }),
    dashboardBackgroundColor: varchar("dashboard_background_color", {
      length: 20,
    }),
    sidebarBackgroundColor: varchar("sidebar_background_color", {
      length: 20,
    }),
    sidebarTextColor: varchar("sidebar_text_color", { length: 20 }),
    sidebarMutedTextColor: varchar("sidebar_muted_text_color", { length: 20 }),
    sidebarActiveBackgroundColor: varchar("sidebar_active_background_color", {
      length: 20,
    }),
    sidebarActiveTextColor: varchar("sidebar_active_text_color", {
      length: 20,
    }),
    sidebarHoverBackgroundColor: varchar("sidebar_hover_background_color", {
      length: 20,
    }),
    headerBackgroundColor: varchar("header_background_color", { length: 20 }),
    headerTextColor: varchar("header_text_color", { length: 20 }),
    cardBackgroundColor: varchar("card_background_color", { length: 20 }),
    elevatedBackgroundColor: varchar("elevated_background_color", {
      length: 20,
    }),
    tableHeaderBackgroundColor: varchar("table_header_background_color", {
      length: 20,
    }),
    tableRowHoverColor: varchar("table_row_hover_color", { length: 20 }),
    inputBackgroundColor: varchar("input_background_color", { length: 20 }),
    disabledBackgroundColor: varchar("disabled_background_color", {
      length: 20,
    }),
    textPrimaryColor: varchar("text_primary_color", { length: 20 }),
    textSecondaryColor: varchar("text_secondary_color", { length: 20 }),
    textMutedColor: varchar("text_muted_color", { length: 20 }),
    textInverseColor: varchar("text_inverse_color", { length: 20 }),
    borderColor: varchar("border_color", { length: 20 }),
    borderSubtleColor: varchar("border_subtle_color", { length: 20 }),
    focusRingColor: varchar("focus_ring_color", { length: 20 }),
    fontFamily: varchar("font_family", { length: 100 }),
    borderRadius: varchar("border_radius", { length: 30 }),
    density: businessBrandingDensityEnum(),
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
    deletedById: uuid("deleted_by").references(
      (): AnyPgColumn => systemUser.id,
      { onDelete: "set null" },
    ),
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
