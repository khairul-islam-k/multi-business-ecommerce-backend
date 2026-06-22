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

import { business } from "./business";
import { type JsonValue } from "./common";
import { systemUser } from "./system";

export const SmsProviderStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type SmsProviderStatus =
  (typeof SmsProviderStatus)[keyof typeof SmsProviderStatus];
export const smsProviderStatusEnum = pgEnum("SmsProviderStatus", [
  "ACTIVE",
  "INACTIVE",
]);

export const SmsProviderConfigMode = {
  SANDBOX: "SANDBOX",
  LIVE: "LIVE",
} as const;
export type SmsProviderConfigMode =
  (typeof SmsProviderConfigMode)[keyof typeof SmsProviderConfigMode];
export const smsProviderConfigModeEnum = pgEnum("SmsProviderConfigMode", [
  "SANDBOX",
  "LIVE",
]);

export const SmsProviderConfigStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type SmsProviderConfigStatus =
  (typeof SmsProviderConfigStatus)[keyof typeof SmsProviderConfigStatus];
export const smsProviderConfigStatusEnum = pgEnum("SmsProviderConfigStatus", [
  "ACTIVE",
  "INACTIVE",
]);

export const SmsTemplateType = {
  MARKETING: "MARKETING",
  TRANSACTIONAL: "TRANSACTIONAL",
  ORDER: "ORDER",
  OTP: "OTP",
  CUSTOM: "CUSTOM",
} as const;
export type SmsTemplateType =
  (typeof SmsTemplateType)[keyof typeof SmsTemplateType];
export const smsTemplateTypeEnum = pgEnum("SmsTemplateType", [
  "MARKETING",
  "TRANSACTIONAL",
  "ORDER",
  "OTP",
  "CUSTOM",
]);

export const SmsTemplateStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type SmsTemplateStatus =
  (typeof SmsTemplateStatus)[keyof typeof SmsTemplateStatus];
export const smsTemplateStatusEnum = pgEnum("SmsTemplateStatus", [
  "ACTIVE",
  "INACTIVE",
]);

export const SmsCampaignType = {
  PROMOTIONAL: "PROMOTIONAL",
  TRANSACTIONAL: "TRANSACTIONAL",
  CUSTOM: "CUSTOM",
} as const;
export type SmsCampaignType =
  (typeof SmsCampaignType)[keyof typeof SmsCampaignType];
export const smsCampaignTypeEnum = pgEnum("SmsCampaignType", [
  "PROMOTIONAL",
  "TRANSACTIONAL",
  "CUSTOM",
]);

export const SmsCampaignStatus = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  FAILED: "FAILED",
} as const;
export type SmsCampaignStatus =
  (typeof SmsCampaignStatus)[keyof typeof SmsCampaignStatus];
export const smsCampaignStatusEnum = pgEnum("SmsCampaignStatus", [
  "DRAFT",
  "SCHEDULED",
  "RUNNING",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
]);

export const SmsRecipientStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  DELIVERED: "DELIVERED",
} as const;
export type SmsRecipientStatus =
  (typeof SmsRecipientStatus)[keyof typeof SmsRecipientStatus];
export const smsRecipientStatusEnum = pgEnum("SmsRecipientStatus", [
  "PENDING",
  "SENT",
  "FAILED",
  "DELIVERED",
]);

export const SmsLogStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  DELIVERED: "DELIVERED",
} as const;
export type SmsLogStatus = (typeof SmsLogStatus)[keyof typeof SmsLogStatus];
export const smsLogStatusEnum = pgEnum("SmsLogStatus", [
  "PENDING",
  "SENT",
  "FAILED",
  "DELIVERED",
]);

export const smsProvider = pgTable(
  "sms_providers",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    name: varchar({ length: 150 }).notNull(),
    code: varchar({ length: 100 }).notNull(),
    description: text(),
    status: smsProviderStatusEnum().notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("sms_providers_code_unique").on(table.code),
    index("sms_providers_status_idx").on(table.status),
  ],
);
export type SmsProvider = typeof smsProvider.$inferSelect;
export type NewSmsProvider = typeof smsProvider.$inferInsert;

export const smsProviderConfig = pgTable(
  "sms_provider_configs",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references((): AnyPgColumn => smsProvider.id, { onDelete: "restrict" }),
    configData: jsonb("config_data").$type<JsonValue>().notNull(),
    mode: smsProviderConfigModeEnum().notNull(),
    status: smsProviderConfigStatusEnum().notNull(),
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
    uniqueIndex("sms_provider_configs_business_id_provider_id_mode_unique").on(
      table.businessId,
      table.providerId,
      table.mode,
    ),
    index("sms_provider_configs_business_id_idx").on(table.businessId),
    index("sms_provider_configs_provider_id_idx").on(table.providerId),
    index("sms_provider_configs_status_idx").on(table.status),
  ],
);
export type SmsProviderConfig = typeof smsProviderConfig.$inferSelect;
export type NewSmsProviderConfig = typeof smsProviderConfig.$inferInsert;

