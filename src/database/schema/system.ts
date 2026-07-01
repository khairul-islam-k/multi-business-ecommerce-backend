import {
  AnyPgColumn,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { business } from "./business";
import { JsonValue } from "./common";

export const SystemUserType = {
  ADMIN: "ADMIN",
  TENANT: "TENANT",
  EMPLOYEE: "EMPLOYEE",
} as const;
export type SystemUserType =
  (typeof SystemUserType)[keyof typeof SystemUserType];
export const systemUserTypeEnum = pgEnum("SystemUserType", [
  "ADMIN",
  "TENANT",
  "EMPLOYEE",
]);

export const SystemUserStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;
export type SystemUserStatus =
  (typeof SystemUserStatus)[keyof typeof SystemUserStatus];
export const systemUserStatusEnum = pgEnum("SystemUserStatus", [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
]);

export const Gender = {
  MALE: "MALE",
  FEMALE: "FEMALE",
  OTHER: "OTHER",
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];
export const genderEnum = pgEnum("Gender", ["MALE", "FEMALE", "OTHER"]);

export const OtpPurpose = {
  EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
  PASSWORD_RESET: "PASSWORD_RESET",
  EMAIL_CHANGE: "EMAIL_CHANGE",
} as const;
export type OtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];
export const otpPurposeEnum = pgEnum("OtpPurpose", [
  "EMAIL_VERIFICATION",
  "PASSWORD_RESET",
  "EMAIL_CHANGE",
]);

export const systemUser = pgTable(
  "system_users",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    name: varchar({ length: 150 }).notNull(),
    email: varchar({ length: 255 }).unique().notNull(),
    phone: varchar({ length: 30 }).unique(),
    passwordHash: text("password_hash").notNull(),
    type: systemUserTypeEnum().notNull(),
    status: systemUserStatusEnum().notNull(),
    emailVerifiedAt: timestamp("email_verified_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    }),
    tenantId: uuid("tenant_id").references((): AnyPgColumn => systemUser.id, {
      onDelete: "set null",
    }),
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
    index("system_users_type_idx").on(table.type),
    index("system_users_status_idx").on(table.status),
    index("system_users_tenant_id_idx").on(table.tenantId),
    index("system_users_deleted_at_idx").on(table.deletedAt),
  ],
);
export type SystemUser = typeof systemUser.$inferSelect;
export type NewSystemUser = typeof systemUser.$inferInsert;

export const systemUserProfile = pgTable(
  "system_user_profiles",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    userId: uuid("user_id")
      .unique()
      .notNull()
      .references((): AnyPgColumn => systemUser.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    imageUrl: text("image_url"),
    dateOfBirth: date("date_of_birth", { mode: "date" }),
    gender: genderEnum(),
    address: text(),
    city: varchar({ length: 100 }),
    country: varchar({ length: 100 }),
    bio: text(),
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
    deletedById: uuid("deleted_by").references(
      (): AnyPgColumn => systemUser.id,
      { onDelete: "set null" },
    ),
    deletedAt: timestamp("deleted_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [index("system_user_profiles_deleted_at_idx").on(table.deletedAt)],
);
export type SystemUserProfile = typeof systemUserProfile.$inferSelect;
export type NewSystemUserProfile = typeof systemUserProfile.$inferInsert;

export const systemEmailVerification = pgTable(
  "system_email_verifications",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references((): AnyPgColumn => systemUser.id, { onDelete: "cascade" }),
    otpHash: text("otp_hash").notNull(),
    purpose: otpPurposeEnum().notNull(),
    attemptCount: integer("attempt_count").notNull(),
    expiresAt: timestamp("expires_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    }).notNull(),
    verifiedAt: timestamp("verified_at", {
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
  },
  (table) => [
    index("system_email_verifications_user_id_idx").on(table.userId),
    index("system_email_verifications_purpose_idx").on(table.purpose),
    index("system_email_verifications_expires_at_idx").on(table.expiresAt),
  ],
);
export type SystemEmailVerification =
  typeof systemEmailVerification.$inferSelect;
export type NewSystemEmailVerification =
  typeof systemEmailVerification.$inferInsert;

export const systemPasswordReset = pgTable(
  "system_password_resets",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references((): AnyPgColumn => systemUser.id, { onDelete: "cascade" }),
    otpHash: text("otp_hash").notNull(),
    attemptCount: integer("attempt_count").notNull(),
    expiresAt: timestamp("expires_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    }).notNull(),
    usedAt: timestamp("used_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    }),
    verifiedAt: timestamp("verified_at", {
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
  },
  (table) => [
    index("system_password_resets_user_id_idx").on(table.userId),
    index("system_password_resets_expires_at_idx").on(table.expiresAt),
  ],
);
export type SystemPasswordReset = typeof systemPasswordReset.$inferSelect;
export type NewSystemPasswordReset = typeof systemPasswordReset.$inferInsert;

export const systemSession = pgTable(
  "system_sessions",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references((): AnyPgColumn => systemUser.id, { onDelete: "cascade" }),
    businessId: uuid("business_id").references((): AnyPgColumn => business.id, {
      onDelete: "set null",
    }),
    refreshTokenHash: text("refresh_token_hash").unique().notNull(),
    expiresAt: timestamp("expires_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    }).notNull(),
    revokedAt: timestamp("revoked_at", {
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
  },
  (table) => [
    index("system_sessions_user_id_idx").on(table.userId),
    index("system_sessions_expires_at_idx").on(table.expiresAt),
    index("system_sessions_revoked_at_idx").on(table.revokedAt),
  ],
);
export type SystemSession = typeof systemSession.$inferSelect;
export type NewSystemSession = typeof systemSession.$inferInsert;

export const systemAuditLog = pgTable(
  "system_audit_logs",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    userId: uuid("user_id").references((): AnyPgColumn => systemUser.id, {
      onDelete: "set null",
    }),
    businessId: uuid("business_id").references((): AnyPgColumn => business.id, {
      onDelete: "set null",
    }),
    action: varchar({ length: 100 }).notNull(),
    feature: varchar({ length: 100 }).notNull(),
    entityName: varchar("entity_name", { length: 150 }).notNull(),
    entityId: varchar("entity_id", { length: 100 }),
    oldData: jsonb("old_data").$type<JsonValue>(),
    newData: jsonb("new_data").$type<JsonValue>(),
    ipAddress: varchar("ip_address", { length: 100 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", {
      precision: 6,
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("system_audit_logs_user_id_idx").on(table.userId),
    index("system_audit_logs_business_id_idx").on(table.businessId),
    index("system_audit_logs_feature_idx").on(table.feature),
    index("system_audit_logs_entity_name_entity_id_idx").on(
      table.entityName,
      table.entityId,
    ),
    index("system_audit_logs_created_at_idx").on(table.createdAt),
  ],
);
export type SystemAuditLog = typeof systemAuditLog.$inferSelect;
export type NewSystemAuditLog = typeof systemAuditLog.$inferInsert;
