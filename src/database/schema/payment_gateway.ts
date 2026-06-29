import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
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

import { business } from "./business";
import { JsonValue } from "./common";
import { financeAccount } from "./finance";
import { orderPayment } from "./order";
import { systemUser } from "./system";

export const PaymentGatewayProvider = {
  SSLCOMMERZ: "SSLCOMMERZ",
  AAMARPAY: "AAMARPAY",
  SHURJOPAY: "SHURJOPAY",
} as const;
export type PaymentGatewayProvider =
  (typeof PaymentGatewayProvider)[keyof typeof PaymentGatewayProvider];
export const paymentGatewayProviderEnum = pgEnum("PaymentGatewayProvider", [
  "SSLCOMMERZ",
  "AAMARPAY",
  "SHURJOPAY",
]);

export const PaymentGatewayStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type PaymentGatewayStatus =
  (typeof PaymentGatewayStatus)[keyof typeof PaymentGatewayStatus];
export const paymentGatewayStatusEnum = pgEnum("PaymentGatewayStatus", [
  "ACTIVE",
  "INACTIVE",
]);

export const PaymentGatewayMode = {
  SANDBOX: "SANDBOX",
  LIVE: "LIVE",
} as const;
export type PaymentGatewayMode =
  (typeof PaymentGatewayMode)[keyof typeof PaymentGatewayMode];
export const paymentGatewayModeEnum = pgEnum("PaymentGatewayMode", [
  "SANDBOX",
  "LIVE",
]);

export const PaymentGatewayConfigStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type PaymentGatewayConfigStatus =
  (typeof PaymentGatewayConfigStatus)[keyof typeof PaymentGatewayConfigStatus];
export const paymentGatewayConfigStatusEnum = pgEnum(
  "PaymentGatewayConfigStatus",
  ["ACTIVE", "INACTIVE"],
);

export const PaymentWebhookStatus = {
  PENDING: "PENDING",
  PROCESSED: "PROCESSED",
  FAILED: "FAILED",
  IGNORED: "IGNORED",
} as const;
export type PaymentWebhookStatus =
  (typeof PaymentWebhookStatus)[keyof typeof PaymentWebhookStatus];
export const paymentWebhookStatusEnum = pgEnum("PaymentWebhookStatus", [
  "PENDING",
  "PROCESSED",
  "FAILED",
  "IGNORED",
]);

export const paymentGateway = pgTable(
  "payment_gateways",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    name: varchar({ length: 150 }).notNull(),
    code: paymentGatewayProviderEnum().notNull(),
    description: text(),
    status: paymentGatewayStatusEnum().notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("payment_gateways_code_unique").on(table.code),
    index("payment_gateways_status_idx").on(table.status),
  ],
);
export type PaymentGateway = typeof paymentGateway.$inferSelect;
export type NewPaymentGateway = typeof paymentGateway.$inferInsert;

export const paymentGatewayConfig = pgTable(
  "payment_gateway_configs",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    gatewayId: uuid("gateway_id")
      .notNull()
      .references((): AnyPgColumn => paymentGateway.id, {
        onDelete: "restrict",
      }),
    financeAccountId: uuid("finance_account_id")
      .notNull()
      .references((): AnyPgColumn => financeAccount.id, {
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
    uniqueIndex("payment_gateway_configs_business_gateway_active_unique")
      .on(table.businessId, table.gatewayId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("payment_gateway_configs_business_id_idx").on(table.businessId),
    index("payment_gateway_configs_gateway_id_idx").on(table.gatewayId),
    index("payment_gateway_configs_finance_account_id_idx").on(
      table.financeAccountId,
    ),
    index("payment_gateway_configs_status_idx").on(table.status),
  ],
);
export type PaymentGatewayConfig = typeof paymentGatewayConfig.$inferSelect;
export type NewPaymentGatewayConfig = typeof paymentGatewayConfig.$inferInsert;

export const paymentWebhookEvent = pgTable(
  "payment_webhook_events",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    gatewayId: uuid("gateway_id")
      .notNull()
      .references((): AnyPgColumn => paymentGateway.id, {
        onDelete: "restrict",
      }),
    orderPaymentId: uuid("order_payment_id").references(
      (): AnyPgColumn => orderPayment.id,
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
    index("payment_webhook_events_business_id_idx").on(table.businessId),
    index("payment_webhook_events_gateway_id_idx").on(table.gatewayId),
    index("payment_webhook_events_order_payment_id_idx").on(
      table.orderPaymentId,
    ),
    index("payment_webhook_events_event_type_idx").on(table.eventType),
    index("payment_webhook_events_event_id_idx").on(table.eventId),
    index("payment_webhook_events_status_idx").on(table.status),
    index("payment_webhook_events_created_at_idx").on(table.createdAt),
  ],
);
export type PaymentWebhookEvent = typeof paymentWebhookEvent.$inferSelect;
export type NewPaymentWebhookEvent = typeof paymentWebhookEvent.$inferInsert;