export const smsTemplate = pgTable(
  "sms_templates",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    name: varchar({ length: 150 }).notNull(),
    templateType: smsTemplateTypeEnum("template_type").notNull(),
    messageBody: text("message_body").notNull(),
    variables: jsonb().$type<JsonValue>(),
    status: smsTemplateStatusEnum().notNull(),
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
    uniqueIndex("sms_templates_business_id_name_unique").on(
      table.businessId,
      table.name,
    ),
    index("sms_templates_business_id_idx").on(table.businessId),
    index("sms_templates_template_type_idx").on(table.templateType),
    index("sms_templates_status_idx").on(table.status),
  ],
);
export type SmsTemplate = typeof smsTemplate.$inferSelect;
export type NewSmsTemplate = typeof smsTemplate.$inferInsert;

export const smsCampaign = pgTable(
  "sms_campaigns",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(
      (): AnyPgColumn => smsTemplate.id,
      { onDelete: "set null" },
    ),
    name: varchar({ length: 150 }).notNull(),
    messageBody: text("message_body").notNull(),
    campaignType: smsCampaignTypeEnum("campaign_type").notNull(),
    status: smsCampaignStatusEnum().notNull(),
    totalRecipients: integer("total_recipients").notNull(),
    sentCount: integer("sent_count").notNull(),
    failedCount: integer("failed_count").notNull(),
    scheduledAt: timestamp("scheduled_at", { mode: "date" }),
    startedAt: timestamp("started_at", { mode: "date" }),
    completedAt: timestamp("completed_at", { mode: "date" }),
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
    index("sms_campaigns_business_id_idx").on(table.businessId),
    index("sms_campaigns_template_id_idx").on(table.templateId),
    index("sms_campaigns_campaign_type_idx").on(table.campaignType),
    index("sms_campaigns_status_idx").on(table.status),
    index("sms_campaigns_scheduled_at_idx").on(table.scheduledAt),
  ],
);
export type SmsCampaign = typeof smsCampaign.$inferSelect;
export type NewSmsCampaign = typeof smsCampaign.$inferInsert;

export const smsCampaignRecipient = pgTable(
  "sms_campaign_recipients",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references((): AnyPgColumn => smsCampaign.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id"),
    recipientName: varchar("recipient_name", { length: 150 }),
    phone: varchar({ length: 30 }).notNull(),
    status: smsRecipientStatusEnum().notNull(),
    sentAt: timestamp("sent_at", { mode: "date" }),
    failedAt: timestamp("failed_at", { mode: "date" }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("sms_campaign_recipients_campaign_id_idx").on(table.campaignId),
    index("sms_campaign_recipients_customer_id_idx").on(table.customerId),
    index("sms_campaign_recipients_phone_idx").on(table.phone),
    index("sms_campaign_recipients_status_idx").on(table.status),
  ],
);
export type SmsCampaignRecipient = typeof smsCampaignRecipient.$inferSelect;
export type NewSmsCampaignRecipient = typeof smsCampaignRecipient.$inferInsert;

export const smsLog = pgTable(
  "sms_logs",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(
      (): AnyPgColumn => smsCampaign.id,
      { onDelete: "set null" },
    ),
    recipientId: uuid("recipient_id").references(
      (): AnyPgColumn => smsCampaignRecipient.id,
      { onDelete: "set null" },
    ),
    providerId: uuid("provider_id").references(
      (): AnyPgColumn => smsProvider.id,
      { onDelete: "set null" },
    ),
    phone: varchar({ length: 30 }).notNull(),
    messageBody: text("message_body").notNull(),
    smsCount: integer("sms_count").notNull(),
    status: smsLogStatusEnum().notNull(),
    providerMessageId: varchar("provider_message_id", { length: 150 }),
    providerResponse: jsonb("provider_response").$type<JsonValue>(),
    sentAt: timestamp("sent_at", { mode: "date" }),
    failedAt: timestamp("failed_at", { mode: "date" }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("sms_logs_business_id_idx").on(table.businessId),
    index("sms_logs_campaign_id_idx").on(table.campaignId),
    index("sms_logs_recipient_id_idx").on(table.recipientId),
    index("sms_logs_provider_id_idx").on(table.providerId),
    index("sms_logs_phone_idx").on(table.phone),
    index("sms_logs_status_idx").on(table.status),
    index("sms_logs_provider_message_id_idx").on(table.providerMessageId),
    index("sms_logs_created_at_idx").on(table.createdAt),
  ],
);
export type SmsLog = typeof smsLog.$inferSelect;
export type NewSmsLog = typeof smsLog.$inferInsert;
