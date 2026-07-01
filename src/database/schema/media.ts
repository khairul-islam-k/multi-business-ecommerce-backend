import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  index,
  integer,
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

export const MediaFileType = {
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  DOCUMENT: "DOCUMENT",
  AUDIO: "AUDIO",
  OTHER: "OTHER",
} as const;
export type MediaFileType = (typeof MediaFileType)[keyof typeof MediaFileType];
export const mediaFileTypeEnum = pgEnum("MediaFileType", [
  "IMAGE",
  "VIDEO",
  "DOCUMENT",
  "AUDIO",
  "OTHER",
]);

export const MediaAssetStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type MediaAssetStatus =
  (typeof MediaAssetStatus)[keyof typeof MediaAssetStatus];
export const mediaAssetStatusEnum = pgEnum("MediaAssetStatus", [
  "ACTIVE",
  "INACTIVE",
]);

export const MediaTagStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type MediaTagStatus =
  (typeof MediaTagStatus)[keyof typeof MediaTagStatus];
export const mediaTagStatusEnum = pgEnum("MediaTagStatus", [
  "ACTIVE",
  "INACTIVE",
]);

export const mediaAsset = pgTable(
  "media_assets",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by"),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileUrl: text("file_url").notNull(),
    fileType: mediaFileTypeEnum("file_type").notNull(),
    mimeType: varchar("mime_type", { length: 100 }),
    fileSize: integer("file_size"),
    altText: text("alt_text"),
    status: mediaAssetStatusEnum().notNull(),
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
    index("media_assets_business_id_idx").on(table.businessId),
    index("media_assets_uploaded_by_idx").on(table.uploadedBy),
    index("media_assets_file_type_idx").on(table.fileType),
    index("media_assets_status_idx").on(table.status),
  ],
);
export type MediaAsset = typeof mediaAsset.$inferSelect;
export type NewMediaAsset = typeof mediaAsset.$inferInsert;

export const mediaTag = pgTable(
  "media_tags",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    name: varchar({ length: 100 }).notNull(),
    status: mediaTagStatusEnum().notNull(),
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
    uniqueIndex("media_tags_business_id_name_unique")
      .on(table.businessId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index("media_tags_business_id_idx").on(table.businessId),
    index("media_tags_status_idx").on(table.status),
  ],
);
export type MediaTag = typeof mediaTag.$inferSelect;
export type NewMediaTag = typeof mediaTag.$inferInsert;

export const mediaAssetTag = pgTable(
  "media_asset_tags",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references((): AnyPgColumn => mediaAsset.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references((): AnyPgColumn => mediaTag.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("media_asset_tags_media_asset_id_tag_id_unique").on(
      table.mediaAssetId,
      table.tagId,
    ),
    index("media_asset_tags_media_asset_id_idx").on(table.mediaAssetId),
    index("media_asset_tags_tag_id_idx").on(table.tagId),
  ],
);
export type MediaAssetTag = typeof mediaAssetTag.$inferSelect;
export type NewMediaAssetTag = typeof mediaAssetTag.$inferInsert;
