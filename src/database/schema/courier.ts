import Decimal from "decimal.js";
import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  index,
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
import { decimal, JsonValue } from "./common";
import { warehouse } from "./inventory";
import { systemUser } from "./system";

export const CourierProvider = {
  REDX: "REDX",
  PATHAO: "PATHAO",
} as const;
export type CourierProvider =
  (typeof CourierProvider)[keyof typeof CourierProvider];
export const courierProviderEnum = pgEnum("CourierProvider", [
  "REDX",
  "PATHAO",
]);

export const CourierStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type CourierStatus = (typeof CourierStatus)[keyof typeof CourierStatus];
export const courierStatusEnum = pgEnum("CourierStatus", [
  "ACTIVE",
  "INACTIVE",
]);

export const CourierConfigMode = {
  LIVE: "LIVE",
  SANDBOX: "SANDBOX",
} as const;
export type CourierConfigMode =
  (typeof CourierConfigMode)[keyof typeof CourierConfigMode];
export const courierConfigModeEnum = pgEnum("CourierConfigMode", [
  "LIVE",
  "SANDBOX",
]);

export const CourierConfigStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type CourierConfigStatus =
  (typeof CourierConfigStatus)[keyof typeof CourierConfigStatus];
export const courierConfigStatusEnum = pgEnum("CourierConfigStatus", [
  "ACTIVE",
  "INACTIVE",
]);

export const CourierShipmentStatus = {
  PENDING: "PENDING",
  BOOKED: "BOOKED",
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
  RETURNED: "RETURNED",
  CANCELLED: "CANCELLED",
} as const;
export type CourierShipmentStatus =
  (typeof CourierShipmentStatus)[keyof typeof CourierShipmentStatus];
export const courierShipmentStatusEnum = pgEnum("CourierShipmentStatus", [
  "PENDING",
  "BOOKED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
  "RETURNED",
  "CANCELLED",
]);

export const courier = pgTable(
  "couriers",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    name: varchar({ length: 150 }).notNull(),
    code: courierProviderEnum().notNull(),
    description: text(),
    status: courierStatusEnum().default("ACTIVE").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("courier_couriers_name_unique").on(table.name),
    uniqueIndex("courier_couriers_code_unique").on(table.code),
    index("courier_couriers_status_idx").on(table.status),
  ],
);
export type Courier = typeof courier.$inferSelect;
export type NewCourier = typeof courier.$inferInsert;

export const courierConfig = pgTable(
  "courier_configs",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    courierId: uuid("courier_id")
      .notNull()
      .references((): AnyPgColumn => courier.id, { onDelete: "restrict" }),
    configData: jsonb("config_data").$type<JsonValue>().notNull(),
    webhookTokenHash: varchar("webhook_token_hash", { length: 128 }),
    mode: courierConfigModeEnum().default("LIVE").notNull(),
    status: courierConfigStatusEnum().default("INACTIVE").notNull(),
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
    uniqueIndex("courier_configs_business_courier_active_unique")
      .on(table.businessId, table.courierId)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("courier_configs_webhook_token_hash_unique")
      .on(table.webhookTokenHash)
      .where(sql`${table.webhookTokenHash} IS NOT NULL`),
    index("courier_configs_business_id_idx").on(table.businessId),
    index("courier_configs_courier_id_idx").on(table.courierId),
    index("courier_configs_status_idx").on(table.status),
  ],
);
export type CourierConfig = typeof courierConfig.$inferSelect;
export type NewCourierConfig = typeof courierConfig.$inferInsert;

