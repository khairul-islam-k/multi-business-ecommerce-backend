import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { decimal, JsonValue } from "./common";
import {
  paymentGateway,
  paymentGatewayConfigStatusEnum,
  paymentGatewayModeEnum,
  paymentWebhookStatusEnum,
} from "./payment_gateway";
import { systemUser } from "./system";

export const PackageBillingCycle = {
  FREE: "FREE",
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
  LIFETIME: "LIFETIME",
} as const;
export type PackageBillingCycle =
  (typeof PackageBillingCycle)[keyof typeof PackageBillingCycle];
export const packageBillingCycleEnum = pgEnum("PackageBillingCycle", [
  "FREE",
  "MONTHLY",
  "YEARLY",
  "LIFETIME",
]);

export const PackageStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  ARCHIVED: "ARCHIVED",
} as const;
export type PackageStatus = (typeof PackageStatus)[keyof typeof PackageStatus];
export const packageStatusEnum = pgEnum("PackageStatus", [
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED",
]);

export const PackageResetCycle = {
  LIFETIME: "LIFETIME",
  DAILY: "DAILY",
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
} as const;
export type PackageResetCycle =
  (typeof PackageResetCycle)[keyof typeof PackageResetCycle];
export const packageResetCycleEnum = pgEnum("PackageResetCycle", [
  "LIFETIME",
  "DAILY",
  "MONTHLY",
  "YEARLY",
]);

export const PackageLimitKey = {
  MAX_MEDIAS: "MAX_MEDIAS",
  MAX_PRODUCTS: "MAX_PRODUCTS",
  MAX_EMPLOYEES: "MAX_EMPLOYEES",
  MAX_BUSINESSES: "MAX_BUSINESSES",
} as const;
export type PackageLimitKey =
  (typeof PackageLimitKey)[keyof typeof PackageLimitKey];
export const packageLimitKeyEnum = pgEnum("PackageLimitKey", [
  "MAX_MEDIAS",
  "MAX_PRODUCTS",
  "MAX_EMPLOYEES",
  "MAX_BUSINESSES",
]);

export const PackageSubscriptionStatus = {
  TRIALING: "TRIALING",
  ACTIVE: "ACTIVE",
  PAST_DUE: "PAST_DUE",
  SUPERSEDED: "SUPERSEDED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;
export type PackageSubscriptionStatus =
  (typeof PackageSubscriptionStatus)[keyof typeof PackageSubscriptionStatus];
export const packageSubscriptionStatusEnum = pgEnum(
  "PackageSubscriptionStatus",
  ["TRIALING", "ACTIVE", "PAST_DUE", "SUPERSEDED", "CANCELLED", "EXPIRED"],
);

export const PackagePaymentStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  FAILED: "FAILED",
} as const;
export type PackagePaymentStatus =
  (typeof PackagePaymentStatus)[keyof typeof PackagePaymentStatus];
export const packagePaymentStatusEnum = pgEnum("PackagePaymentStatus", [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
  "FAILED",
]);

export const PackagePaymentType = {
  PLAN_CHANGE: "PLAN_CHANGE",
  CREDIT_ONLY_PLAN_CHANGE: "CREDIT_ONLY_PLAN_CHANGE",
} as const;
export type PackagePaymentType =
  (typeof PackagePaymentType)[keyof typeof PackagePaymentType];
export const packagePaymentTypeEnum = pgEnum("PackagePaymentType", [
  "PLAN_CHANGE",
  "CREDIT_ONLY_PLAN_CHANGE",
]);

export const PackageCreditEntryType = {
  DOWNGRADE_CREDIT: "DOWNGRADE_CREDIT",
  CREDIT_APPLIED: "CREDIT_APPLIED",
  ADMIN_ADJUSTMENT: "ADMIN_ADJUSTMENT",
} as const;
export type PackageCreditEntryType =
  (typeof PackageCreditEntryType)[keyof typeof PackageCreditEntryType];
export const packageCreditEntryTypeEnum = pgEnum("PackageCreditEntryType", [
  "DOWNGRADE_CREDIT",
  "CREDIT_APPLIED",
  "ADMIN_ADJUSTMENT",
]);

export const packagePlan = pgTable(
  "package_plans",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    name: varchar({ length: 150 }).notNull(),
    description: text(),
    price: decimal({ precision: 12, scale: 2 }).notNull(),
    billingCycle: packageBillingCycleEnum("billing_cycle").notNull(),
    currencyCode: varchar("currency_code", { length: 10 }).notNull(),
    freeTrialDays: integer("free_trial_days").notNull(),
    isDefault: boolean("is_default").notNull(),
    status: packageStatusEnum().notNull(),
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
    uniqueIndex("package_plans_name_unique")
      .on(table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index("package_plans_is_default_idx").on(table.isDefault),
    index("package_plans_status_idx").on(table.status),
  ],
);
export type PackagePlan = typeof packagePlan.$inferSelect;
export type NewPackagePlan = typeof packagePlan.$inferInsert;

