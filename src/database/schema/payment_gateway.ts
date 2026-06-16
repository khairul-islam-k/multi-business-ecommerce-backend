import {
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
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { type JsonValue } from "./common";

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

export const PaymentMethodType = {
  CASH: "CASH",
  COD: "COD",
  ONLINE: "ONLINE",
  BANK_TRANSFER: "BANK_TRANSFER",
  CARD: "CARD",
  MOBILE_BANKING: "MOBILE_BANKING",
  OTHER: "OTHER",
} as const;
export type PaymentMethodType =
  (typeof PaymentMethodType)[keyof typeof PaymentMethodType];
export const paymentMethodTypeEnum = pgEnum("PaymentMethodType", [
  "CASH",
  "COD",
  "ONLINE",
  "BANK_TRANSFER",
  "CARD",
  "MOBILE_BANKING",
  "OTHER",
]);

export const PaymentMethodStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type PaymentMethodStatus =
  (typeof PaymentMethodStatus)[keyof typeof PaymentMethodStatus];
export const paymentMethodStatusEnum = pgEnum("PaymentMethodStatus", [
  "ACTIVE",
  "INACTIVE",
]);

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
    code: varchar({ length: 100 }).notNull(),
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
    businessId: uuid("business_id").notNull(),
    gatewayId: uuid("gateway_id")
      .notNull()
      .references((): AnyPgColumn => paymentGateway.id, {
        onDelete: "restrict",
      }),
    configData: jsonb("config_data").$type<JsonValue>().notNull(),
    mode: paymentGatewayModeEnum().notNull(),
    status: paymentGatewayConfigStatusEnum().notNull(),
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
    uniqueIndex(
      "payment_gateway_configs_business_id_gateway_id_mode_unique",
    ).on(table.businessId, table.gatewayId, table.mode),
    index("payment_gateway_configs_business_id_idx").on(table.businessId),
    index("payment_gateway_configs_gateway_id_idx").on(table.gatewayId),
    index("payment_gateway_configs_status_idx").on(table.status),
  ],
);
export type PaymentGatewayConfig = typeof paymentGatewayConfig.$inferSelect;
export type NewPaymentGatewayConfig = typeof paymentGatewayConfig.$inferInsert;

export const paymentMethod = pgTable(
  "payment_methods",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id").notNull(),
    gatewayId: uuid("gateway_id").references(
      (): AnyPgColumn => paymentGateway.id,
      { onDelete: "set null" },
    ),
    name: varchar({ length: 150 }).notNull(),
    code: varchar({ length: 100 }).notNull(),
    paymentType: paymentMethodTypeEnum("payment_type").notNull(),
    status: paymentMethodStatusEnum().notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("payment_methods_business_id_code_unique").on(
      table.businessId,
      table.code,
    ),
    index("payment_methods_business_id_idx").on(table.businessId),
    index("payment_methods_gateway_id_idx").on(table.gatewayId),
    index("payment_methods_payment_type_idx").on(table.paymentType),
    index("payment_methods_status_idx").on(table.status),
  ],
);
export type PaymentMethod = typeof paymentMethod.$inferSelect;
export type NewPaymentMethod = typeof paymentMethod.$inferInsert;

export const paymentWebhookEvent = pgTable(
  "payment_webhook_events",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id").notNull(),
    gatewayId: uuid("gateway_id")
      .notNull()
      .references((): AnyPgColumn => paymentGateway.id, {
        onDelete: "restrict",
      }),
    orderPaymentId: uuid("order_payment_id"),
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
