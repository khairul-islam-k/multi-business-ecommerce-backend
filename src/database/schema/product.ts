import {
  boolean,
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

import { decimal } from "./common";
import { business } from "./business";

export const ProductSimpleStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type ProductSimpleStatus =
  (typeof ProductSimpleStatus)[keyof typeof ProductSimpleStatus];
export const productSimpleStatusEnum = pgEnum("ProductSimpleStatus", [
  "ACTIVE",
  "INACTIVE",
]);

export const CatalogProductStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  ARCHIVED: "ARCHIVED",
} as const;
export type CatalogProductStatus =
  (typeof CatalogProductStatus)[keyof typeof CatalogProductStatus];
export const catalogProductStatusEnum = pgEnum("CatalogProductStatus", [
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED",
]);

export const ProductVariantStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type ProductVariantStatus =
  (typeof ProductVariantStatus)[keyof typeof ProductVariantStatus];
export const productVariantStatusEnum = pgEnum("ProductVariantStatus", [
  "ACTIVE",
  "INACTIVE",
]);

export const ProductReviewStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type ProductReviewStatus =
  (typeof ProductReviewStatus)[keyof typeof ProductReviewStatus];
export const productReviewStatusEnum = pgEnum("ProductReviewStatus", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const productCategory = pgTable(
  "product_categories",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => productCategory.id,
      { onDelete: "set null" },
    ),
    name: varchar({ length: 150 }).notNull(),
    description: text(),
    imageUrl: text("image_url"),
    status: productSimpleStatusEnum().notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
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
    uniqueIndex("product_categories_business_id_name_deleted_unique")
      .on(table.businessId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index("product_categories_business_id_idx").on(table.businessId),
    index("product_categories_parent_id_idx").on(table.parentId),
    index("product_categories_status_idx").on(table.status),
    index("product_categories_deleted_at_idx").on(table.deletedAt),
  ],
);
export type ProductCategory = typeof productCategory.$inferSelect;
export type NewProductCategory = typeof productCategory.$inferInsert;

export const productBrand = pgTable(
  "product_brands",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    name: varchar({ length: 150 }).notNull(),
    description: text(),
    logoUrl: text("logo_url"),
    status: productSimpleStatusEnum().notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
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
    uniqueIndex("product_brads_business_id_name_deleted_unique")
      .on(table.businessId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index("product_brands_business_id_idx").on(table.businessId),
    index("product_brands_status_idx").on(table.status),
    index("product_brands_deleted_at_idx").on(table.deletedAt),
  ],
);
export type ProductBrand = typeof productBrand.$inferSelect;
export type NewProductBrand = typeof productBrand.$inferInsert;

export const productUnit = pgTable(
  "product_units",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    name: varchar({ length: 100 }).notNull(),
    status: productSimpleStatusEnum().notNull(),
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
    uniqueIndex("product_units_business_id_name_deleted_unique")
      .on(table.businessId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index("product_units_business_id_idx").on(table.businessId),
    index("product_units_status_idx").on(table.status),
    index("product_units_deleted_at_idx").on(table.deletedAt),
  ],
);
export type ProductUnit = typeof productUnit.$inferSelect;
export type NewProductUnit = typeof productUnit.$inferInsert;

export const productTag = pgTable(
  "product_tags",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    name: varchar({ length: 100 }).notNull(),
    status: productSimpleStatusEnum().notNull(),
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
    uniqueIndex("product_tags_business_id_name_deleted_unique")
      .on(table.businessId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index("product_tags_business_id_idx").on(table.businessId),
    index("product_tags_status_idx").on(table.status),
    index("product_tags_deleted_at_idx").on(table.deletedAt),
  ],
);
export type ProductTag = typeof productTag.$inferSelect;
export type NewProductTag = typeof productTag.$inferInsert;

export const product = pgTable(
  "products",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(
      (): AnyPgColumn => productCategory.id,
      { onDelete: "set null" },
    ),
    brandId: uuid("brand_id").references((): AnyPgColumn => productBrand.id, {
      onDelete: "set null",
    }),
    unitId: uuid("unit_id").references((): AnyPgColumn => productUnit.id, {
      onDelete: "set null",
    }),
    name: varchar({ length: 200 }).notNull(),
    slug: varchar({ length: 220 }).notNull(),
    description: text(),
    sku: varchar({ length: 100 }).notNull(),
    barcode: varchar({ length: 100 }).notNull(),
    price: decimal({ precision: 12, scale: 2 }).notNull(),
    weight: decimal({ precision: 10, scale: 2 }),
    status: catalogProductStatusEnum().notNull(),
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
    uniqueIndex("products_business_id_name_deleted_unique")
      .on(table.businessId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("product_products_business_id_sku_unique").on(
      table.businessId,
      table.sku,
    ),
    uniqueIndex("product_products_business_id_barcode_unique").on(
      table.businessId,
      table.barcode,
    ),
    index("product_products_business_id_idx").on(table.businessId),
    index("product_products_category_id_idx").on(table.categoryId),
    index("product_products_brand_id_idx").on(table.brandId),
    index("product_products_unit_id_idx").on(table.unitId),
    index("product_products_status_idx").on(table.status),
    index("product_products_deleted_at_idx").on(table.deletedAt),
  ],
);
export type Product = typeof product.$inferSelect;
export type NewProduct = typeof product.$inferInsert;

