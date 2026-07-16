import { and, count, eq, inArray, isNull, ne } from "drizzle-orm";

import {
  product,
  productAttribute,
  productAttributeValue,
  productBrand,
  productCategory,
  FinanceTaxStatus,
  financeTax,
  ProductSimpleStatus,
  productTag,
  productUnit,
  productVariant,
} from "@/database/schema";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { BusinessCodePrefixService } from "../../../common/code/business-code-prefix.service";
import { isUniqueConstraintError } from "../../../common/database/db-error.util";
import { generateRandomCode } from "../../../common/utils/code-generator.util";
import { generateRandomSlug } from "../../../common/utils/slug-generator.util";
import { DatabaseService } from "../../../database/database.service";

const PRODUCT_SLUG_MAX_LENGTH = 220;
const PRODUCT_SLUG_RETRY_LIMIT = 5;
const PRODUCT_CODE_RETRY_LIMIT = 5;

@Injectable()
export class ProductCatalogLookupService {
  constructor(
    private readonly database: DatabaseService,
    private readonly prefixes: BusinessCodePrefixService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async assertCategoryNameAvailable(
    businessId: string,
    name: string,
    parentId?: string | null,
    excludeCategoryId?: string,
  ) {
    const [category] = await this.db
      .select({ id: productCategory.id })
      .from(productCategory)
      .where(
        and(
          eq(productCategory.businessId, businessId),
          eq(productCategory.name, this.normalizeName(name)),
          parentId === null || parentId === undefined
            ? isNull(productCategory.parentId)
            : eq(productCategory.parentId, parentId),
          isNull(productCategory.deletedAt),
          excludeCategoryId
            ? ne(productCategory.id, excludeCategoryId)
            : undefined,
        ),
      )
      .limit(1);

    if (category) {
      throw new ConflictException(
        "Category name already exists for this parent",
      );
    }
  }

  async assertCategoryParent(
    businessId: string,
    parentId?: string | null,
    categoryId?: string,
  ) {
    if (!parentId) {
      return null;
    }

    if (categoryId && parentId === categoryId) {
      throw new BadRequestException("Category cannot be its own parent");
    }

    const [parent] = await this.db
      .select({
        id: productCategory.id,
        parentId: productCategory.parentId,
      })
      .from(productCategory)
      .where(
        and(
          eq(productCategory.id, parentId),
          eq(productCategory.businessId, businessId),
          isNull(productCategory.deletedAt),
        ),
      )
      .limit(1);

    if (!parent) {
      throw new NotFoundException("Parent category not found");
    }

    if (categoryId) {
      await this.assertCategoryParentDoesNotCreateCycle(
        businessId,
        categoryId,
        parent.parentId,
      );
    }

    return parent;
  }

  async assertProductReferences(
    businessId: string,
    params: {
      categoryId?: string | null;
      brandId?: string | null;
      unitId?: string | null;
      taxId?: string | null;
    },
  ) {
    const checks: Promise<unknown>[] = [];

    if (params.categoryId) {
      checks.push(this.assertCategoryExists(businessId, params.categoryId));
    }

    if (params.brandId) {
      checks.push(this.assertBrandExists(businessId, params.brandId));
    }

    if (params.unitId) {
      checks.push(this.assertUnitExists(businessId, params.unitId));
    }

    if (params.taxId) {
      checks.push(this.assertTaxExists(businessId, params.taxId));
    }

    await Promise.all(checks);
  }

  async assertTagsExist(businessId: string, tagIds: string[] = []) {
    const uniqueTagIds = [...new Set(tagIds)];

    if (uniqueTagIds.length === 0) {
      return uniqueTagIds;
    }

    const [{ value }] = await this.db
      .select({ value: count() })
      .from(productTag)
      .where(
        and(
          eq(productTag.businessId, businessId),
          inArray(productTag.id, uniqueTagIds),
          isNull(productTag.deletedAt),
          eq(productTag.status, ProductSimpleStatus.ACTIVE),
        ),
      );

    if (value !== uniqueTagIds.length) {
      throw new BadRequestException("One or more product tags are invalid");
    }

    return uniqueTagIds;
  }

  async assertProductExists(businessId: string, productId: string) {
    const [item] = await this.db
      .select()
      .from(product)
      .where(
        and(
          eq(product.id, productId),
          eq(product.businessId, businessId),
          isNull(product.deletedAt),
        ),
      )
      .limit(1);

    if (!item) {
      throw new NotFoundException(
        "Product could not be found. It may not exist, may have been deleted, or may not belong to the current business or storefront.",
      );
    }

    return item;
  }

  async assertTaxExists(businessId: string, taxId: string) {
    const [tax] = await this.db
      .select({ id: financeTax.id })
      .from(financeTax)
      .where(
        and(
          eq(financeTax.id, taxId),
          eq(financeTax.businessId, businessId),
          isNull(financeTax.deletedAt),
          eq(financeTax.status, FinanceTaxStatus.ACTIVE),
        ),
      )
      .limit(1);

    if (!tax) {
      throw new NotFoundException(
        "Tax could not be found. It may not exist, may have been deleted, or may not belong to the current business.",
      );
    }

    return tax;
  }

  async assertVariantExists(
    businessId: string,
    productId: string,
    variantId: string,
  ) {
    const [variant] = await this.db
      .select()
      .from(productVariant)
      .where(
        and(
          eq(productVariant.id, variantId),
          eq(productVariant.businessId, businessId),
          eq(productVariant.productId, productId),
          isNull(productVariant.deletedAt),
        ),
      )
      .limit(1);

    if (!variant) {
      throw new NotFoundException(
        "Product variant could not be found. It may not exist, may have been deleted, or may not belong to the selected product.",
      );
    }

    return variant;
  }

  async assertSkuAvailable(
    businessId: string,
    sku?: string | null,
    exclude?: { productId?: string; variantId?: string },
  ) {
    const normalizedSku = this.normalizeNullableText(sku);

    if (!normalizedSku) {
      return;
    }

    const [existingProduct, existingVariant] = await Promise.all([
      this.db
        .select({ id: product.id })
        .from(product)
        .where(
          and(
            eq(product.businessId, businessId),
            eq(product.sku, normalizedSku),
            isNull(product.deletedAt),
            exclude?.productId ? ne(product.id, exclude.productId) : undefined,
          ),
        )
        .limit(1)
        .then(([row]) => row ?? null),
      this.db
        .select({ id: productVariant.id })
        .from(productVariant)
        .where(
          and(
            eq(productVariant.businessId, businessId),
            eq(productVariant.sku, normalizedSku),
            isNull(productVariant.deletedAt),
            exclude?.variantId
              ? ne(productVariant.id, exclude.variantId)
              : undefined,
          ),
        )
        .limit(1)
        .then(([row]) => row ?? null),
    ]);

    if (existingProduct || existingVariant) {
      throw new ConflictException("SKU already exists for this business");
    }
  }

  async assertBarcodeAvailable(
    businessId: string,
    barcode?: string | null,
    exclude?: { productId?: string; variantId?: string },
  ) {
    const normalizedBarcode = this.normalizeNullableText(barcode);

    if (!normalizedBarcode) {
      return;
    }

    const [existingProduct, existingVariant] = await Promise.all([
      this.db
        .select({ id: product.id })
        .from(product)
        .where(
          and(
            eq(product.businessId, businessId),
            eq(product.barcode, normalizedBarcode),
            isNull(product.deletedAt),
            exclude?.productId ? ne(product.id, exclude.productId) : undefined,
          ),
        )
        .limit(1)
        .then(([row]) => row ?? null),
      this.db
        .select({ id: productVariant.id })
        .from(productVariant)
        .where(
          and(
            eq(productVariant.businessId, businessId),
            eq(productVariant.barcode, normalizedBarcode),
            isNull(productVariant.deletedAt),
            exclude?.variantId
              ? ne(productVariant.id, exclude.variantId)
              : undefined,
          ),
        )
        .limit(1)
        .then(([row]) => row ?? null),
    ]);

    if (existingProduct || existingVariant) {
      throw new ConflictException("Barcode already exists for this business");
    }
  }

  async assertAttributeValuePairs(
    businessId: string,
    productId: string,
    pairs: { attributeId: string; attributeValueId: string }[] = [],
  ) {
    if (pairs.length === 0) {
      return pairs;
    }

    const attributeIds = pairs.map((pair) => pair.attributeId);
    // const uniqueAttributeIds = new Set(attributeIds);

    // if (uniqueAttributeIds.size !== pairs.length) {
    //   throw new BadRequestException(
    //     "Variant cannot use the same attribute more than once",
    //   );
    // }

    const valueIds = pairs.map((pair) => pair.attributeValueId);
    const values = await this.db
      .select({
        id: productAttributeValue.id,
        attributeId: productAttributeValue.attributeId,
      })
      .from(productAttributeValue)
      .innerJoin(
        productAttribute,
        eq(productAttribute.id, productAttributeValue.attributeId),
      )
      .where(
        and(
          eq(productAttributeValue.businessId, businessId),
          inArray(productAttributeValue.id, valueIds),
          isNull(productAttributeValue.deletedAt),
          eq(productAttribute.businessId, businessId),
          inArray(productAttribute.id, attributeIds),
          isNull(productAttribute.deletedAt),
          eq(productAttribute.status, ProductSimpleStatus.ACTIVE),
        ),
      );

    const validPairs = new Set(
      values.map((value) => `${value.attributeId}:${value.id}`),
    );
    const hasInvalidPair = pairs.some(
      (pair) => !validPairs.has(`${pair.attributeId}:${pair.attributeValueId}`),
    );

    if (hasInvalidPair || values.length !== pairs.length) {
      throw new BadRequestException(
        "One or more variant attribute values are invalid",
      );
    }

    return pairs;
  }

  async generateUniqueProductSlug(
    businessId: string,
    name: string,
    excludeProductId?: string,
  ) {
    for (let attempt = 0; attempt < PRODUCT_SLUG_RETRY_LIMIT; attempt++) {
      const slug = generateRandomSlug(name, {
        fallback: "product",
        maxLength: PRODUCT_SLUG_MAX_LENGTH,
      });

      const [existingProduct] = await this.db
        .select({ id: product.id })
        .from(product)
        .where(
          and(
            eq(product.businessId, businessId),
            eq(product.slug, slug),
            isNull(product.deletedAt),
            excludeProductId ? ne(product.id, excludeProductId) : undefined,
          ),
        )
        .limit(1);

      if (!existingProduct) {
        return slug;
      }
    }

    throw new ConflictException("Could not generate a unique product slug");
  }

  async generateUniqueProductSku(businessId: string) {
    const prefix = await this.prefixes.resolve(
      businessId,
      "productSkuPrefix",
      "SKU",
    );

    return this.generateUniqueProductCode(businessId, prefix, "sku");
  }

  async generateUniqueProductBarcode(businessId: string) {
    const prefix = await this.prefixes.resolve(
      businessId,
      "productBarcodePrefix",
      "BAR",
    );

    return this.generateUniqueProductCode(businessId, prefix, "barcode");
  }

  async generateUniqueVariantSku(businessId: string) {
    const prefix = await this.prefixes.resolve(
      businessId,
      "variantSkuPrefix",
      "SKU",
    );

    return this.generateUniqueVariantCode(businessId, prefix, "sku");
  }

  async generateUniqueVariantBarcode(businessId: string) {
    const prefix = await this.prefixes.resolve(
      businessId,
      "variantBarcodePrefix",
      "BAR",
    );

    return this.generateUniqueVariantCode(businessId, prefix, "barcode");
  }

  normalizeName(value: string) {
    return value.trim();
  }

  normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }

