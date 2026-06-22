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

import { business } from "./business";
import { decimal } from "./common";
import { product, productVariant } from "./product";
import { systemUser } from "./system";

export const WarehouseStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type WarehouseStatus =
  (typeof WarehouseStatus)[keyof typeof WarehouseStatus];
export const warehouseStatusEnum = pgEnum("WarehouseStatus", [
  "ACTIVE",
  "INACTIVE",
]);

export const InventoryMovementType = {
  PURCHASE_IN: "PURCHASE_IN",
  PURCHASE_RETURN_OUT: "PURCHASE_RETURN_OUT",
  SALE_OUT: "SALE_OUT",
  SALE_RETURN_IN: "SALE_RETURN_IN",
  ADJUSTMENT_IN: "ADJUSTMENT_IN",
  ADJUSTMENT_OUT: "ADJUSTMENT_OUT",
  TRANSFER_IN: "TRANSFER_IN",
  TRANSFER_OUT: "TRANSFER_OUT",
  RESERVED: "RESERVED",
  RESERVATION_RELEASED: "RESERVATION_RELEASED",
} as const;
export type InventoryMovementType =
  (typeof InventoryMovementType)[keyof typeof InventoryMovementType];
export const inventoryMovementTypeEnum = pgEnum("InventoryMovementType", [
  "PURCHASE_IN",
  "PURCHASE_RETURN_OUT",
  "SALE_OUT",
  "SALE_RETURN_IN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "RESERVED",
  "RESERVATION_RELEASED",
]);

export const InventoryReferenceType = {
  PURCHASE_ORDER: "PURCHASE_ORDER",
  SUPPLIER_INVOICE: "SUPPLIER_INVOICE",
  PURCHASE_RETURN: "PURCHASE_RETURN",
  ORDER: "ORDER",
  ORDER_RETURN: "ORDER_RETURN",
  STOCK_ADJUSTMENT: "STOCK_ADJUSTMENT",
  STOCK_TRANSFER: "STOCK_TRANSFER",
  MANUAL: "MANUAL",
} as const;
export type InventoryReferenceType =
  (typeof InventoryReferenceType)[keyof typeof InventoryReferenceType];
export const inventoryReferenceTypeEnum = pgEnum("InventoryReferenceType", [
  "PURCHASE_ORDER",
  "SUPPLIER_INVOICE",
  "PURCHASE_RETURN",
  "ORDER",
  "ORDER_RETURN",
  "STOCK_ADJUSTMENT",
  "STOCK_TRANSFER",
  "MANUAL",
]);

export const InventoryAdjustmentType = {
  INCREASE: "INCREASE",
  DECREASE: "DECREASE",
} as const;
export type InventoryAdjustmentType =
  (typeof InventoryAdjustmentType)[keyof typeof InventoryAdjustmentType];
export const inventoryAdjustmentTypeEnum = pgEnum("InventoryAdjustmentType", [
  "INCREASE",
  "DECREASE",
]);

export const InventoryAdjustmentStatus = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;
export type InventoryAdjustmentStatus =
  (typeof InventoryAdjustmentStatus)[keyof typeof InventoryAdjustmentStatus];
export const inventoryAdjustmentStatusEnum = pgEnum(
  "InventoryAdjustmentStatus",
  ["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"],
);

export const InventoryTransferStatus = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  SHIPPED: "SHIPPED",
  RECEIVED: "RECEIVED",
  CANCELLED: "CANCELLED",
} as const;
export type InventoryTransferStatus =
  (typeof InventoryTransferStatus)[keyof typeof InventoryTransferStatus];
export const inventoryTransferStatusEnum = pgEnum("InventoryTransferStatus", [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "SHIPPED",
  "RECEIVED",
  "CANCELLED",
]);

export const InventoryOrderAllocationStatus = {
  RESERVED: "RESERVED",
  FULFILLED: "FULFILLED",
  RELEASED: "RELEASED",
} as const;
export type InventoryOrderAllocationStatus =
  (typeof InventoryOrderAllocationStatus)[keyof typeof InventoryOrderAllocationStatus];
export const inventoryOrderAllocationStatusEnum = pgEnum(
  "InventoryOrderAllocationStatus",
  ["RESERVED", "FULFILLED", "RELEASED"],
);