export const courierShipment = pgTable(
  "courier_shipments",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").notNull(),
    courierId: uuid("courier_id").references((): AnyPgColumn => courier.id, {
      onDelete: "set null",
    }),
    courierConfigId: uuid("courier_config_id").references(
      (): AnyPgColumn => courierConfig.id,
      { onDelete: "set null" },
    ),
    pickupWarehouseId: uuid("pickup_warehouse_id").references(
      (): AnyPgColumn => warehouse.id,
      { onDelete: "set null" },
    ),
    shipmentNo: varchar("shipment_no", { length: 100 }).notNull(),
    consignmentId: varchar("consignment_id", { length: 150 }),
    trackingCode: varchar("tracking_code", { length: 150 }),
    providerStatus: varchar("provider_status", { length: 100 }),
    status: courierShipmentStatusEnum().default("PENDING").notNull(),
    shippingCharge: decimal("shipping_charge", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    codAmount: decimal("cod_amount", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    deliveryCharge: decimal("delivery_charge", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    codCharge: decimal("cod_charge", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    courierFee: decimal("courier_fee", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    recipientName: varchar("recipient_name", { length: 150 }),
    recipientPhone: varchar("recipient_phone", { length: 30 }),
    deliveryAreaId: varchar("delivery_area_id", { length: 80 }),
    deliveryAreaName: varchar("delivery_area_name", { length: 150 }),
    deliveryPostCode: varchar("delivery_post_code", { length: 20 }),
    deliveryDivisionName: varchar("delivery_division_name", { length: 150 }),
    pickupAreaId: varchar("pickup_area_id", { length: 80 }),
    pickupAreaName: varchar("pickup_area_name", { length: 150 }),
    pickupPostCode: varchar("pickup_post_code", { length: 20 }),
    pickupStoreId: varchar("pickup_store_id", { length: 80 }),
    deliveryAddressSnapshot: jsonb(
      "delivery_address_snapshot",
    ).$type<JsonValue>(),
    providerRequest: jsonb("provider_request").$type<JsonValue>(),
    providerResponse: jsonb("provider_response").$type<JsonValue>(),
    lastWebhookPayload: jsonb("last_webhook_payload").$type<JsonValue>(),
    shippedAt: timestamp("shipped_at", { mode: "date" }),
    deliveredAt: timestamp("delivered_at", { mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { mode: "date" }),
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
    uniqueIndex("courier_shipments_business_id_shipment_no_active_unique")
      .on(table.businessId, table.shipmentNo)
      .where(sql`${table.deletedAt} IS NULL`),
    // TODO: re-think this
    // uniqueIndex("courier_shipments_consignment_id_active_unique")
    //   .on(table.consignmentId)
    //   .where(
    //     sql`${table.consignmentId} IS NOT NULL AND ${table.deletedAt} IS NULL`,
    //   ),
    index("courier_shipments_business_id_idx").on(table.businessId),
    index("courier_shipments_order_id_idx").on(table.orderId),
    index("courier_shipments_courier_id_idx").on(table.courierId),
    index("courier_shipments_courier_config_id_idx").on(table.courierConfigId),
    index("courier_shipments_pickup_warehouse_id_idx").on(
      table.pickupWarehouseId,
    ),
    index("courier_shipments_status_idx").on(table.status),
    index("courier_shipments_provider_status_idx").on(table.providerStatus),
    index("courier_shipments_tracking_code_idx").on(table.trackingCode),
  ],
);
export type CourierShipment = typeof courierShipment.$inferSelect;
export type NewCourierShipment = typeof courierShipment.$inferInsert;

export const courierShipmentItem = pgTable(
  "courier_shipment_items",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references((): AnyPgColumn => courierShipment.id, {
        onDelete: "cascade",
      }),
    orderItemId: uuid("order_item_id").notNull(),
    productId: uuid("product_id").notNull(),
    variantId: uuid("variant_id"),
    quantity: decimal({ precision: 14, scale: 3 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("courier_shipment_items_shipment_id_idx").on(table.shipmentId),
    index("courier_shipment_items_order_item_id_idx").on(table.orderItemId),
    index("courier_shipment_items_product_id_idx").on(table.productId),
    index("courier_shipment_items_variant_id_idx").on(table.variantId),
  ],
);
export type CourierShipmentItem = typeof courierShipmentItem.$inferSelect;
export type NewCourierShipmentItem = typeof courierShipmentItem.$inferInsert;