  handleUniqueError(error: unknown, message: string): never {
    if (isUniqueConstraintError(error)) {
      throw new ConflictException(message);
    }

    throw error;
  }

  private async assertCategoryExists(businessId: string, categoryId: string) {
    const [category] = await this.db
      .select({ id: productCategory.id })
      .from(productCategory)
      .where(
        and(
          eq(productCategory.id, categoryId),
          eq(productCategory.businessId, businessId),
          isNull(productCategory.deletedAt),
          eq(productCategory.status, ProductSimpleStatus.ACTIVE),
        ),
      )
      .limit(1);

    if (!category) {
      throw new BadRequestException("Category is invalid");
    }
  }

  private async assertBrandExists(businessId: string, brandId: string) {
    const [brand] = await this.db
      .select({ id: productBrand.id })
      .from(productBrand)
      .where(
        and(
          eq(productBrand.id, brandId),
          eq(productBrand.businessId, businessId),
          isNull(productBrand.deletedAt),
          eq(productBrand.status, ProductSimpleStatus.ACTIVE),
        ),
      )
      .limit(1);

    if (!brand) {
      throw new BadRequestException("Brand is invalid");
    }
  }

  private async assertUnitExists(businessId: string, unitId: string) {
    const [unit] = await this.db
      .select({ id: productUnit.id })
      .from(productUnit)
      .where(
        and(
          eq(productUnit.id, unitId),
          eq(productUnit.businessId, businessId),
          isNull(productUnit.deletedAt),
          eq(productUnit.status, ProductSimpleStatus.ACTIVE),
        ),
      )
      .limit(1);

    if (!unit) {
      throw new BadRequestException("Unit is invalid");
    }
  }

