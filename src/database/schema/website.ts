import {
  AnyPgColumn,
  boolean,
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

import { JsonValue } from "./common";
import { business } from "./business";
import { sql } from "drizzle-orm";
import { systemUser } from "./system";

export const WebsiteTemplate = {
  FASHION: "FASHION",
  ELECTRONIC: "ELECTRONIC",
} as const;
export type WebsiteTemplate =
  (typeof WebsiteTemplate)[keyof typeof WebsiteTemplate];
export const websiteTemplateEnum = pgEnum("WebsiteTemplate", [
  "FASHION",
  "ELECTRONIC",
]);

export const WebsiteStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  UNPUBLISHED: "UNPUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
export type WebsiteStatus = (typeof WebsiteStatus)[keyof typeof WebsiteStatus];
export const websiteStatusEnum = pgEnum("WebsiteStatus", [
  "DRAFT",
  "PUBLISHED",
  "UNPUBLISHED",
  "ARCHIVED",
]);

export const WebsiteDomainType = {
  SUBDOMAIN: "SUBDOMAIN",
  CUSTOM_DOMAIN: "CUSTOM_DOMAIN",
} as const;
export type WebsiteDomainType =
  (typeof WebsiteDomainType)[keyof typeof WebsiteDomainType];
export const websiteDomainTypeEnum = pgEnum("WebsiteDomainType", [
  "SUBDOMAIN",
  "CUSTOM_DOMAIN",
]);

export const WebsiteDomainVerificationStatus = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  FAILED: "FAILED",
} as const;
export type WebsiteDomainVerificationStatus =
  (typeof WebsiteDomainVerificationStatus)[keyof typeof WebsiteDomainVerificationStatus];
export const websiteDomainVerificationStatusEnum = pgEnum(
  "WebsiteDomainVerificationStatus",
  ["PENDING", "VERIFIED", "FAILED"],
);

export const WebsiteDomainSslStatus = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  FAILED: "FAILED",
} as const;
export type WebsiteDomainSslStatus =
  (typeof WebsiteDomainSslStatus)[keyof typeof WebsiteDomainSslStatus];
export const websiteDomainSslStatusEnum = pgEnum("WebsiteDomainSslStatus", [
  "PENDING",
  "ACTIVE",
  "FAILED",
]);

export const website = pgTable(
  "websites",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    currentVersionId: uuid("current_version_id")
      .unique()
      .references((): AnyPgColumn => websitePublishVersion.id, {
        onDelete: "set null",
      }),
    name: varchar({ length: 150 }).notNull(),
    slug: varchar({ length: 180 }).notNull(),
    status: websiteStatusEnum().notNull(),
    template: websiteTemplateEnum().notNull(),
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
    uniqueIndex("website_websites_business_id_unique")
      .on(table.businessId)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("website_websites_slug_unique")
      .on(table.slug)
      .where(sql`${table.deletedAt} IS NULL`),
    index("website_websites_business_id_idx").on(table.businessId),
    index("website_websites_status_idx").on(table.status),
  ],
);
export type Website = typeof website.$inferSelect;
export type NewWebsite = typeof website.$inferInsert;

export const websiteConfig = pgTable(
  "website_configs",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    websiteId: uuid("website_id")
      .notNull()
      .references((): AnyPgColumn => website.id, { onDelete: "cascade" })
      .unique(),
    headerConfig: jsonb("header_config").$type<JsonValue>(),
    footerConfig: jsonb("footer_config").$type<JsonValue>(),
    navigationConfig: jsonb("navigation_config").$type<JsonValue>(),
    sectionConfig: jsonb("section_config").$type<JsonValue>(),
    generalConfig: jsonb("general_config").$type<JsonValue>(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("website_configs_website_id_idx").on(table.websiteId)],
);
export type WebsiteConfig = typeof websiteConfig.$inferSelect;
export type NewWebsiteConfig = typeof websiteConfig.$inferInsert;

