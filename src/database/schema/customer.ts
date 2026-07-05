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

import { business } from "./business";
import { systemUser } from "./system";
import { website } from "./website";
import { product, productVariant } from "./product";

export const CustomerStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  BLOCKED: "BLOCKED",
} as const;
export type CustomerStatus =
  (typeof CustomerStatus)[keyof typeof CustomerStatus];
export const customerStatusEnum = pgEnum("CustomerStatus", [
  "ACTIVE",
  "INACTIVE",
  "BLOCKED",
]);

export const CustomerAddressType = {
  HOME: "HOME",
  OFFICE: "OFFICE",
  SHIPPING: "SHIPPING",
  BILLING: "BILLING",
  OTHER: "OTHER",
} as const;
export type CustomerAddressType =
  (typeof CustomerAddressType)[keyof typeof CustomerAddressType];
export const customerAddressTypeEnum = pgEnum("CustomerAddressType", [
  "HOME",
  "OFFICE",
  "SHIPPING",
  "BILLING",
  "OTHER",
]);

export const CustomerOtpPurpose = {
  EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
  PASSWORD_RESET: "PASSWORD_RESET",
  EMAIL_CHANGE: "EMAIL_CHANGE",
} as const;
export type CustomerOtpPurpose =
  (typeof CustomerOtpPurpose)[keyof typeof CustomerOtpPurpose];
export const customerOtpPurposeEnum = pgEnum("CustomerOtpPurpose", [
  "EMAIL_VERIFICATION",
  "PASSWORD_RESET",
  "EMAIL_CHANGE",
]);

export const customer = pgTable(
  "customers",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    name: varchar({ length: 150 }).notNull(),
    email: varchar({ length: 150 }),
    imageUrl: varchar({ length: 255 }),
    phone: varchar({ length: 30 }),
    status: customerStatusEnum().notNull(),
    note: text(),
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
    uniqueIndex("customers_business_id_email_active_unique")
      .on(table.businessId, table.email)
      .where(sql`${table.email} IS NOT NULL AND ${table.deletedAt} IS NULL`),
    uniqueIndex("customers_business_id_phone_active_unique")
      .on(table.businessId, table.phone)
      .where(sql`${table.phone} IS NOT NULL AND ${table.deletedAt} IS NULL`),
    index("customers_business_id_idx").on(table.businessId),
    index("customers_business_id_status_idx").on(
      table.businessId,
      table.status,
    ),
    index("customers_phone_idx").on(table.phone),
    index("customers_email_idx").on(table.email),
    index("customers_status_idx").on(table.status),
    index("customers_deleted_at_idx").on(table.deletedAt),
  ],
);
export type Customer = typeof customer.$inferSelect;
export type NewCustomer = typeof customer.$inferInsert;

