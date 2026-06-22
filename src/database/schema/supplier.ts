import {
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
import { sql } from "drizzle-orm";

import { business } from "./business";
import { decimal } from "./common";
import { financeTax } from "./finance";
import { product, productVariant } from "./product";
import { systemUser } from "./system";

export const SupplierStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type SupplierStatus =
  (typeof SupplierStatus)[keyof typeof SupplierStatus];
export const supplierStatusEnum = pgEnum("SupplierStatus", [
  "ACTIVE",
  "INACTIVE",
]);

export const SupplierProductMapStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type SupplierProductMapStatus =
  (typeof SupplierProductMapStatus)[keyof typeof SupplierProductMapStatus];
export const supplierProductMapStatusEnum = pgEnum("SupplierProductMapStatus", [
  "ACTIVE",
  "INACTIVE",
]);

export const SupplierPurchaseOrderStatus = {
  DRAFT: "DRAFT",
  ORDERED: "ORDERED",
  RECEIVED: "RECEIVED",
  CANCELLED: "CANCELLED",
} as const;
export type SupplierPurchaseOrderStatus =
  (typeof SupplierPurchaseOrderStatus)[keyof typeof SupplierPurchaseOrderStatus];
export const supplierPurchaseOrderStatusEnum = pgEnum(
  "SupplierPurchaseOrderStatus",
  ["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"],
);

export const SupplierInvoiceStatus = {
  UNPAID: "UNPAID",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
} as const;
export type SupplierInvoiceStatus =
  (typeof SupplierInvoiceStatus)[keyof typeof SupplierInvoiceStatus];
export const supplierInvoiceStatusEnum = pgEnum("SupplierInvoiceStatus", [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
]);

export const SupplierPaymentMethod = {
  CASH: "CASH",
  BANK_TRANSFER: "BANK_TRANSFER",
  BKASH: "BKASH",
  NAGAD: "NAGAD",
  CHEQUE: "CHEQUE",
  OTHER: "OTHER",
} as const;
export type SupplierPaymentMethod =
  (typeof SupplierPaymentMethod)[keyof typeof SupplierPaymentMethod];
export const supplierPaymentMethodEnum = pgEnum("SupplierPaymentMethod", [
  "CASH",
  "BANK_TRANSFER",
  "BKASH",
  "NAGAD",
  "CHEQUE",
  "OTHER",
]);

export const SupplierPurchaseReturnStatus = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type SupplierPurchaseReturnStatus =
  (typeof SupplierPurchaseReturnStatus)[keyof typeof SupplierPurchaseReturnStatus];
export const supplierPurchaseReturnStatusEnum = pgEnum(
  "SupplierPurchaseReturnStatus",
  ["DRAFT", "PENDING", "COMPLETED", "CANCELLED"],
);

export const supplier = pgTable(
  "suppliers",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    name: varchar({ length: 150 }).notNull(),
    companyName: varchar("company_name", { length: 150 }),
    email: varchar({ length: 150 }),
    phone: varchar({ length: 30 }),
    address: text(),
    city: varchar({ length: 100 }),
    country: varchar({ length: 100 }),
    status: supplierStatusEnum().notNull(),
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
    uniqueIndex("suppliers_business_id_name_deleted_at_unique")
      .on(table.businessId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index("suppliers_business_id_idx").on(table.businessId),
    index("suppliers_status_idx").on(table.status),
    index("suppliers_phone_idx").on(table.phone),
    index("suppliers_email_idx").on(table.email),
  ],
);
export type Supplier = typeof supplier.$inferSelect;
export type NewSupplier = typeof supplier.$inferInsert;

export const supplierProductMap = pgTable(
  "supplier_product_map",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references((): AnyPgColumn => supplier.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull(),
    variantId: uuid("variant_id"),
    itemKey: varchar("item_key", { length: 80 }).notNull(),
    supplierSku: varchar("supplier_sku", { length: 100 }),
    lastPurchasePrice: decimal("last_purchase_price", {
      precision: 12,
      scale: 2,
    }),
    minOrderQuantity: decimal("min_order_quantity", {
      precision: 14,
      scale: 3,
    }),
    leadTimeDays: integer("lead_time_days"),
    status: supplierProductMapStatusEnum().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex(
      "supplier_product_map_business_id_supplier_id_product_id_item_key_unique",
    ).on(table.businessId, table.supplierId, table.productId, table.itemKey),
    index("supplier_product_map_business_id_idx").on(table.businessId),
    index("supplier_product_map_supplier_id_idx").on(table.supplierId),
    index("supplier_product_map_product_id_idx").on(table.productId),
    index("supplier_product_map_variant_id_idx").on(table.variantId),
    index("supplier_product_map_status_idx").on(table.status),
  ],
);
export type SupplierProductMap = typeof supplierProductMap.$inferSelect;
export type NewSupplierProductMap = typeof supplierProductMap.$inferInsert;

export const supplierPurchaseOrder = pgTable(
  "supplier_purchase_orders",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references((): AnyPgColumn => supplier.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id").notNull(),
    taxId: uuid("tax_id")
      .notNull()
      .references((): AnyPgColumn => financeTax.id, { onDelete: "restrict" }),
    purchaseOrderNo: varchar("purchase_order_no", { length: 100 }).notNull(),
    orderDate: timestamp("order_date", { mode: "date" }).notNull(),
    expectedDeliveryDate: timestamp("expected_delivery_date", { mode: "date" }),
    status: supplierPurchaseOrderStatusEnum().notNull(),
    subtotal: decimal({ precision: 12, scale: 2 }).notNull(),
    discountTotal: decimal("discount_total", {
      precision: 12,
      scale: 2,
    }).notNull(),
    // TODO: Can I normalize it by removing the following two fields?
    taxTotal: decimal("tax_total", { precision: 12, scale: 2 }).notNull(),
    taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull(),
    shippingCost: decimal("shipping_cost", {
      precision: 12,
      scale: 2,
    }).notNull(),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
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
      "supplier_purchase_orders_business_id_purchase_order_no_deleted_at_unique",
    )
      .on(table.businessId, table.purchaseOrderNo)
      .where(sql`${table.deletedAt} IS NULL`),
    index("supplier_purchase_orders_business_id_idx").on(table.businessId),
    index("supplier_purchase_orders_supplier_id_idx").on(table.supplierId),
    index("supplier_purchase_orders_warehouse_id_idx").on(table.warehouseId),
    index("supplier_purchase_orders_tax_id_idx").on(table.taxId),
    index("supplier_purchase_orders_status_idx").on(table.status),
    index("supplier_purchase_orders_order_date_idx").on(table.orderDate),
  ],
);
export type SupplierPurchaseOrder = typeof supplierPurchaseOrder.$inferSelect;
export type NewSupplierPurchaseOrder =
  typeof supplierPurchaseOrder.$inferInsert;