  private async generateUniqueVariantCode(
    businessId: string,
    prefix: string,
    field: "sku" | "barcode",
  ) {
    return this.generateUniqueProductCode(businessId, prefix, field);
  }

  private async generateUniqueProductCode(
    businessId: string,
    prefix: string,
    field: "sku" | "barcode",
  ) {
    for (let attempt = 0; attempt < PRODUCT_CODE_RETRY_LIMIT; attempt++) {
      const code = generateRandomCode(prefix);
      const [existingProduct, existingVariant] = await Promise.all([
        this.db
          .select({ id: product.id })
          .from(product)
          .where(
            and(
              eq(product.businessId, businessId),
              field === "sku"
                ? eq(product.sku, code)
                : eq(product.barcode, code),
              isNull(product.deletedAt),
            ),
          )
          .limit(1)
          .then(([row]) => row ?? null),
        this.db
          .select({ id: productVariant.id })
          .from(productVariant)
          .where(
            and(
              eq(productVariant.businessId, businessId),
              field === "sku"
                ? eq(productVariant.sku, code)
                : eq(productVariant.barcode, code),
              isNull(productVariant.deletedAt),
            ),
          )
          .limit(1)
          .then(([row]) => row ?? null),
      ]);

      if (!existingProduct && !existingVariant) {
        return code;
      }
    }

    throw new ConflictException(`Could not generate a unique product ${field}`);
  }

  private async assertCategoryParentDoesNotCreateCycle(
    businessId: string,
    categoryId: string,
    ancestorId: string | null,
  ) {
    let nextAncestorId = ancestorId;

    while (nextAncestorId) {
      if (nextAncestorId === categoryId) {
        throw new BadRequestException("Category parent would create a cycle");
      }

      const [ancestor] = await this.db
        .select({ parentId: productCategory.parentId })
        .from(productCategory)
        .where(
          and(
            eq(productCategory.id, nextAncestorId),
            eq(productCategory.businessId, businessId),
            isNull(productCategory.deletedAt),
          ),
        )
        .limit(1);

      nextAncestorId = ancestor?.parentId ?? null;
    }
  }
}