export const warehouse = pgTable(
  "inventory_warehouses",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    name: varchar({ length: 150 }).notNull(),
    phone: varchar({ length: 30 }),
    address: text(),
    status: warehouseStatusEnum().notNull(),
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
    uniqueIndex("inventory_warehouses_business_id_name_deleted_at_unique")
      .on(table.businessId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index("inventory_warehouses_business_id_idx").on(table.businessId),
    index("inventory_warehouses_status_idx").on(table.status),
    index("inventory_warehouses_deleted_at_idx").on(table.deletedAt),
  ],
);
export type Warehouse = typeof warehouse.$inferSelect;
export type NewWarehouse = typeof warehouse.$inferInsert;

export const inventoryStock = pgTable(
  "inventory_stocks",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references((): AnyPgColumn => product.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(
      (): AnyPgColumn => productVariant.id,
      { onDelete: "set null" },
    ),
    stockItemKey: varchar("stock_item_key", { length: 80 }).notNull(),
    totalQuantity: decimal("total_quantity", {
      precision: 14,
      scale: 3,
    }).notNull(),
    quantityReserved: decimal("quantity_reserved", {
      precision: 14,
      scale: 3,
    }).notNull(),
    lowStockAlertQty: decimal("low_stock_alert_qty", {
      precision: 14,
      scale: 3,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("inventory_stocks_business_id_stock_item_key_unique").on(
      table.businessId,
      table.stockItemKey,
    ),
    index("inventory_stocks_business_id_idx").on(table.businessId),
    index("inventory_stocks_product_id_idx").on(table.productId),
    index("inventory_stocks_variant_id_idx").on(table.variantId),
  ],
);
export type InventoryStock = typeof inventoryStock.$inferSelect;
export type NewInventoryStock = typeof inventoryStock.$inferInsert;

export const inventoryWarehouseStock = pgTable(
  "inventory_warehouse_stocks",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    stockId: uuid("stock_id")
      .notNull()
      .references((): AnyPgColumn => inventoryStock.id, {
        onDelete: "cascade",
      }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references((): AnyPgColumn => warehouse.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull(),
    variantId: uuid("variant_id"),
    stockItemKey: varchar("stock_item_key", { length: 80 }).notNull(),
    totalQuantity: decimal("total_quantity", {
      precision: 14,
      scale: 3,
    }).notNull(),
    quantityReserved: decimal("quantity_reserved", {
      precision: 14,
      scale: 3,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("inventory_wh_stock_by_stock_unique").on(
      table.businessId,
      table.warehouseId,
      table.stockId,
    ),
    uniqueIndex("inventory_wh_stock_by_item_unique").on(
      table.businessId,
      table.warehouseId,
      table.stockItemKey,
    ),
    index("inventory_warehouse_stocks_business_id_idx").on(table.businessId),
    index("inventory_warehouse_stocks_stock_id_idx").on(table.stockId),
    index("inventory_warehouse_stocks_warehouse_id_idx").on(table.warehouseId),
    index("inventory_warehouse_stocks_product_id_idx").on(table.productId),
    index("inventory_warehouse_stocks_variant_id_idx").on(table.variantId),
  ],
);
export type InventoryWarehouseStock =
  typeof inventoryWarehouseStock.$inferSelect;
export type NewInventoryWarehouseStock =
  typeof inventoryWarehouseStock.$inferInsert;

export const inventoryStockMovement = pgTable(
  "inventory_stock_movements",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    stockId: uuid("stock_id")
      .notNull()
      .references((): AnyPgColumn => inventoryStock.id, {
        onDelete: "cascade",
      }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references((): AnyPgColumn => warehouse.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references((): AnyPgColumn => product.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(
      (): AnyPgColumn => productVariant.id,
      { onDelete: "cascade" },
    ),
    stockItemKey: varchar("stock_item_key", { length: 80 }).notNull(),
    movementType: inventoryMovementTypeEnum("movement_type").notNull(),
    quantity: decimal({ precision: 14, scale: 3 }).notNull(),
    referenceType: inventoryReferenceTypeEnum("reference_type"),
    referenceId: uuid("reference_id"),
    note: text(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("inventory_stock_movements_business_id_idx").on(table.businessId),
    index("inventory_stock_movements_stock_id_idx").on(table.stockId),
    index("inventory_stock_movements_warehouse_id_idx").on(table.warehouseId),
    index("inventory_stock_movements_product_id_idx").on(table.productId),
    index("inventory_stock_movements_variant_id_idx").on(table.variantId),
    index("inventory_stock_movements_stock_item_key_idx").on(
      table.stockItemKey,
    ),
    index("inventory_stock_movements_movement_type_idx").on(table.movementType),
    index("inventory_stock_movements_reference_type_reference_id_idx").on(
      table.referenceType,
      table.referenceId,
    ),
    index("inventory_stock_movements_created_at_idx").on(table.createdAt),
  ],
);
export type InventoryStockMovement = typeof inventoryStockMovement.$inferSelect;
export type NewInventoryStockMovement =
  typeof inventoryStockMovement.$inferInsert;

export const inventoryOrderAllocation = pgTable(
  "inventory_order_allocations",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").notNull(),
    orderItemId: uuid("order_item_id").notNull(),
    stockId: uuid("stock_id")
      .notNull()
      .references((): AnyPgColumn => inventoryStock.id, {
        onDelete: "cascade",
      }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references((): AnyPgColumn => warehouse.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull(),
    variantId: uuid("variant_id"),
    stockItemKey: varchar("stock_item_key", { length: 80 }).notNull(),
    quantity: decimal({ precision: 14, scale: 3 }).notNull(),
    status: inventoryOrderAllocationStatusEnum().notNull(),
    createdBy: uuid("created_by"),
    fulfilledAt: timestamp("fulfilled_at", { mode: "date" }),
    releasedAt: timestamp("released_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("inventory_order_allocations_business_id_idx").on(table.businessId),
    index("inventory_order_allocations_order_id_idx").on(table.orderId),
    index("inventory_order_allocations_order_item_id_idx").on(
      table.orderItemId,
    ),
    index("inventory_order_allocations_stock_id_idx").on(table.stockId),
    index("inventory_order_allocations_warehouse_id_idx").on(table.warehouseId),
    index("inventory_order_allocations_product_id_idx").on(table.productId),
    index("inventory_order_allocations_variant_id_idx").on(table.variantId),
    index("inventory_order_allocations_stock_item_key_idx").on(
      table.stockItemKey,
    ),
    index("inventory_order_allocations_status_idx").on(table.status),
  ],
);
export type InventoryOrderAllocation =
  typeof inventoryOrderAllocation.$inferSelect;
export type NewInventoryOrderAllocation =
  typeof inventoryOrderAllocation.$inferInsert;

export const inventoryStockAdjustment = pgTable(
  "inventory_stock_adjustments",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references((): AnyPgColumn => warehouse.id, { onDelete: "cascade" }),
    adjustmentNo: varchar("adjustment_no", { length: 100 }).notNull(),
    adjustmentType: inventoryAdjustmentTypeEnum("adjustment_type").notNull(),
    reason: text(),
    status: inventoryAdjustmentStatusEnum().notNull(),
    createdBy: uuid("created_by").references((): AnyPgColumn => systemUser.id, {
      onDelete: "set null",
    }),
    approvedBy: uuid("approved_by").references(
      (): AnyPgColumn => systemUser.id,
      { onDelete: "set null" },
    ),
    deletedBy: uuid("deleted_by").references((): AnyPgColumn => systemUser.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [
    uniqueIndex(
      "inventory_stock_adjustments_business_id_adjustment_no_deleted_at_unique",
    )
      .on(table.businessId, table.adjustmentNo)
      .where(sql`${table.deletedAt} IS NULL`),
    index("inventory_stock_adjustments_business_id_idx").on(table.businessId),
    index("inventory_stock_adjustments_warehouse_id_idx").on(table.warehouseId),
    index("inventory_stock_adjustments_adjustment_type_idx").on(
      table.adjustmentType,
    ),
    index("inventory_stock_adjustments_status_idx").on(table.status),
  ],
);
export type InventoryStockAdjustment =
  typeof inventoryStockAdjustment.$inferSelect;
export type NewInventoryStockAdjustment =
  typeof inventoryStockAdjustment.$inferInsert;

export const inventoryStockAdjustmentItem = pgTable(
  "inventory_stock_adjustment_items",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    adjustmentId: uuid("adjustment_id")
      .notNull()
      .references((): AnyPgColumn => inventoryStockAdjustment.id, {
        onDelete: "cascade",
      }),
    productId: uuid("product_id").notNull(),
    variantId: uuid("variant_id"),
    oldQuantity: decimal("old_quantity", { precision: 14, scale: 3 }).notNull(),
    adjustmentQty: decimal("adjustment_qty", {
      precision: 14,
      scale: 3,
    }).notNull(),
    reason: text(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("inventory_stock_adjustment_items_adjustment_id_idx").on(
      table.adjustmentId,
    ),
    index("inventory_stock_adjustment_items_product_id_idx").on(
      table.productId,
    ),
    index("inventory_stock_adjustment_items_variant_id_idx").on(
      table.variantId,
    ),
  ],
);
export type InventoryStockAdjustmentItem =
  typeof inventoryStockAdjustmentItem.$inferSelect;
export type NewInventoryStockAdjustmentItem =
  typeof inventoryStockAdjustmentItem.$inferInsert;

export const inventoryStockTransfer = pgTable(
  "inventory_stock_transfers",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    transferNo: varchar("transfer_no", { length: 100 }).notNull(),
    fromWarehouseId: uuid("from_warehouse_id")
      .notNull()
      .references((): AnyPgColumn => warehouse.id, { onDelete: "restrict" }),
    toWarehouseId: uuid("to_warehouse_id")
      .notNull()
      .references((): AnyPgColumn => warehouse.id, { onDelete: "restrict" }),
    status: inventoryTransferStatusEnum().notNull(),
    note: text(),
    createdBy: uuid("created_by").references((): AnyPgColumn => systemUser.id, {
      onDelete: "set null",
    }),
    approvedBy: uuid("approved_by").references(
      (): AnyPgColumn => systemUser.id,
      { onDelete: "set null" },
    ),
    deletedBy: uuid("deleted_by").references((): AnyPgColumn => systemUser.id, {
      onDelete: "set null",
    }),
    shippedAt: timestamp("shipped_at", { mode: "date" }),
    receivedAt: timestamp("received_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [
    uniqueIndex("inventory_stock_transfers_business_id_transfer_no_unique")
      .on(table.businessId, table.transferNo)
      .where(sql`${table.deletedAt} IS NULL`),
    index("inventory_stock_transfers_business_id_idx").on(table.businessId),
    index("inventory_stock_transfers_from_warehouse_id_idx").on(
      table.fromWarehouseId,
    ),
    index("inventory_stock_transfers_to_warehouse_id_idx").on(
      table.toWarehouseId,
    ),
    index("inventory_stock_transfers_status_idx").on(table.status),
  ],
);
export type InventoryStockTransfer = typeof inventoryStockTransfer.$inferSelect;
export type NewInventoryStockTransfer =
  typeof inventoryStockTransfer.$inferInsert;

export const inventoryStockTransferItem = pgTable(
  "inventory_stock_transfer_items",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    transferId: uuid("transfer_id")
      .notNull()
      .references((): AnyPgColumn => inventoryStockTransfer.id, {
        onDelete: "cascade",
      }),
    productId: uuid("product_id").notNull(),
    variantId: uuid("variant_id"),
    requestedQuantity: decimal("requested_quantity", {
      precision: 14,
      scale: 3,
    }).notNull(),
    transferredQuantity: decimal("transferred_quantity", {
      precision: 14,
      scale: 3,
    }).notNull(),
    receivedQuantity: decimal("received_quantity", {
      precision: 14,
      scale: 3,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("inventory_stock_transfer_items_transfer_id_idx").on(
      table.transferId,
    ),
    index("inventory_stock_transfer_items_product_id_idx").on(table.productId),
    index("inventory_stock_transfer_items_variant_id_idx").on(table.variantId),
  ],
);
export type InventoryStockTransferItem =
  typeof inventoryStockTransferItem.$inferSelect;
export type NewInventoryStockTransferItem =
  typeof inventoryStockTransferItem.$inferInsert;
