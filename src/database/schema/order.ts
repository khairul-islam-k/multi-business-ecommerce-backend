import Decimal from "decimal.js";
import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
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
} from "drizzle-orm/pg-core";

import { business } from "./business";
import { decimal, JsonValue } from "./common";
import { customer } from "./customer";
import { financeAccount, financeTax } from "./finance";
import { warehouse } from "./inventory";
import { paymentGateway, paymentGatewayConfig } from "./payment_gateway";
import { systemUser } from "./system";

export const OrderCartStatus = {
  ACTIVE: "ACTIVE",
  ORDERED: "ORDERED",
  ABANDONED: "ABANDONED",
  EXPIRED: "EXPIRED",
} as const;
export type OrderCartStatus =
  (typeof OrderCartStatus)[keyof typeof OrderCartStatus];
export const orderCartStatusEnum = pgEnum("OrderCartStatus", [
  "ACTIVE",
  "ORDERED",
  "ABANDONED",
  "EXPIRED",
]);

export const OrderType = {
  ONLINE: "ONLINE",
  POS: "POS",
  ADMIN: "ADMIN",
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];
export const orderTypeEnum = pgEnum("OrderType", ["ONLINE", "POS", "ADMIN"]);

export const OrderSource = {
  WEBSITE: "WEBSITE",
  POS: "POS",
  ADMIN_PANEL: "ADMIN_PANEL",
  MOBILE_APP: "MOBILE_APP",
} as const;
export type OrderSource = (typeof OrderSource)[keyof typeof OrderSource];
export const orderSourceEnum = pgEnum("OrderSource", [
  "WEBSITE",
  "POS",
  "ADMIN_PANEL",
  "MOBILE_APP",
]);

export const OrderStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PROCESSING: "PROCESSING",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  RETURNED: "RETURNED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
export const orderStatusEnum = pgEnum("OrderStatus", [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
]);

export const OrderPaymentStatus = {
  PENDING: "PENDING",
  UNPAID: "UNPAID",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
} as const;
export type OrderPaymentStatus =
  (typeof OrderPaymentStatus)[keyof typeof OrderPaymentStatus];
export const orderPaymentStatusEnum = pgEnum("OrderPaymentStatus", [
  "PENDING",
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);

export const OrderDiscountType = {
  FIXED: "FIXED",
  PERCENTAGE: "PERCENTAGE",
} as const;
export type OrderDiscountType =
  (typeof OrderDiscountType)[keyof typeof OrderDiscountType];
export const orderDiscountTypeEnum = pgEnum("OrderDiscountType", [
  "FIXED",
  "PERCENTAGE",
]);

export const OrderDiscountSource = {
  MANUAL: "MANUAL",
  COUPON: "COUPON",
  PROMOTION: "PROMOTION",
} as const;
export type OrderDiscountSource =
  (typeof OrderDiscountSource)[keyof typeof OrderDiscountSource];
export const orderDiscountSourceEnum = pgEnum("OrderDiscountSource", [
  "MANUAL",
  "COUPON",
  "PROMOTION",
]);

export const OrderPaymentMethod = {
  CASH: "CASH",
  COD: "COD",
  BKASH: "BKASH",
  NAGAD: "NAGAD",
  CARD: "CARD",
  BANK_TRANSFER: "BANK_TRANSFER",
  OTHER: "OTHER",
} as const;
export type OrderPaymentMethod =
  (typeof OrderPaymentMethod)[keyof typeof OrderPaymentMethod];
export const orderPaymentMethodEnum = pgEnum("OrderPaymentMethod", [
  "CASH",
  "COD",
  "BKASH",
  "NAGAD",
  "CARD",
  "BANK_TRANSFER",
  "OTHER",
]);

export const OrderReturnStatus = {
  REQUESTED: "REQUESTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderReturnStatus =
  (typeof OrderReturnStatus)[keyof typeof OrderReturnStatus];
export const orderReturnStatusEnum = pgEnum("OrderReturnStatus", [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
  "CANCELLED",
]);

export const OrderRefundMethod = {
  CASH: "CASH",
  BKASH: "BKASH",
  NAGAD: "NAGAD",
  CARD: "CARD",
  BANK_TRANSFER: "BANK_TRANSFER",
  OTHER: "OTHER",
} as const;
export type OrderRefundMethod =
  (typeof OrderRefundMethod)[keyof typeof OrderRefundMethod];
export const orderRefundMethodEnum = pgEnum("OrderRefundMethod", [
  "CASH",
  "BKASH",
  "NAGAD",
  "CARD",
  "BANK_TRANSFER",
  "OTHER",
]);

export const OrderRefundStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderRefundStatus =
  (typeof OrderRefundStatus)[keyof typeof OrderRefundStatus];
export const orderRefundStatusEnum = pgEnum("OrderRefundStatus", [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export const orderCart = pgTable(
  "order_carts",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references((): AnyPgColumn => customer.id, {
      onDelete: "set null",
    }),
    sessionId: varchar("session_id", { length: 150 }),
    status: orderCartStatusEnum().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }),
  },
  (table) => [
    index("order_carts_business_id_idx").on(table.businessId),
    index("order_carts_customer_id_idx").on(table.customerId),
    index("order_carts_session_id_idx").on(table.sessionId),
    index("order_carts_status_idx").on(table.status),
    uniqueIndex("order_carts_active_customer_unique")
      .on(table.businessId, table.customerId)
      .where(
        sql`${table.customerId} IS NOT NULL AND ${table.status} = 'ACTIVE'`,
      ),
  ],
);
export type OrderCart = typeof orderCart.$inferSelect;
export type NewOrderCart = typeof orderCart.$inferInsert;

export const orderCartItem = pgTable(
  "order_cart_items",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    cartId: uuid("cart_id")
      .notNull()
      .references((): AnyPgColumn => orderCart.id, { onDelete: "cascade" }),
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
    index("order_cart_items_cart_id_idx").on(table.cartId),
    index("order_cart_items_product_id_idx").on(table.productId),
    index("order_cart_items_variant_id_idx").on(table.variantId),
  ],
);
export type OrderCartItem = typeof orderCartItem.$inferSelect;
export type NewOrderCartItem = typeof orderCartItem.$inferInsert;