export const packagePlanFeature = pgTable(
  "package_plan_features",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    packageId: uuid("package_id")
      .notNull()
      .references((): AnyPgColumn => packagePlan.id, { onDelete: "cascade" }),
    title: varchar({ length: 255 }).notNull(),
    description: text(),
    isActive: boolean("is_active").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("package_plan_features_package_id_idx").on(table.packageId),
    index("package_plan_features_is_active_idx").on(table.isActive),
  ],
);
export type PackagePlanFeature = typeof packagePlanFeature.$inferSelect;
export type NewPackagePlanFeature = typeof packagePlanFeature.$inferInsert;

export const packagePlanLimit = pgTable(
  "package_plan_limits",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    packageId: uuid("package_id")
      .notNull()
      .references((): AnyPgColumn => packagePlan.id, { onDelete: "cascade" }),
    limitKey: packageLimitKeyEnum("limit_key").notNull(),
    limitValue: integer("limit_value").notNull(),
    resetCycle: packageResetCycleEnum("reset_cycle").notNull(),
    description: text(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("package_plan_limits_package_id_limit_key_unique").on(
      table.packageId,
      table.limitKey,
    ),
    index("package_plan_limits_limit_key_idx").on(table.limitKey),
  ],
);
export type PackagePlanLimit = typeof packagePlanLimit.$inferSelect;
export type NewPackagePlanLimit = typeof packagePlanLimit.$inferInsert;

export const packageSubscription = pgTable(
  "package_subscriptions",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references((): AnyPgColumn => systemUser.id, { onDelete: "cascade" }),
    packageId: uuid("package_id")
      .notNull()
      .references((): AnyPgColumn => packagePlan.id, {}),
    planSnapshot: jsonb("plan_snapshot").$type<JsonValue>(),
    status: packageSubscriptionStatusEnum().notNull(),
    billingCycle: packageBillingCycleEnum("billing_cycle").notNull(),
    price: decimal({ precision: 12, scale: 2 }).notNull(),
    currencyCode: varchar("currency_code", { length: 10 }).notNull(),
    startedAt: timestamp("started_at", { mode: "date" }).notNull(),
    trialEndsAt: timestamp("trial_ends_at", { mode: "date" }),
    currentPeriodStart: timestamp("current_period_start", {
      mode: "date",
    }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", {
      mode: "date",
    }).notNull(),
    endedAt: timestamp("ended_at", { mode: "date" }),
    endReason: text("end_reason"),
    autoRenew: boolean("auto_renew").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("package_subscriptions_tenant_id_idx").on(table.tenantId),
    index("package_subscriptions_package_id_idx").on(table.packageId),
    index("package_subscriptions_status_idx").on(table.status),
    index("package_subscriptions_current_period_end_idx").on(
      table.currentPeriodEnd,
    ),
  ],
);
export type PackageSubscription = typeof packageSubscription.$inferSelect;
export type NewPackageSubscription = typeof packageSubscription.$inferInsert;

export const packagePaymentGatewayConfig = pgTable(
  "package_payment_gateway_configs",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    gatewayId: uuid("gateway_id")
      .notNull()
      .references((): AnyPgColumn => paymentGateway.id, {
        onDelete: "restrict",
      }),
    configData: jsonb("config_data").$type<JsonValue>().notNull(),
    mode: paymentGatewayModeEnum().notNull(),
    status: paymentGatewayConfigStatusEnum().notNull(),
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
    uniqueIndex("package_payment_gateway_configs_gateway_active_unique")
      .on(table.gatewayId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("package_payment_gateway_configs_gateway_id_idx").on(table.gatewayId),
    index("package_payment_gateway_configs_status_idx").on(table.status),
  ],
);
export type PackagePaymentGatewayConfig =
  typeof packagePaymentGatewayConfig.$inferSelect;
export type NewPackagePaymentGatewayConfig =
  typeof packagePaymentGatewayConfig.$inferInsert;