export const productVariant = pgTable(
  "product_variants",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references((): AnyPgColumn => product.id, { onDelete: "cascade" }),
    sku: varchar({ length: 100 }).notNull(),
    barcode: varchar({ length: 100 }).notNull(),
    title: varchar({ length: 200 }).notNull(),
    priceOverride: decimal("price_override", { precision: 12, scale: 2 }),
    weight: decimal({ precision: 10, scale: 2 }),
    status: productVariantStatusEnum().notNull(),
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
    uniqueIndex("product_variants_business_id_product_id_deleted_unique")
      .on(table.businessId, table.productId, table.title)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("product_variants_business_id_sku_unique").on(
      table.businessId,
      table.sku,
    ),
    uniqueIndex("product_variants_business_id_barcode_unique").on(
      table.businessId,
      table.barcode,
    ),
    index("product_variants_business_id_idx").on(table.businessId),
    index("product_variants_product_id_idx").on(table.productId),
    index("product_variants_status_idx").on(table.status),
    index("product_variants_deleted_at_idx").on(table.deletedAt),
  ],
);
export type ProductVariant = typeof productVariant.$inferSelect;
export type NewProductVariant = typeof productVariant.$inferInsert;

export const productAttribute = pgTable(
  "product_attributes",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    name: varchar({ length: 100 }).notNull(),
    status: productSimpleStatusEnum().notNull(),
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
    uniqueIndex("product_attributes_business_id_name_unique")
      .on(table.businessId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index("product_attributes_business_id_idx").on(table.businessId),
    index("product_attributes_status_idx").on(table.status),
    index("product_attributes_deleted_at_idx").on(table.deletedAt),
  ],
);
export type ProductAttribute = typeof productAttribute.$inferSelect;
export type NewProductAttribute = typeof productAttribute.$inferInsert;

export const productAttributeValue = pgTable(
  "product_attribute_values",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    attributeId: uuid("attribute_id")
      .notNull()
      .references((): AnyPgColumn => productAttribute.id, {
        onDelete: "cascade",
      }),
    value: varchar({ length: 150 }).notNull(),
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
    uniqueIndex("product_attribute_values_attribute_id_value_unique")
      .on(table.attributeId, table.value)
      .where(sql`${table.deletedAt} IS NULL`),
    index("product_attribute_values_business_id_idx").on(table.businessId),
    index("product_attribute_values_attribute_id_idx").on(table.attributeId),
    index("product_attribute_values_deleted_at_idx").on(table.deletedAt),
  ],
);
export type ProductAttributeValue = typeof productAttributeValue.$inferSelect;
export type NewProductAttributeValue =
  typeof productAttributeValue.$inferInsert;

export const productVariantAttribute = pgTable(
  "product_variant_attributes",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    variantId: uuid("variant_id")
      .notNull()
      .references((): AnyPgColumn => productVariant.id, {
        onDelete: "cascade",
      }),
    attributeId: uuid("attribute_id")
      .notNull()
      .references((): AnyPgColumn => productAttribute.id, {
        onDelete: "cascade",
      }),
    attributeValueId: uuid("attribute_value_id")
      .notNull()
      .references((): AnyPgColumn => productAttributeValue.id, {
        onDelete: "cascade",
      }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_variant_attributes_variant_id_attribute_id_unique").on(
      table.variantId,
      table.attributeId,
    ),
    index("product_variant_attributes_attribute_id_attribute_value_id_idx").on(
      table.attributeId,
      table.attributeValueId,
    ),
    index("product_variant_attributes_attribute_value_id_idx").on(
      table.attributeValueId,
    ),
  ],
);
export type ProductVariantAttribute =
  typeof productVariantAttribute.$inferSelect;
export type NewProductVariantAttribute =
  typeof productVariantAttribute.$inferInsert;

export const productImage = pgTable(
  "product_images",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references((): AnyPgColumn => product.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(
      (): AnyPgColumn => productVariant.id,
      { onDelete: "set null" },
    ),
    imageUrl: text("image_url").notNull(),
    altText: text("alt_text"),
    isThumbnail: boolean("is_thumbnail").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
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
    index("product_images_business_id_idx").on(table.businessId),
    index("product_images_product_id_idx").on(table.productId),
    index("product_images_variant_id_idx").on(table.variantId),
    index("product_images_is_thumbnail_idx").on(table.isThumbnail),
    index("product_images_deleted_at_idx").on(table.deletedAt),
  ],
);
export type ProductImage = typeof productImage.$inferSelect;
export type NewProductImage = typeof productImage.$inferInsert;

export const productTagMap = pgTable(
  "product_tag_map",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    productId: uuid("product_id")
      .notNull()
      .references((): AnyPgColumn => product.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references((): AnyPgColumn => productTag.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("product_tag_map_product_id_tag_id_unique").on(
      table.productId,
      table.tagId,
    ),
    index("product_tag_map_tag_id_idx").on(table.tagId),
  ],
);
export type ProductTagMap = typeof productTagMap.$inferSelect;
export type NewProductTagMap = typeof productTagMap.$inferInsert;

export const productReview = pgTable(
  "product_reviews",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references((): AnyPgColumn => business.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references((): AnyPgColumn => product.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(
      (): AnyPgColumn => productVariant.id,
      { onDelete: "set null" },
    ),
    rating: integer().notNull(),
    title: varchar({ length: 150 }),
    comment: text(),
    reviewerName: varchar("reviewer_name", { length: 150 }).notNull(),
    reviewerEmail: varchar("reviewer_email", { length: 150 }),
    reviewerPhone: varchar("reviewer_phone", { length: 30 }),
    status: productReviewStatusEnum().notNull(),
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
    index("product_reviews_business_id_idx").on(table.businessId),
    index("product_reviews_product_id_idx").on(table.productId),
    index("product_reviews_variant_id_idx").on(table.variantId),
    index("product_reviews_status_idx").on(table.status),
    index("product_reviews_rating_idx").on(table.rating),
    index("product_reviews_deleted_at_idx").on(table.deletedAt),
  ],
);
export type ProductReview = typeof productReview.$inferSelect;
export type NewProductReview = typeof productReview.$inferInsert;
