import Decimal from "decimal.js";
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
import { decimal, JsonValue } from "./common";
import { systemUser } from "./system";

export const CourierProvider = {
  PATHAO: "PATHAO",
  REDX: "REDX",
  STEADFAST: "STEADFAST",
} as const;
export type CourierProvider =
  (typeof CourierProvider)[keyof typeof CourierProvider];
export const courierProviderEnum = pgEnum("CourierProvider", [
  "PATHAO",
  "REDX",
  "STEADFAST",
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
  SANDBOX: "SANDBOX",
  LIVE: "LIVE",
} as const;
export type CourierConfigMode =
  (typeof CourierConfigMode)[keyof typeof CourierConfigMode];
export const courierConfigModeEnum = pgEnum("CourierConfigMode", [
  "SANDBOX",
  "LIVE",
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

export const CourierDeliveryZoneStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type CourierDeliveryZoneStatus =
  (typeof CourierDeliveryZoneStatus)[keyof typeof CourierDeliveryZoneStatus];
export const courierDeliveryZoneStatusEnum = pgEnum(
  "CourierDeliveryZoneStatus",
  ["ACTIVE", "INACTIVE"],
);

export const CourierAreaType = {
  DIVISION: "DIVISION",
  DISTRICT: "DISTRICT",
  UPAZILA: "UPAZILA",
  UNION: "UNION",
} as const;
export type CourierAreaType =
  (typeof CourierAreaType)[keyof typeof CourierAreaType];
export const courierAreaTypeEnum = pgEnum("CourierAreaType", [
  "DIVISION",
  "DISTRICT",
  "UPAZILA",
  "UNION",
]);

export const CourierShippingChargeStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type CourierShippingChargeStatus =
  (typeof CourierShippingChargeStatus)[keyof typeof CourierShippingChargeStatus];
export const courierShippingChargeStatusEnum = pgEnum(
  "CourierShippingChargeStatus",
  ["ACTIVE", "INACTIVE"],
);

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

export const CourierReceivableStatus = {
  PENDING: "PENDING",
  PARTIALLY_SETTLED: "PARTIALLY_SETTLED",
  SETTLED: "SETTLED",
  DISPUTED: "DISPUTED",
} as const;
export type CourierReceivableStatus =
  (typeof CourierReceivableStatus)[keyof typeof CourierReceivableStatus];
export const courierReceivableStatusEnum = pgEnum("CourierReceivableStatus", [
  "PENDING",
  "PARTIALLY_SETTLED",
  "SETTLED",
  "DISPUTED",
]);

export const CourierSettlementStatus = {
  DRAFT: "DRAFT",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
} as const;
export type CourierSettlementStatus =
  (typeof CourierSettlementStatus)[keyof typeof CourierSettlementStatus];
export const courierSettlementStatusEnum = pgEnum("CourierSettlementStatus", [
  "DRAFT",
  "CONFIRMED",
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
    mode: courierConfigModeEnum().default("SANDBOX").notNull(),
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
    index("courier_configs_business_id_idx").on(table.businessId),
    index("courier_configs_courier_id_idx").on(table.courierId),
    index("courier_configs_status_idx").on(table.status),
  ],
);
export type CourierConfig = typeof courierConfig.$inferSelect;
export type NewCourierConfig = typeof courierConfig.$inferInsert;

export const courierDeliveryZone = pgTable(
  "courier_delivery_zones",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    name: varchar({ length: 150 }).notNull(),
    description: text(),
    status: courierDeliveryZoneStatusEnum().default("ACTIVE").notNull(),
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
    uniqueIndex("courier_delivery_zones_business_id_name_active_unique")
      .on(table.businessId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index("courier_delivery_zones_business_id_idx").on(table.businessId),
    index("courier_delivery_zones_status_idx").on(table.status),
  ],
);
export type CourierDeliveryZone = typeof courierDeliveryZone.$inferSelect;
export type NewCourierDeliveryZone = typeof courierDeliveryZone.$inferInsert;

export const courierAreaCatalog = pgTable(
  "courier_area_catalog",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    source: varchar({ length: 50 }).notNull(),
    externalId: varchar("external_id", { length: 80 }).notNull(),
    areaType: courierAreaTypeEnum("area_type").notNull(),
    name: varchar({ length: 150 }).notNull(),
    bnName: varchar("bn_name", { length: 150 }),
    divisionName: varchar("division_name", { length: 150 }),
    districtName: varchar("district_name", { length: 150 }),
    upazilaName: varchar("upazila_name", { length: 150 }),
    parentExternalId: varchar("parent_external_id", { length: 80 }),
    rawData: jsonb("raw_data")
      .$type<JsonValue>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("courier_area_catalog_source_type_external_id_unique").on(
      table.source,
      table.areaType,
      table.externalId,
    ),
    index("courier_area_catalog_source_idx").on(table.source),
    index("courier_area_catalog_area_type_idx").on(table.areaType),
    index("courier_area_catalog_name_idx").on(table.name),
    index("courier_area_catalog_division_name_idx").on(table.divisionName),
    index("courier_area_catalog_district_name_idx").on(table.districtName),
    index("courier_area_catalog_upazila_name_idx").on(table.upazilaName),
  ],
);
export type CourierAreaCatalog = typeof courierAreaCatalog.$inferSelect;
export type NewCourierAreaCatalog = typeof courierAreaCatalog.$inferInsert;

export const courierDeliveryZoneArea = pgTable(
  "courier_delivery_zone_areas",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    deliveryZoneId: uuid("delivery_zone_id")
      .notNull()
      .references((): AnyPgColumn => courierDeliveryZone.id, {
        onDelete: "cascade",
      }),
    catalogAreaId: uuid("catalog_area_id").references(
      (): AnyPgColumn => courierAreaCatalog.id,
      { onDelete: "set null" },
    ),
    areaName: varchar("area_name", { length: 150 }).notNull(),
    city: varchar({ length: 100 }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("courier_delivery_zone_areas_delivery_zone_id_idx").on(
      table.deliveryZoneId,
    ),
    uniqueIndex("courier_delivery_zone_areas_zone_catalog_area_unique").on(
      table.deliveryZoneId,
      table.catalogAreaId,
    ),
    index("courier_delivery_zone_areas_catalog_area_id_idx").on(
      table.catalogAreaId,
    ),
    index("courier_delivery_zone_areas_city_idx").on(table.city),
  ],
);
export type CourierDeliveryZoneArea =
  typeof courierDeliveryZoneArea.$inferSelect;
export type NewCourierDeliveryZoneArea =
  typeof courierDeliveryZoneArea.$inferInsert;

export const courierShippingCharge = pgTable(
  "courier_shipping_charges",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    deliveryZoneId: uuid("delivery_zone_id")
      .notNull()
      .references((): AnyPgColumn => courierDeliveryZone.id, {
        onDelete: "cascade",
      }),
    courierId: uuid("courier_id").references((): AnyPgColumn => courier.id, {
      onDelete: "set null",
    }),
    minWeight: decimal("min_weight", { precision: 10, scale: 3 }),
    maxWeight: decimal("max_weight", { precision: 10, scale: 3 }),
    shippingCharge: decimal("shipping_charge", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    codCharge: decimal("cod_charge", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    status: courierShippingChargeStatusEnum().default("ACTIVE").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("courier_shipping_charges_business_id_idx").on(table.businessId),
    index("courier_shipping_charges_delivery_zone_id_idx").on(
      table.deliveryZoneId,
    ),
    index("courier_shipping_charges_courier_id_idx").on(table.courierId),
    index("courier_shipping_charges_status_idx").on(table.status),
  ],
);
export type CourierShippingCharge = typeof courierShippingCharge.$inferSelect;
export type NewCourierShippingCharge =
  typeof courierShippingCharge.$inferInsert;

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
    deliveryZoneId: uuid("delivery_zone_id").references(
      (): AnyPgColumn => courierDeliveryZone.id,
      { onDelete: "set null" },
    ),
    shipmentNo: varchar("shipment_no", { length: 100 }).notNull(),
    consignmentId: varchar("consignment_id", { length: 150 }),
    trackingCode: varchar("tracking_code", { length: 150 }),
    status: courierShipmentStatusEnum().default("PENDING").notNull(),
    shippingCharge: decimal("shipping_charge", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    codAmount: decimal("cod_amount", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    courierFee: decimal("courier_fee", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    recipientName: varchar("recipient_name", { length: 150 }),
    recipientPhone: varchar("recipient_phone", { length: 30 }),
    deliveryAddressSnapshot: jsonb(
      "delivery_address_snapshot",
    ).$type<JsonValue>(),
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
    uniqueIndex("courier_shipments_consignment_id_active_unique")
      .on(table.consignmentId)
      .where(
        sql`${table.consignmentId} IS NOT NULL AND ${table.deletedAt} IS NULL`,
      ),
    index("courier_shipments_business_id_idx").on(table.businessId),
    index("courier_shipments_order_id_idx").on(table.orderId),
    index("courier_shipments_courier_id_idx").on(table.courierId),
    index("courier_shipments_courier_config_id_idx").on(table.courierConfigId),
    index("courier_shipments_delivery_zone_id_idx").on(table.deliveryZoneId),
    index("courier_shipments_status_idx").on(table.status),
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

export const courierReceivable = pgTable(
  "courier_receivables",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    courierId: uuid("courier_id")
      .notNull()
      .references((): AnyPgColumn => courier.id, { onDelete: "restrict" }),
    shipmentId: uuid("shipment_id")
      .unique()
      .notNull()
      .references((): AnyPgColumn => courierShipment.id, {
        onDelete: "cascade",
      }),
    orderId: uuid("order_id").notNull(),
    codAmount: decimal("cod_amount", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    courierFee: decimal("courier_fee", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    netReceivable: decimal("net_receivable", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    status: courierReceivableStatusEnum().default("PENDING").notNull(),
    expectedSettlementDate: timestamp("expected_settlement_date", {
      mode: "date",
    }),
    settledAt: timestamp("settled_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("courier_receivables_business_id_idx").on(table.businessId),
    index("courier_receivables_courier_id_idx").on(table.courierId),
    index("courier_receivables_order_id_idx").on(table.orderId),
    index("courier_receivables_status_idx").on(table.status),
    index("courier_receivables_expected_settlement_date_idx").on(
      table.expectedSettlementDate,
    ),
  ],
);
export type CourierReceivable = typeof courierReceivable.$inferSelect;
export type NewCourierReceivable = typeof courierReceivable.$inferInsert;

export const courierSettlement = pgTable(
  "courier_settlements",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    courierId: uuid("courier_id")
      .notNull()
      .references((): AnyPgColumn => courier.id, { onDelete: "restrict" }),
    settlementNo: varchar("settlement_no", { length: 100 }).notNull(),
    settlementDate: timestamp("settlement_date", { mode: "date" }).notNull(),
    totalCodAmount: decimal("total_cod_amount", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    totalCourierFee: decimal("total_courier_fee", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    totalSettlementAmount: decimal("total_settlement_amount", {
      precision: 12,
      scale: 2,
    })
      .default(new Decimal(0))
      .notNull(),
    status: courierSettlementStatusEnum().default("DRAFT").notNull(),
    referenceNo: varchar("reference_no", { length: 150 }),
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
    uniqueIndex("courier_settlements_business_settlement_no_active_unique")
      .on(table.businessId, table.settlementNo)
      .where(sql`${table.deletedAt} IS NULL`),
    index("courier_settlements_business_id_idx").on(table.businessId),
    index("courier_settlements_courier_id_idx").on(table.courierId),
    index("courier_settlements_settlement_date_idx").on(table.settlementDate),
    index("courier_settlements_status_idx").on(table.status),
  ],
);
export type CourierSettlement = typeof courierSettlement.$inferSelect;
export type NewCourierSettlement = typeof courierSettlement.$inferInsert;

export const courierSettlementItem = pgTable(
  "courier_settlement_items",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    settlementId: uuid("settlement_id")
      .notNull()
      .references((): AnyPgColumn => courierSettlement.id, {
        onDelete: "cascade",
      }),
    receivableId: uuid("receivable_id")
      .notNull()
      .references((): AnyPgColumn => courierReceivable.id, {
        onDelete: "restrict",
      }),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references((): AnyPgColumn => courierShipment.id, {
        onDelete: "restrict",
      }),
    codAmount: decimal("cod_amount", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    courierFee: decimal("courier_fee", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    settlementAmount: decimal("settlement_amount", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("courier_settlement_items_receivable_id_unique").on(
      table.receivableId,
    ),
    index("courier_settlement_items_settlement_id_idx").on(table.settlementId),
    index("courier_settlement_items_shipment_id_idx").on(table.shipmentId),
  ],
);
export type CourierSettlementItem = typeof courierSettlementItem.$inferSelect;
export type NewCourierSettlementItem =
  typeof courierSettlementItem.$inferInsert;