export const packageTenantCreditLedger = pgTable(
  "package_tenant_credit_ledger",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references((): AnyPgColumn => systemUser.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(
      (): AnyPgColumn => packageSubscription.id,
      { onDelete: "set null" },
    ),
    paymentId: uuid("payment_id").references(
      (): AnyPgColumn => packagePayment.id,
      { onDelete: "set null" },
    ),
    type: packageCreditEntryTypeEnum().notNull(),
    amount: decimal({ precision: 12, scale: 2 }).notNull(),
    currencyCode: varchar("currency_code", { length: 10 }).notNull(),
    note: text(),
    metadata: jsonb().$type<JsonValue>(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("package_tenant_credit_ledger_tenant_id_idx").on(table.tenantId),
    index("package_tenant_credit_ledger_subscription_id_idx").on(
      table.subscriptionId,
    ),
    index("package_tenant_credit_ledger_payment_id_idx").on(table.paymentId),
  ],
);
export type PackageTenantCreditLedger =
  typeof packageTenantCreditLedger.$inferSelect;
export type NewPackageTenantCreditLedger =
  typeof packageTenantCreditLedger.$inferInsert;

export const packageUsageCounter = pgTable(
  "package_usage_counters",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references((): AnyPgColumn => packageSubscription.id, {
        onDelete: "cascade",
      }),
    limitKey: packageLimitKeyEnum("limit_key").notNull(),
    usedValue: integer("used_value").default(0).notNull(),
    periodStart: timestamp("period_start", { mode: "date" }).notNull(),
    periodEnd: timestamp("period_end", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex(
      "package_usage_counters_subscription_id_limit_key_period_start_period_end_unique",
    ).on(
      table.subscriptionId,
      table.limitKey,
      table.periodStart,
      table.periodEnd,
    ),
    index("package_usage_counters_limit_key_idx").on(table.limitKey),
    index("package_usage_counters_period_start_period_end_idx").on(
      table.periodStart,
      table.periodEnd,
    ),
  ],
);
export type PackageUsageCounter = typeof packageUsageCounter.$inferSelect;
export type NewPackageUsageCounter = typeof packageUsageCounter.$inferInsert;

export const packagePayment = pgTable(
  "package_payments",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references((): AnyPgColumn => systemUser.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(
      (): AnyPgColumn => packageSubscription.id,
      { onDelete: "set null" },
    ),
    planId: uuid("plan_id").references((): AnyPgColumn => packagePlan.id, {
      onDelete: "set null",
    }),
    type: packagePaymentTypeEnum().notNull(),
    status: packagePaymentStatusEnum().notNull(),
    paymentNo: varchar("payment_no", { length: 100 }),
    amount: decimal({ precision: 12, scale: 2 }).notNull(),
    currencyCode: varchar("currency_code", { length: 10 }).notNull(),
    gatewayConfigId: uuid("gateway_config_id").references(
      (): AnyPgColumn => packagePaymentGatewayConfig.id,
      { onDelete: "set null" },
    ),
    gatewaySessionId: varchar("gateway_session_id", { length: 255 }),
    gatewayTransactionId: varchar("gateway_transaction_id", { length: 255 }),
    gatewayEventId: varchar("gateway_event_id", { length: 255 }),
    gatewayPayload: jsonb("gateway_payload").$type<JsonValue>(),
    metadata: jsonb().$type<JsonValue>(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    confirmedAt: timestamp("confirmed_at", { mode: "date" }),
    failedAt: timestamp("failed_at", { mode: "date" }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("package_payments_tenant_id_idx").on(table.tenantId),
    index("package_payments_subscription_id_idx").on(table.subscriptionId),
    index("package_payments_plan_id_idx").on(table.planId),
    index("package_payments_status_idx").on(table.status),
    uniqueIndex("package_payments_payment_no_unique")
      .on(table.paymentNo)
      .where(sql`${table.paymentNo} IS NOT NULL`),
    index("package_payments_gateway_config_id_idx").on(table.gatewayConfigId),
    index("package_payments_gateway_session_id_idx").on(table.gatewaySessionId),
    index("package_payments_gateway_transaction_id_idx").on(
      table.gatewayTransactionId,
    ),
    index("package_payments_gateway_event_id_idx").on(table.gatewayEventId),
    index("package_payments_expires_at_idx").on(table.expiresAt),
  ],
);
export type PackagePayment = typeof packagePayment.$inferSelect;
export type NewPackagePayment = typeof packagePayment.$inferInsert;

export const packagePaymentWebhookEvent = pgTable(
  "package_payment_webhook_events",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    gatewayId: uuid("gateway_id")
      .notNull()
      .references((): AnyPgColumn => paymentGateway.id, {
        onDelete: "restrict",
      }),
    packagePaymentId: uuid("package_payment_id").references(
      (): AnyPgColumn => packagePayment.id,
      { onDelete: "cascade" },
    ),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    eventId: varchar("event_id", { length: 150 }),
    payload: jsonb().$type<JsonValue>().notNull(),
    status: paymentWebhookStatusEnum().notNull(),
    processedAt: timestamp("processed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("package_payment_webhook_events_gateway_id_idx").on(table.gatewayId),
    index("package_payment_webhook_events_payment_id_idx").on(
      table.packagePaymentId,
    ),
    index("package_payment_webhook_events_event_type_idx").on(table.eventType),
    index("package_payment_webhook_events_event_id_idx").on(table.eventId),
    index("package_payment_webhook_events_status_idx").on(table.status),
    index("package_payment_webhook_events_created_at_idx").on(table.createdAt),
  ],
);
export type PackagePaymentWebhookEvent =
  typeof packagePaymentWebhookEvent.$inferSelect;
export type NewPackagePaymentWebhookEvent =
  typeof packagePaymentWebhookEvent.$inferInsert;
