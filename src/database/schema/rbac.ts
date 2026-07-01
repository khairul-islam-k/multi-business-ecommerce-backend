import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  index,
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

export const RbacFeature = {
  MEDIA_MANAGEMENT: "MEDIA_MANAGEMENT",
  PACKAGE_MANAGEMENT: "PACKAGE_MANAGEMENT",
  PRODUCT_MANAGEMENT: "PRODUCT_MANAGEMENT",
  SUPPLIER_MANAGEMENT: "SUPPLIER_MANAGEMENT",
  INVENTORY_MANAGEMENT: "INVENTORY_MANAGEMENT",
  ORDER_MANAGEMENT: "ORDER_MANAGEMENT",
  POS_MANAGEMENT: "POS_MANAGEMENT",
  PAYMENT_MANAGEMENT: "PAYMENT_MANAGEMENT",
  FINANCE_MANAGEMENT: "FINANCE_MANAGEMENT",
  COURIER_MANAGEMENT: "COURIER_MANAGEMENT",
  BUSINESS_MANAGEMENT: "BUSINESS_MANAGEMENT",
  EMPLOYEE_MANAGEMENT: "EMPLOYEE_MANAGEMENT",
  ROLE_PERMISSION_MANAGEMENT: "ROLE_PERMISSION_MANAGEMENT",
  WEBSITE_MANAGEMENT: "WEBSITE_MANAGEMENT",
} as const;
export type RbacFeature = (typeof RbacFeature)[keyof typeof RbacFeature];
export const rbacFeatureEnum = pgEnum("RbacFeature", [
  "MEDIA_MANAGEMENT",
  "PACKAGE_MANAGEMENT",
  "PRODUCT_MANAGEMENT",
  "SUPPLIER_MANAGEMENT",
  "INVENTORY_MANAGEMENT",
  "ORDER_MANAGEMENT",
  "POS_MANAGEMENT",
  "PAYMENT_MANAGEMENT",
  "FINANCE_MANAGEMENT",
  "COURIER_MANAGEMENT",
  "BUSINESS_MANAGEMENT",
  "EMPLOYEE_MANAGEMENT",
  "ROLE_PERMISSION_MANAGEMENT",
  "WEBSITE_MANAGEMENT",
]);

export const PermissionAction = {
  CREATE: "CREATE",
  READ: "READ",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
} as const;
export type PermissionAction =
  (typeof PermissionAction)[keyof typeof PermissionAction];
export const permissionActionEnum = pgEnum("PermissionAction", [
  "CREATE",
  "READ",
  "UPDATE",
  "DELETE",
]);

export const CommonStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type CommonStatus = (typeof CommonStatus)[keyof typeof CommonStatus];
export const commonStatusEnum = pgEnum("CommonStatus", ["ACTIVE", "INACTIVE"]);

export const UserRoleMapStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
} as const;
export type UserRoleMapStatus =
  (typeof UserRoleMapStatus)[keyof typeof UserRoleMapStatus];
export const userRoleMapStatusEnum = pgEnum("UserRoleMapStatus", [
  "ACTIVE",
  "INACTIVE",
  "EXPIRED",
  "REVOKED",
]);

export const rbacRole = pgTable(
  "rbac_roles",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    name: varchar({ length: 100 }).notNull(),
    description: text(),
    status: commonStatusEnum().notNull(),
    createdById: uuid("created_by").references(
      (): AnyPgColumn => systemUser.id,
      { onDelete: "set null" },
    ),
    updatedById: uuid("updated_by").references(
      (): AnyPgColumn => systemUser.id,
      { onDelete: "set null" },
    ),
    deletedById: uuid("deleted_by").references(
      (): AnyPgColumn => systemUser.id,
      { onDelete: "set null" },
    ),
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
    deletedAt: timestamp("deleted_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    uniqueIndex("rbac_roles_business_id_name_unique_idx")
      .on(table.businessId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index("rbac_roles_business_id_idx").on(table.businessId),
    index("rbac_roles_status_idx").on(table.status),
    index("rbac_roles_deleted_at_idx").on(table.deletedAt),
  ],
);
export type RbacRole = typeof rbacRole.$inferSelect;
export type NewRbacRole = typeof rbacRole.$inferInsert;

export const rbacRolePermission = pgTable(
  "rbac_role_permissions",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references((): AnyPgColumn => rbacRole.id, { onDelete: "cascade" }),
    feature: rbacFeatureEnum().notNull(),
    action: permissionActionEnum().notNull(),
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
  },
  (table) => [
    uniqueIndex("rbac_role_permissions_role_id_feature_action_unique").on(
      table.roleId,
      table.feature,
      table.action,
    ),
    index("rbac_role_permissions_role_id_idx").on(table.roleId),
    index("rbac_role_permissions_feature_idx").on(table.feature),
    index("rbac_role_permissions_action_idx").on(table.action),
  ],
);
export type RbacRolePermission = typeof rbacRolePermission.$inferSelect;
export type NewRbacRolePermission = typeof rbacRolePermission.$inferInsert;

export const rbacUserRoleMap = pgTable(
  "rbac_user_role_map",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references((): AnyPgColumn => systemUser.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references((): AnyPgColumn => rbacRole.id, { onDelete: "cascade" }),
    status: userRoleMapStatusEnum().notNull(),
    assignedBy: uuid("assigned_by").references(
      (): AnyPgColumn => systemUser.id,
      { onDelete: "set null" },
    ),
    assignedAt: timestamp("assigned_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", {
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
  },
  (table) => [
    uniqueIndex("rbac_user_role_map_user_id_role_id_unique").on(
      table.userId,
      table.roleId,
    ),
    index("rbac_user_role_map_user_id_idx").on(table.userId),
    index("rbac_user_role_map_role_id_idx").on(table.roleId),
    index("rbac_user_role_map_status_idx").on(table.status),
    index("rbac_user_role_map_expires_at_idx").on(table.expiresAt),
  ],
);
export type RbacUserRoleMap = typeof rbacUserRoleMap.$inferSelect;
export type NewRbacUserRoleMap = typeof rbacUserRoleMap.$inferInsert;
