import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  timestamp,
  index,
  text,
  boolean,
  AnyPgColumn,
} from "drizzle-orm/pg-core";

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

export const customer = pgTable(
  "customers",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id").notNull(),
    name: varchar({ length: 150 }).notNull(),
    email: varchar({ length: 150 }),
    phone: varchar({ length: 30 }),
    status: customerStatusEnum().notNull(),
    note: text(),
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
    index("customers_business_id_idx").on(table.businessId),
    index("customers_phone_idx").on(table.phone),
    index("customers_email_idx").on(table.email),
    index("customers_status_idx").on(table.status),
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
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [
    index("customer_addresses_customer_id_idx").on(table.customerId),
    index("customer_addresses_address_type_idx").on(table.addressType),
    index("customer_addresses_is_default_idx").on(table.isDefault),
  ],
);
export type CustomerAddress = typeof customerAddress.$inferSelect;
export type NewCustomerAddress = typeof customerAddress.$inferInsert;