export const websiteDomain = pgTable(
  "website_domains",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    websiteId: uuid("website_id")
      .notNull()
      .references((): AnyPgColumn => website.id, { onDelete: "cascade" }),
    domain: varchar({ length: 255 }),
    subdomain: varchar({ length: 255 }),
    domainType: websiteDomainTypeEnum("domain_type").notNull(),
    isPrimary: boolean("is_primary").notNull(),
    verificationStatus: websiteDomainVerificationStatusEnum(
      "verification_status",
    ).notNull(),
    sslStatus: websiteDomainSslStatusEnum("ssl_status").notNull(),
    verifiedAt: timestamp("verified_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [
    uniqueIndex("website_domains_domain_unique")
      .on(table.domain)
      .where(sql`${table.domain} IS NOT NULL AND ${table.deletedAt} IS NULL`),

    uniqueIndex("website_domains_subdomain_unique")
      .on(table.subdomain)
      .where(
        sql`${table.subdomain} IS NOT NULL AND ${table.deletedAt} IS NULL`,
      ),

    uniqueIndex("website_domains_one_primary_per_website_unique")
      .on(table.websiteId)
      .where(sql`${table.isPrimary} = true AND ${table.deletedAt} IS NULL`),
    index("website_domains_website_id_idx").on(table.websiteId),
    index("website_domains_domain_idx").on(table.domain),
    index("website_domains_subdomain_idx").on(table.subdomain),
    index("website_domains_domain_type_idx").on(table.domainType),
    index("website_domains_is_primary_idx").on(table.isPrimary),
    index("website_domains_verification_status_idx").on(
      table.verificationStatus,
    ),
  ],
);
export type WebsiteDomain = typeof websiteDomain.$inferSelect;
export type NewWebsiteDomain = typeof websiteDomain.$inferInsert;

export const websiteThemeSetting = pgTable(
  "website_theme_settings",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    websiteId: uuid("website_id")
      .unique()
      .notNull()
      .references((): AnyPgColumn => website.id, { onDelete: "cascade" }),
    primaryColor: varchar("primary_color", { length: 30 }),
    secondaryColor: varchar("secondary_color", { length: 30 }),
    accentColor: varchar("accent_color", { length: 30 }),
    fontFamily: varchar("font_family", { length: 100 }),
    logoUrl: text("logo_url"),
    faviconUrl: text("favicon_url"),
    customCss: text("custom_css"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("website_theme_settings_website_id_idx").on(table.websiteId),
  ],
);
export type WebsiteThemeSetting = typeof websiteThemeSetting.$inferSelect;
export type NewWebsiteThemeSetting = typeof websiteThemeSetting.$inferInsert;

export const websiteSeoSetting = pgTable(
  "website_seo_settings",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    websiteId: uuid("website_id")
      .unique()
      .notNull()
      .references((): AnyPgColumn => website.id, { onDelete: "cascade" }),
    metaTitle: varchar("meta_title", { length: 255 }),
    metaDescription: text("meta_description"),
    metaKeywords: text("meta_keywords"),
    ogTitle: varchar("og_title", { length: 255 }),
    ogDescription: text("og_description"),
    ogImageUrl: text("og_image_url"),
    canonicalUrl: text("canonical_url"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("website_seo_settings_website_id_idx").on(table.websiteId)],
);
export type WebsiteSeoSetting = typeof websiteSeoSetting.$inferSelect;
export type NewWebsiteSeoSetting = typeof websiteSeoSetting.$inferInsert;

export const websitePublishVersion = pgTable(
  "website_publish_versions",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    websiteId: uuid("website_id")
      .notNull()
      .references((): AnyPgColumn => website.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    snapshotData: jsonb("snapshot_data").$type<JsonValue>().notNull(),
    publishedBy: uuid("published_by"),
    publishedAt: timestamp("published_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("website_publish_versions_website_id_version_no_unique").on(
      table.websiteId,
      table.versionNo,
    ),
    index("website_publish_versions_website_id_idx").on(table.websiteId),
    index("website_publish_versions_published_at_idx").on(table.publishedAt),
  ],
);
export type WebsitePublishVersion = typeof websitePublishVersion.$inferSelect;
export type NewWebsitePublishVersion =
  typeof websitePublishVersion.$inferInsert;