export const order = pgTable(
  "orders",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references((): AnyPgColumn => customer.id, {
      onDelete: "set null",
    }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references((): AnyPgColumn => warehouse.id, { onDelete: "restrict" }),
    taxId: uuid("tax_id").references((): AnyPgColumn => financeTax.id, {
      onDelete: "restrict",
    }),
    orderNo: varchar("order_no", { length: 100 }).notNull(),
    orderType: orderTypeEnum("order_type").notNull(),
    orderSource: orderSourceEnum("order_source").notNull(),
    status: orderStatusEnum().notNull(),
    paymentStatus: orderPaymentStatusEnum("payment_status").notNull(),
    isCod: boolean("is_cod").default(false).notNull(),
    customerName: varchar("customer_name", { length: 150 }),
    customerPhone: varchar("customer_phone", { length: 30 }),
    customerEmail: varchar("customer_email", { length: 150 }),
    shippingAddressSnapshot: jsonb(
      "shipping_address_snapshot",
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
    uniqueIndex("orders_business_id_order_no_active_unique")
      .on(table.businessId, table.orderNo)
      .where(sql`${table.deletedAt} IS NULL`),
    index("orders_business_id_idx").on(table.businessId),
    index("orders_customer_id_idx").on(table.customerId),
    index("orders_warehouse_id_idx").on(table.warehouseId),
    index("orders_tax_id_idx").on(table.taxId),
    index("orders_status_idx").on(table.status),
    index("orders_payment_status_idx").on(table.paymentStatus),
    index("orders_created_at_idx").on(table.createdAt),
  ],
);
export type Order = typeof order.$inferSelect;
export type NewOrder = typeof order.$inferInsert;

export const orderItem = pgTable(
  "order_items",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    orderId: uuid("order_id")
      .notNull()
      .references((): AnyPgColumn => order.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull(),
    variantId: uuid("variant_id"),
    taxId: uuid("tax_id")
      .notNull()
      .references((): AnyPgColumn => financeTax.id, { onDelete: "restrict" }),
    quantity: decimal({ precision: 14, scale: 3 }).notNull(),
    unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
    discountAmount: decimal("discount_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull(),
    taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull(),
    lineTotal: decimal("line_total", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_product_id_idx").on(table.productId),
    index("order_items_variant_id_idx").on(table.variantId),
    index("order_items_tax_id_idx").on(table.taxId),
  ],
);
export type OrderItem = typeof orderItem.$inferSelect;
export type NewOrderItem = typeof orderItem.$inferInsert;

export const orderStatusLog = pgTable(
  "order_status_logs",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    orderId: uuid("order_id")
      .notNull()
      .references((): AnyPgColumn => order.id, { onDelete: "cascade" }),
    fromStatus: orderStatusEnum("from_status"),
    toStatus: orderStatusEnum("to_status").notNull(),
    note: text(),
    changedBy: uuid("changed_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("order_status_logs_order_id_idx").on(table.orderId),
    index("order_status_logs_to_status_idx").on(table.toStatus),
    index("order_status_logs_created_at_idx").on(table.createdAt),
  ],
);
export type OrderStatusLog = typeof orderStatusLog.$inferSelect;
export type NewOrderStatusLog = typeof orderStatusLog.$inferInsert;

export const orderDiscount = pgTable(
  "order_discounts",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    orderId: uuid("order_id")
      .notNull()
      .references((): AnyPgColumn => order.id, { onDelete: "cascade" }),
    discountType: orderDiscountTypeEnum("discount_type").notNull(),
    discountSource: orderDiscountSourceEnum("discount_source").notNull(),
    code: varchar({ length: 100 }),
    amount: decimal({ precision: 12, scale: 2 }).notNull(),
    note: text(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("order_discounts_order_id_idx").on(table.orderId),
    index("order_discounts_code_idx").on(table.code),
  ],
);
export type OrderDiscount = typeof orderDiscount.$inferSelect;
export type NewOrderDiscount = typeof orderDiscount.$inferInsert;

export const orderPayment = pgTable(
  "order_payments",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references((): AnyPgColumn => order.id, { onDelete: "cascade" }),
    financeAccountId: uuid("finance_account_id").references(
      (): AnyPgColumn => financeAccount.id,
      { onDelete: "restrict" },
    ),
    gatewayId: uuid("gateway_id").references(
      (): AnyPgColumn => paymentGateway.id,
      { onDelete: "set null" },
    ),
    gatewayConfigId: uuid("gateway_config_id").references(
      (): AnyPgColumn => paymentGatewayConfig.id,
      { onDelete: "set null" },
    ),
    paymentNo: varchar("payment_no", { length: 100 }).notNull(),
    amount: decimal({ precision: 12, scale: 2 }).notNull(),
    paymentMethod: orderPaymentMethodEnum("payment_method").notNull(),
    paymentStatus: orderPaymentStatusEnum("payment_status")
      .default("UNPAID")
      .notNull(),
    transactionReference: varchar("transaction_reference", { length: 150 }),
    gatewayTransactionId: varchar("gateway_transaction_id", { length: 150 }),
    gatewaySessionId: varchar("gateway_session_id", { length: 150 }),
    gatewayEventId: varchar("gateway_event_id", { length: 150 }),
    gatewayPayload: jsonb("gateway_payload").$type<JsonValue>(),
    paidAt: timestamp("paid_at", { mode: "date" }),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("order_payments_business_id_payment_no_unique").on(
      table.businessId,
      table.paymentNo,
    ),
    index("order_payments_business_id_idx").on(table.businessId),
    index("order_payments_order_id_idx").on(table.orderId),
    index("order_payments_finance_account_id_idx").on(table.financeAccountId),
    index("order_payments_gateway_id_idx").on(table.gatewayId),
    index("order_payments_gateway_config_id_idx").on(table.gatewayConfigId),
    index("order_payments_payment_method_idx").on(table.paymentMethod),
    index("order_payments_payment_status_idx").on(table.paymentStatus),
    index("order_payments_gateway_session_id_idx").on(table.gatewaySessionId),
    uniqueIndex("order_payments_business_id_gateway_transaction_unique")
      .on(table.businessId, table.gatewayTransactionId)
      .where(sql`${table.gatewayTransactionId} IS NOT NULL`),
    uniqueIndex("order_payments_business_id_gateway_event_unique")
      .on(table.businessId, table.gatewayEventId)
      .where(sql`${table.gatewayEventId} IS NOT NULL`),
    index("order_payments_paid_at_idx").on(table.paidAt),
  ],
);
export type OrderPayment = typeof orderPayment.$inferSelect;
export type NewOrderPayment = typeof orderPayment.$inferInsert;

export const orderReturn = pgTable(
  "order_returns",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references((): AnyPgColumn => order.id, { onDelete: "cascade" }),
    returnNo: varchar("return_no", { length: 100 }).notNull(),
    status: orderReturnStatusEnum().default("REQUESTED").notNull(),
    reason: text(),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 })
      .default(new Decimal(0))
      .notNull(),
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
    uniqueIndex("order_returns_business_id_return_no_active_unique")
      .on(table.businessId, table.returnNo)
      .where(sql`${table.deletedAt} IS NULL`),
    index("order_returns_business_id_idx").on(table.businessId),
    index("order_returns_order_id_idx").on(table.orderId),
    index("order_returns_status_idx").on(table.status),
  ],
);
export type OrderReturn = typeof orderReturn.$inferSelect;
export type NewOrderReturn = typeof orderReturn.$inferInsert;

export const orderReturnItem = pgTable(
  "order_return_items",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    returnId: uuid("return_id")
      .notNull()
      .references((): AnyPgColumn => orderReturn.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references((): AnyPgColumn => orderItem.id, {
        onDelete: "restrict",
      }),
    productId: uuid("product_id").notNull(),
    variantId: uuid("variant_id"),
    quantity: decimal({ precision: 14, scale: 3 }).notNull(),
    unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
    lineTotal: decimal("line_total", { precision: 12, scale: 2 }).notNull(),
    reason: text(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("order_return_items_return_id_idx").on(table.returnId),
    index("order_return_items_order_item_id_idx").on(table.orderItemId),
    index("order_return_items_product_id_idx").on(table.productId),
    index("order_return_items_variant_id_idx").on(table.variantId),
  ],
);
export type OrderReturnItem = typeof orderReturnItem.$inferSelect;
export type NewOrderReturnItem = typeof orderReturnItem.$inferInsert;
