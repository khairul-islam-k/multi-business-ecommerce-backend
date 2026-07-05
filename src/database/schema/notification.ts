// import { sql } from "drizzle-orm";
// import {
//   AnyPgColumn,
//   index,
//   jsonb,
//   pgEnum,
//   pgTable,
//   text,
//   timestamp,
//   uniqueIndex,
//   uuid,
//   varchar,
// } from "drizzle-orm/pg-core";

// import { business } from "./business";
// import { JsonValue } from "./common";
// import { systemUser } from "./system";

// export const NotificationChannel = {
//   IN_APP: "IN_APP",
//   EMAIL: "EMAIL",
//   SMS: "SMS",
//   PUSH: "PUSH",
// } as const;
// export type NotificationChannel =
//   (typeof NotificationChannel)[keyof typeof NotificationChannel];
// export const notificationChannelEnum = pgEnum("NotificationChannel", [
//   "IN_APP",
//   "EMAIL",
//   "SMS",
//   "PUSH",
// ]);

// export const NotificationTemplateStatus = {
//   ACTIVE: "ACTIVE",
//   INACTIVE: "INACTIVE",
// } as const;
// export type NotificationTemplateStatus =
//   (typeof NotificationTemplateStatus)[keyof typeof NotificationTemplateStatus];
// export const notificationTemplateStatusEnum = pgEnum(
//   "NotificationTemplateStatus",
//   ["ACTIVE", "INACTIVE"],
// );

// export const NotificationRecipientType = {
//   SYSTEM_USER: "SYSTEM_USER",
//   CUSTOMER: "CUSTOMER",
// } as const;
// export type NotificationRecipientType =
//   (typeof NotificationRecipientType)[keyof typeof NotificationRecipientType];
// export const notificationRecipientTypeEnum = pgEnum(
//   "NotificationRecipientType",
//   ["SYSTEM_USER", "CUSTOMER"],
// );

// export const NotificationStatus = {
//   PENDING: "PENDING",
//   SENT: "SENT",
//   FAILED: "FAILED",
//   READ: "READ",
// } as const;
// export type NotificationStatus =
//   (typeof NotificationStatus)[keyof typeof NotificationStatus];
// export const notificationStatusEnum = pgEnum("NotificationStatus", [
//   "PENDING",
//   "SENT",
//   "FAILED",
//   "READ",
// ]);

// export const NotificationType = {
//   ORDER: "ORDER",
//   PAYMENT: "PAYMENT",
//   INVENTORY: "INVENTORY",
//   SUBSCRIPTION: "SUBSCRIPTION",
//   SYSTEM: "SYSTEM",
//   MARKETING: "MARKETING",
//   CUSTOM: "CUSTOM",
// } as const;
// export type NotificationType =
//   (typeof NotificationType)[keyof typeof NotificationType];
// export const notificationTypeEnum = pgEnum("NotificationType", [
//   "ORDER",
//   "PAYMENT",
//   "INVENTORY",
//   "SUBSCRIPTION",
//   "SYSTEM",
//   "MARKETING",
//   "CUSTOM",
// ]);

// export const notificationTemplate = pgTable(
//   "notification_templates",
//   {
//     id: uuid().primaryKey().defaultRandom().notNull(),
//     businessId: uuid("business_id").references((): AnyPgColumn => business.id, {
//       onDelete: "set null",
//     }),
//     name: varchar({ length: 150 }).notNull(),
//     code: varchar({ length: 100 }).notNull(),
//     channel: notificationChannelEnum().notNull(),
//     subject: varchar({ length: 255 }),
//     title: varchar({ length: 255 }),
//     body: text().notNull(),
//     variables: jsonb().$type<JsonValue>(),
//     status: notificationTemplateStatusEnum().notNull(),
//     createdBy: uuid("created_by").references((): AnyPgColumn => systemUser.id, {
//       onDelete: "set null",
//     }),
//     updatedBy: uuid("updated_by").references((): AnyPgColumn => systemUser.id, {
//       onDelete: "set null",
//     }),
//     deletedBy: uuid("deleted_by").references((): AnyPgColumn => systemUser.id, {
//       onDelete: "set null",
//     }),
//     createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
//     updatedAt: timestamp("updated_at", { mode: "date" })
//       .defaultNow()
//       .$onUpdate(() => new Date())
//       .notNull(),
//     deletedAt: timestamp("deleted_at", { mode: "date" }),
//   },
//   (table) => [
//     uniqueIndex("notification_templates_business_code_channel_active_unique")
//       .on(table.businessId, table.code, table.channel)
//       .where(sql`${table.deletedAt} IS NULL`),
//     index("notification_templates_business_id_idx").on(table.businessId),
//     index("notification_templates_code_idx").on(table.code),
//     index("notification_templates_channel_idx").on(table.channel),
//     index("notification_templates_status_idx").on(table.status),
//   ],
// );
// export type NotificationTemplate = typeof notificationTemplate.$inferSelect;
// export type NewNotificationTemplate = typeof notificationTemplate.$inferInsert;

// export const notification = pgTable(
//   "notifications",
//   {
//     id: uuid().primaryKey().defaultRandom().notNull(),
//     businessId: uuid("business_id").references((): AnyPgColumn => business.id, {
//       onDelete: "set null",
//     }),
//     recipientType: notificationRecipientTypeEnum("recipient_type").notNull(),
//     recipientId: uuid("recipient_id").notNull(),
//     templateId: uuid("template_id").references(
//       (): AnyPgColumn => notificationTemplate.id,
//       { onDelete: "set null" },
//     ),
//     title: varchar({ length: 255 }).notNull(),
//     message: text().notNull(),
//     channel: notificationChannelEnum().notNull(),
//     notificationType: notificationTypeEnum("notification_type").notNull(),
//     data: jsonb().$type<JsonValue>(),
//     status: notificationStatusEnum().notNull(),
//     readAt: timestamp("read_at", { mode: "date" }),
//     sentAt: timestamp("sent_at", { mode: "date" }),
//     createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
//     updatedAt: timestamp("updated_at", { mode: "date" })
//       .defaultNow()
//       .$onUpdate(() => new Date())
//       .notNull(),
//   },
//   (table) => [
//     index("notifications_business_id_idx").on(table.businessId),
//     index("notifications_recipient_type_recipient_id_idx").on(
//       table.recipientType,
//       table.recipientId,
//     ),
//     index("notifications_template_id_idx").on(table.templateId),
//     index("notifications_channel_idx").on(table.channel),
//     index("notifications_notification_type_idx").on(table.notificationType),
//     index("notifications_status_idx").on(table.status),
//     index("notifications_read_at_idx").on(table.readAt),
//     index("notifications_sent_at_idx").on(table.sentAt),
//     index("notifications_created_at_idx").on(table.createdAt),
//   ],
// );
// export type Notification = typeof notification.$inferSelect;
// export type NewNotification = typeof notification.$inferInsert;