export const supplierPurchaseOrderItem = pgTable(
  "supplier_purchase_order_items",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references((): AnyPgColumn => supplierPurchaseOrder.id, {
        onDelete: "cascade",
      }),
    productId: uuid("product_id")
      .notNull()
      .references((): AnyPgColumn => product.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(
      (): AnyPgColumn => productVariant.id,
      { onDelete: "set null" },
    ),
    quantityOrdered: decimal("quantity_ordered", {
      precision: 14,
      scale: 3,
    }).notNull(),
    quantityReceived: decimal("quantity_received", {
      precision: 14,
      scale: 3,
    }).notNull(),
    unitCost: decimal("unit_cost", { precision: 12, scale: 2 }).notNull(),
    discountAmount: decimal("discount_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull(),
    lineTotal: decimal("line_total", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("supplier_purchase_order_items_purchase_order_id_idx").on(
      table.purchaseOrderId,
    ),
    index("supplier_purchase_order_items_product_id_idx").on(table.productId),
    index("supplier_purchase_order_items_variant_id_idx").on(table.variantId),
  ],
);
export type SupplierPurchaseOrderItem =
  typeof supplierPurchaseOrderItem.$inferSelect;
export type NewSupplierPurchaseOrderItem =
  typeof supplierPurchaseOrderItem.$inferInsert;

export const supplierInvoice = pgTable(
  "supplier_invoices",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references((): AnyPgColumn => supplier.id, { onDelete: "restrict" }),
    purchaseOrderId: uuid("purchase_order_id").references(
      (): AnyPgColumn => supplierPurchaseOrder.id,
      { onDelete: "set null" },
    ),
    taxId: uuid("tax_id").references((): AnyPgColumn => financeTax.id, {
      onDelete: "restrict",
    }),
    invoiceNo: varchar("invoice_no", { length: 100 }).notNull(),
    invoiceDate: timestamp("invoice_date", { mode: "date" }).notNull(),
    dueDate: timestamp("due_date", { mode: "date" }),
    status: supplierInvoiceStatusEnum().notNull(),
    subtotal: decimal({ precision: 12, scale: 2 }).notNull(),
    discountTotal: decimal("discount_total", {
      precision: 12,
      scale: 2,
    }).notNull(),
    // TODO: Can I normalize it by removing the following two fields?
    taxTotal: decimal("tax_total", { precision: 12, scale: 2 }).notNull(),
    taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull(),
    shippingCost: decimal("shipping_cost", {
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
    uniqueIndex("supplier_invoices_business_id_invoice_no_unique").on(
      table.businessId,
      table.invoiceNo,
    ),
    index("supplier_invoices_business_id_idx").on(table.businessId),
    index("supplier_invoices_supplier_id_idx").on(table.supplierId),
    index("supplier_invoices_purchase_order_id_idx").on(table.purchaseOrderId),
    index("supplier_invoices_tax_id_idx").on(table.taxId),
    index("supplier_invoices_status_idx").on(table.status),
    index("supplier_invoices_invoice_date_idx").on(table.invoiceDate),
    index("supplier_invoices_due_date_idx").on(table.dueDate),
  ],
);
export type SupplierInvoice = typeof supplierInvoice.$inferSelect;
export type NewSupplierInvoice = typeof supplierInvoice.$inferInsert;

export const supplierInvoiceItem = pgTable(
  "supplier_invoice_items",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    supplierInvoiceId: uuid("supplier_invoice_id")
      .notNull()
      .references((): AnyPgColumn => supplierInvoice.id, {
        onDelete: "cascade",
      }),
    productId: uuid("product_id").notNull(),
    variantId: uuid("variant_id"),
    quantity: decimal({ precision: 14, scale: 3 }).notNull(),
    unitCost: decimal("unit_cost", { precision: 12, scale: 2 }).notNull(),
    discountAmount: decimal("discount_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull(),
    lineTotal: decimal("line_total", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("supplier_invoice_items_supplier_invoice_id_idx").on(
      table.supplierInvoiceId,
    ),
    index("supplier_invoice_items_product_id_idx").on(table.productId),
    index("supplier_invoice_items_variant_id_idx").on(table.variantId),
  ],
);
export type SupplierInvoiceItem = typeof supplierInvoiceItem.$inferSelect;
export type NewSupplierInvoiceItem = typeof supplierInvoiceItem.$inferInsert;

export const supplierPayment = pgTable(
  "supplier_payments",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references((): AnyPgColumn => supplier.id, { onDelete: "restrict" }),
    supplierInvoiceId: uuid("supplier_invoice_id")
      .notNull()
      .references((): AnyPgColumn => supplierInvoice.id, {
        onDelete: "restrict",
      }),
    paymentNo: varchar("payment_no", { length: 100 }).notNull(),
    amount: decimal({ precision: 12, scale: 2 }).notNull(),
    paymentDate: timestamp("payment_date", { mode: "date" }).notNull(),
    paymentMethod: supplierPaymentMethodEnum("payment_method").notNull(),
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
    uniqueIndex("supplier_payments_business_id_payment_no_unique").on(
      table.businessId,
      table.paymentNo,
    ),
    index("supplier_payments_business_id_idx").on(table.businessId),
    index("supplier_payments_supplier_id_idx").on(table.supplierId),
    index("supplier_payments_supplier_invoice_id_idx").on(
      table.supplierInvoiceId,
    ),
    index("supplier_payments_payment_date_idx").on(table.paymentDate),
  ],
);
export type SupplierPayment = typeof supplierPayment.$inferSelect;
export type NewSupplierPayment = typeof supplierPayment.$inferInsert;

export const supplierPurchaseReturn = pgTable(
  "supplier_purchase_returns",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references((): AnyPgColumn => supplier.id, { onDelete: "restrict" }),
    purchaseOrderId: uuid("purchase_order_id").references(
      (): AnyPgColumn => supplierPurchaseOrder.id,
      { onDelete: "set null" },
    ),
    supplierInvoiceId: uuid("supplier_invoice_id").references(
      (): AnyPgColumn => supplierInvoice.id,
      { onDelete: "set null" },
    ),
    warehouseId: uuid("warehouse_id").notNull(),
    taxId: uuid("tax_id").references((): AnyPgColumn => financeTax.id, {
      onDelete: "restrict",
    }),
    returnNo: varchar("return_no", { length: 100 }).notNull(),
    returnDate: timestamp("return_date", { mode: "date" }).notNull(),
    status: supplierPurchaseReturnStatusEnum().notNull(),
    reason: text(),
    subtotal: decimal({ precision: 12, scale: 2 }).notNull(),
    discountTotal: decimal("discount_total", {
      precision: 12,
      scale: 2,
    }).notNull(),
    // TODO: Can I normalize it by removing the following two fields?
    taxTotal: decimal("tax_total", { precision: 12, scale: 2 }).notNull(),
    taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull(),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("supplier_purchase_returns_business_id_return_no_unique").on(
      table.businessId,
      table.returnNo,
    ),
    index("supplier_purchase_returns_business_id_idx").on(table.businessId),
    index("supplier_purchase_returns_supplier_id_idx").on(table.supplierId),
    index("supplier_purchase_returns_purchase_order_id_idx").on(
      table.purchaseOrderId,
    ),
    index("supplier_purchase_returns_supplier_invoice_id_idx").on(
      table.supplierInvoiceId,
    ),
    index("supplier_purchase_returns_warehouse_id_idx").on(table.warehouseId),
    index("supplier_purchase_returns_tax_id_idx").on(table.taxId),
    index("supplier_purchase_returns_status_idx").on(table.status),
    index("supplier_purchase_returns_return_date_idx").on(table.returnDate),
  ],
);
export type SupplierPurchaseReturn = typeof supplierPurchaseReturn.$inferSelect;
export type NewSupplierPurchaseReturn =
  typeof supplierPurchaseReturn.$inferInsert;

export const supplierPurchaseReturnItem = pgTable(
  "supplier_purchase_return_items",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    purchaseReturnId: uuid("purchase_return_id")
      .notNull()
      .references((): AnyPgColumn => supplierPurchaseReturn.id, {
        onDelete: "cascade",
      }),
    productId: uuid("product_id").notNull(),
    variantId: uuid("variant_id"),
    quantity: decimal({ precision: 14, scale: 3 }).notNull(),
    unitCost: decimal("unit_cost", { precision: 12, scale: 2 }).notNull(),
    discountAmount: decimal("discount_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull(),
    lineTotal: decimal("line_total", { precision: 12, scale: 2 }).notNull(),
    reason: text(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("supplier_purchase_return_items_purchase_return_id_idx").on(
      table.purchaseReturnId,
    ),
    index("supplier_purchase_return_items_product_id_idx").on(table.productId),
    index("supplier_purchase_return_items_variant_id_idx").on(table.variantId),
  ],
);
export type SupplierPurchaseReturnItem =
  typeof supplierPurchaseReturnItem.$inferSelect;
export type NewSupplierPurchaseReturnItem =
  typeof supplierPurchaseReturnItem.$inferInsert;