export const customerAddress = pgTable(
  "customer_addresses",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references((): AnyPgColumn => customer.id, { onDelete: "cascade" }),
    addressType: customerAddressTypeEnum("address_type").notNull(),
    name: varchar({ length: 150 }),
    address: text().notNull(),
    city: varchar({ length: 100 }),
    country: varchar({ length: 100 }),
    isDefault: boolean("is_default").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedBy: uuid("deleted_by").references((): AnyPgColumn => systemUser.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [
    uniqueIndex("customer_addresses_one_default_active_unique")
      .on(table.customerId)
      .where(sql`${table.isDefault} = true AND ${table.deletedAt} IS NULL`),
    index("customer_addresses_customer_id_idx").on(table.customerId),
    index("customer_addresses_address_type_idx").on(table.addressType),
    index("customer_addresses_is_default_idx").on(table.isDefault),
    index("customer_addresses_deleted_at_idx").on(table.deletedAt),
  ],
);
export type CustomerAddress = typeof customerAddress.$inferSelect;
export type NewCustomerAddress = typeof customerAddress.$inferInsert;

export const customerAccount = pgTable(
  "customer_accounts",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references((): AnyPgColumn => customer.id, { onDelete: "cascade" }),
    websiteId: uuid("website_id")
      .notNull()
      .references((): AnyPgColumn => website.id, { onDelete: "cascade" }),

    email: varchar({ length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", {
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
    deletedBy: uuid("deleted_by").references((): AnyPgColumn => systemUser.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    uniqueIndex("customer_accounts_website_id_customer_id_active_unique")
      .on(table.websiteId, table.customerId)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("customer_accounts_website_id_email_active_unique")
      .on(table.websiteId, table.email)
      .where(sql`${table.deletedAt} IS NULL`),
    index("customer_accounts_customer_id_idx").on(table.customerId),
    index("customer_accounts_website_id_idx").on(table.websiteId),
    index("customer_accounts_email_idx").on(table.email),
    index("customer_accounts_deleted_at_idx").on(table.deletedAt),
  ],
);
export type CustomerAccount = typeof customerAccount.$inferSelect;
export type NewCustomerAccount = typeof customerAccount.$inferInsert;

export const customerEmailVerification = pgTable(
  "customer_email_verifications",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references((): AnyPgColumn => customerAccount.id, {
        onDelete: "cascade",
      }),
    otpHash: text("otp_hash").notNull(),
    purpose: customerOtpPurposeEnum().notNull(),
    attemptCount: integer("attempt_count").notNull(),
    expiresAt: timestamp("expires_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    }).notNull(),
    verifiedAt: timestamp("verified_at", {
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
  },
  (table) => [
    index("customer_email_verifications_account_id_idx").on(table.accountId),
    index("customer_email_verifications_account_id_purpose_idx").on(
      table.accountId,
      table.purpose,
    ),
    index("customer_email_verifications_purpose_idx").on(table.purpose),
    index("customer_email_verifications_expires_at_idx").on(table.expiresAt),
    index("customer_email_verifications_verified_at_idx").on(table.verifiedAt),
  ],
);
export type CustomerEmailVerification =
  typeof customerEmailVerification.$inferSelect;
export type NewCustomerEmailVerification =
  typeof customerEmailVerification.$inferInsert;

export const customerPasswordReset = pgTable(
  "customer_password_resets",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references((): AnyPgColumn => customerAccount.id, {
        onDelete: "cascade",
      }),
    otpHash: text("otp_hash").notNull(),
    attemptCount: integer("attempt_count").notNull(),
    expiresAt: timestamp("expires_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    }).notNull(),
    usedAt: timestamp("used_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    }),
    verifiedAt: timestamp("verified_at", {
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
  },
  (table) => [
    index("customer_password_resets_account_id_idx").on(table.accountId),
    index("customer_password_resets_expires_at_idx").on(table.expiresAt),
    index("customer_password_resets_used_at_idx").on(table.usedAt),
    index("customer_password_resets_verified_at_idx").on(table.verifiedAt),
  ],
);
export type CustomerPasswordReset = typeof customerPasswordReset.$inferSelect;
export type NewCustomerPasswordReset =
  typeof customerPasswordReset.$inferInsert;

export const customerSession = pgTable(
  "customer_sessions",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references((): AnyPgColumn => customerAccount.id, {
        onDelete: "cascade",
      }),
    websiteId: uuid("website_id")
      .notNull()
      .references((): AnyPgColumn => website.id, { onDelete: "cascade" }),

    refreshTokenHash: text("refresh_token_hash").unique().notNull(),
    expiresAt: timestamp("expires_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    }).notNull(),
    revokedAt: timestamp("revoked_at", {
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
  },
  (table) => [
    index("customer_sessions_account_id_idx").on(table.accountId),
    index("customer_sessions_website_id_idx").on(table.websiteId),
    index("customer_sessions_expires_at_idx").on(table.expiresAt),
    index("customer_sessions_revoked_at_idx").on(table.revokedAt),
  ],
);
export type CustomerSession = typeof customerSession.$inferSelect;
export type NewCustomerSession = typeof customerSession.$inferInsert;

export const customerWishlist = pgTable(
  "customer_wishlist_items",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references((): AnyPgColumn => customer.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references((): AnyPgColumn => product.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(
      (): AnyPgColumn => productVariant.id,
      { onDelete: "cascade" },
    ),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("customer_wishlist_customer_product_no_variant_unique")
      .on(table.businessId, table.customerId, table.productId)
      .where(sql`${table.variantId} IS NULL`),
    uniqueIndex("customer_wishlist_customer_product_variant_unique")
      .on(table.businessId, table.customerId, table.productId, table.variantId)
      .where(sql`${table.variantId} IS NOT NULL`),
    index("customer_wishlist_business_id_idx").on(table.businessId),
    index("customer_wishlist_customer_id_idx").on(table.customerId),
    index("customer_wishlist_product_id_idx").on(table.productId),
    index("customer_wishlist_variant_id_idx").on(table.variantId),
  ],
);
export type CustomerWishlist = typeof customerWishlist.$inferSelect;
export type NewCustomerWishlist = typeof customerWishlist.$inferInsert;
