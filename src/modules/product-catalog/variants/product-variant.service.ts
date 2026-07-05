import Decimal from "decimal.js";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  ne,
  or,
} from "drizzle-orm";

import {
  businessSetting,
  courierShipmentItem,
  inventoryOrderAllocation,
  inventoryStock,
  inventoryStockAdjustmentItem,
  inventoryStockMovement,
  inventoryStockTransferItem,
  inventoryWarehouseStock,
  invoiceItem,
  orderCartItem,
  orderItem,
  orderReturnItem,
  Product,
  product,
  productAttribute,
  productAttributeValue,
  ProductImage,
  productImage,
  ProductVariant,
  productVariant,
  ProductVariantAttribute,
  productVariantAttribute,
  ProductVariantStatus,
  supplierInvoiceItem,
  supplierProductMap,
  supplierPurchaseOrderItem,
  supplierPurchaseReturnItem,
} from "@/database/schema";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { apiResponse } from "../../../common/utils/api-response.util";
import {
  DatabaseService,
  DatabaseTransaction,
} from "../../../database/database.service";
import { buildStockItemKey } from "../../inventory/domain/stock-item-key";
import { ProductCatalogLookupService } from "../common/product-catalog-lookup.service";
import {
  assertBulkUpdateAttributeCombinations,
  assertUniqueAttributeCombinations,
  buildAttributeCombinationKey,
  variantMatchesAttributes,
} from "./domain/variant-combination.policy";
import {
  BulkCreateProductVariantsDto,
  BulkUpdateProductVariantsDto,
  CreateProductVariantDto,
  ProductVariantAttributeInputDto,
  ProductVariantOptionsDto,
  QueryProductVariantDto,
  UpdateProductVariantDto,
} from "./dto/product-variant.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

type VariantAttributeWithDetails = ProductVariantAttribute & {
  attribute: typeof productAttribute.$inferSelect;
  attributeValue: typeof productAttributeValue.$inferSelect;
};

type ProductVariantWithDetails = ProductVariant & {
  product: Pick<Product, "name" | "price">;
  attributes: VariantAttributeWithDetails[];
  images: ProductImage[];
};

type VariantOptionVariant = ProductVariantWithDetails & {
  stock: {
    totalQuantity: number;
    quantityReserved: number;
    availableQuantity: number;
    inStock: boolean;
  };
  effectivePrice: string;
};

@Injectable()
export class ProductVariantService {
  constructor(
    private readonly database: DatabaseService,
    private readonly lookup: ProductCatalogLookupService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    productId: string,
    dto: CreateProductVariantDto,
  ) {
    await this.lookup.assertProductExists(businessId, productId);

    const attributes = await this.lookup.assertAttributeValuePairs(
      businessId,
      productId,
      dto.attributes,
    );

    const [sku, barcode] = await Promise.all([
      this.lookup.generateUniqueVariantSku(businessId),
      this.lookup.generateUniqueVariantBarcode(businessId),
    ]);

    try {
      const variant = await this.db.transaction(async (tx) => {
        const [createdVariant] = await tx
          .insert(productVariant)
          .values({
            businessId,
            productId,
            title: this.lookup.normalizeName(dto.title),
            sku,
            barcode,
            priceOverride:
              dto.priceOverride === undefined
                ? null
                : new Decimal(dto.priceOverride),
            weight: dto.weight === undefined ? null : new Decimal(dto.weight),
            status: dto.status ?? ProductVariantStatus.ACTIVE,
            createdBy: currentUser.id,
            updatedBy: currentUser.id,
          })
          .returning();

        await this.insertAttributes(tx, createdVariant.id, attributes);
        await this.insertImages(tx, {
          businessId,
          productId,
          variantId: createdVariant.id,
          userId: currentUser.id,
          images: dto.images,
        });

        const lowStockAlertQty = await this.resolveLowStockThreshold(
          tx,
          businessId,
        );

        await tx.insert(inventoryStock).values({
          businessId,
          productId,
          variantId: createdVariant.id,
          stockItemKey: buildStockItemKey(productId, createdVariant.id),
          lowStockAlertQty,
          quantityReserved: new Decimal(0),
          totalQuantity: new Decimal(0),
        });

        await this.zeroProductLevelStock(tx, businessId, productId);

        return this.getVariantDetails(createdVariant);
      });

      return apiResponse(variant, "Product variant created successfully");
    } catch (error) {
      this.lookup.handleUniqueError(
        error,
        "Variant SKU, barcode, or attribute already exists",
      );
    }
  }

  async bulkCreate(
    currentUser: CurrentUserPayload,
    businessId: string,
    productId: string,
    dto: BulkCreateProductVariantsDto,
  ) {
    await this.lookup.assertProductExists(businessId, productId);

    const variants = await Promise.all(
      dto.variants.map(async (variant) => ({
        dto: variant,
        title: this.lookup.normalizeName(variant.title),
        attributes: await this.lookup.assertAttributeValuePairs(
          businessId,
          productId,
          variant.attributes,
        ),
      })),
    );

    assertUniqueAttributeCombinations(
      variants.map((variant) => variant.attributes),
    );
    await this.assertAttributeCombinationsAvailable(
      businessId,
      productId,
      variants.map((variant) => variant.attributes),
    );

    const [skus, barcodes] = await Promise.all([
      this.generateUniqueVariantCodes(businessId, variants.length, "sku"),
      this.generateUniqueVariantCodes(businessId, variants.length, "barcode"),
    ]);

    try {
      const createdVariants = await this.db.transaction(async (tx) => {
        const created: ProductVariantWithDetails[] = [];

        for (const [index, variant] of variants.entries()) {
          const [createdVariant] = await tx
            .insert(productVariant)
            .values({
              businessId,
              productId,
              title: variant.title,
              sku: skus[index],
              barcode: barcodes[index],
              priceOverride:
                variant.dto.priceOverride === undefined
                  ? null
                  : new Decimal(variant.dto.priceOverride),
              weight:
                variant.dto.weight === undefined
                  ? null
                  : new Decimal(variant.dto.weight),
              status: variant.dto.status ?? ProductVariantStatus.ACTIVE,
              createdBy: currentUser.id,
              updatedBy: currentUser.id,
            })
            .returning();

          await this.insertAttributes(
            tx,
            createdVariant.id,
            variant.attributes,
          );
          await this.insertImages(tx, {
            businessId,
            productId,
            variantId: createdVariant.id,
            userId: currentUser.id,
            images: variant.dto.images,
          });

          const lowStockAlertQty = await this.resolveLowStockThreshold(
            tx,
            businessId,
          );

          await tx.insert(inventoryStock).values({
            businessId,
            productId,
            variantId: createdVariant.id,
            stockItemKey: buildStockItemKey(productId, createdVariant.id),
            lowStockAlertQty,
            quantityReserved: new Decimal(0),
            totalQuantity: new Decimal(0),
          });

          created.push(await this.getVariantDetails(createdVariant));
        }

        await this.zeroProductLevelStock(tx, businessId, productId);

        return created;
      });

      return apiResponse(
        createdVariants,
        "Product variants created successfully",
      );
    } catch (error) {
      this.lookup.handleUniqueError(
        error,
        "Variant SKU, barcode, or attribute already exists",
      );
    }
  }

  async options(
    businessId: string,
    productId: string,
    dto: ProductVariantOptionsDto,
  ) {
    await this.lookup.assertProductExists(businessId, productId);

    const selectedAttributes = await this.lookup.assertAttributeValuePairs(
      businessId,
      productId,
      dto.selectedAttributes,
    );
    const includeOutOfStock = dto.includeOutOfStock ?? true;
    const variants = await this.getOptionVariants(businessId, productId);
    const selectableVariants = includeOutOfStock
      ? variants
      : variants.filter((variant) => variant.stock.inStock);
    const matchingVariants = selectableVariants.filter((variant) =>
      variantMatchesAttributes(variant, selectedAttributes),
    );

    const availableOptions = this.buildAvailableOptions(
      variants,
      selectedAttributes,
      includeOutOfStock,
    );
    const selectedVariant =
      selectedAttributes.length > 0 && matchingVariants.length === 1
        ? matchingVariants[0]
        : null;

    return apiResponse({
      selectedAttributes: this.describeSelectedAttributes(
        variants,
        selectedAttributes,
      ),
      availableOptions,
      matchingVariants,
      selectedVariant,
    });
  }

  async findAll(
    businessId: string,
    productId: string,
    query: QueryProductVariantDto,
  ) {
    await this.lookup.assertProductExists(businessId, productId);

    const search = query.search?.trim();
    const where = and(
      eq(productVariant.businessId, businessId),
      eq(productVariant.productId, productId),
      isNull(productVariant.deletedAt),
      search
        ? or(
            ilike(productVariant.title, `%${search}%`),
            ilike(productVariant.sku, `%${search}%`),
            ilike(productVariant.barcode, `%${search}%`),
            exists(
              this.db
                .select({ id: productVariantAttribute.id })
                .from(productVariantAttribute)
                .innerJoin(
                  productAttribute,
                  eq(productAttribute.id, productVariantAttribute.attributeId),
                )
                .where(
                  and(
                    eq(productVariantAttribute.variantId, productVariant.id),
                    ilike(productAttribute.name, `%${search}%`),
                    isNull(productAttribute.deletedAt),
                  ),
                ),
            ),
            exists(
              this.db
                .select({ id: productVariantAttribute.id })
                .from(productVariantAttribute)
                .innerJoin(
                  productAttributeValue,
                  eq(
                    productAttributeValue.id,
                    productVariantAttribute.attributeValueId,
                  ),
                )
                .where(
                  and(
                    eq(productVariantAttribute.variantId, productVariant.id),
                    ilike(productAttributeValue.value, `%${search}%`),
                    isNull(productAttributeValue.deletedAt),
                  ),
                ),
            ),
          )
        : undefined,
    );

    const variants = await this.db
      .select()
      .from(productVariant)
      .where(where)
      .orderBy(desc(productVariant.createdAt))
      .then((rows) => this.getVariantsDetails(rows));

    return apiResponse(variants);
  }

  async findOne(businessId: string, productId: string, variantId: string) {
    const variant = await this.findVariantRow(businessId, productId, variantId);

    if (!variant) {
      throw new NotFoundException(
        "Product variant could not be found. It may not exist, may have been deleted, or may not belong to the selected product.",
      );
    }

    return apiResponse(await this.getVariantDetails(variant));
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    productId: string,
    variantId: string,
    dto: UpdateProductVariantDto,
  ) {
    await this.lookup.assertVariantExists(businessId, productId, variantId);

    const attributes =
      dto.attributes !== undefined
        ? await this.lookup.assertAttributeValuePairs(
            businessId,
            productId,
            dto.attributes,
          )
        : undefined;

    try {
      const variant = await this.db.transaction(async (tx) => {
        if (attributes !== undefined) {
          await tx
            .delete(productVariantAttribute)
            .where(eq(productVariantAttribute.variantId, variantId));
          await this.insertAttributes(tx, variantId, attributes);
        }

        if (dto.images !== undefined) {
          await tx
            .update(productImage)
            .set({
              deletedAt: new Date(),
              deletedBy: currentUser.id,
              updatedBy: currentUser.id,
            })
            .where(
              and(
                eq(productImage.variantId, variantId),
                isNull(productImage.deletedAt),
              ),
            );
          await this.insertImages(tx, {
            businessId,
            productId,
            variantId,
            userId: currentUser.id,
            images: dto.images,
          });
        }

        const [updated] = await tx
          .update(productVariant)
          .set({
            ...(dto.title !== undefined && {
              title: this.lookup.normalizeName(dto.title),
            }),
            ...(dto.priceOverride !== undefined && {
              priceOverride:
                dto.priceOverride === null
                  ? null
                  : new Decimal(dto.priceOverride),
            }),
            ...(dto.weight !== undefined && {
              weight: dto.weight === null ? null : new Decimal(dto.weight),
            }),
            ...(dto.status !== undefined && { status: dto.status }),
            updatedBy: currentUser.id,
          })
          .where(eq(productVariant.id, variantId))
          .returning();

        return this.getVariantDetails(updated);
      });

      return apiResponse(variant, "Product variant updated successfully");
    } catch (error) {
      this.lookup.handleUniqueError(error, "Variant attribute already exists");
    }
  }

  async bulkUpdate(
    currentUser: CurrentUserPayload,
    businessId: string,
    productId: string,
    dto: BulkUpdateProductVariantsDto,
  ) {
    await this.lookup.assertProductExists(businessId, productId);

    const variantIds = dto.variants.map((variant) => variant.variantId);
    this.assertUniqueVariantIds(variantIds);

    const existingRows = await this.db
      .select()
      .from(productVariant)
      .where(
        and(
          eq(productVariant.businessId, businessId),
          eq(productVariant.productId, productId),
          isNull(productVariant.deletedAt),
        ),
      );
    const existingVariants = await Promise.all(
      existingRows.map(async (variant) => ({
        id: variant.id,
        attributes: await this.getAttributeSelections(variant.id),
      })),
    );
    const existingVariantIds = new Set(
      existingVariants.map((variant) => variant.id),
    );

    if (variantIds.some((variantId) => !existingVariantIds.has(variantId))) {
      throw new NotFoundException(
        "One or more product variants were not found",
      );
    }

    const updates = await Promise.all(
      dto.variants.map(async (variant) => ({
        dto: variant,
        variantId: variant.variantId,
        attributes:
          variant.attributes !== undefined
            ? await this.lookup.assertAttributeValuePairs(
                businessId,
                productId,
                variant.attributes,
              )
            : undefined,
      })),
    );

    assertBulkUpdateAttributeCombinations(existingVariants, updates);

    try {
      const updatedVariants = await this.db.transaction(async (tx) => {
        const updated: ProductVariantWithDetails[] = [];

        for (const update of updates) {
          if (update.attributes !== undefined) {
            await tx
              .delete(productVariantAttribute)
              .where(eq(productVariantAttribute.variantId, update.variantId));
            await this.insertAttributes(
              tx,
              update.variantId,
              update.attributes,
            );
          }

          if (update.dto.images !== undefined) {
            await tx
              .update(productImage)
              .set({
                deletedAt: new Date(),
                deletedBy: currentUser.id,
                updatedBy: currentUser.id,
              })
              .where(
                and(
                  eq(productImage.variantId, update.variantId),
                  isNull(productImage.deletedAt),
                ),
              );
            await this.insertImages(tx, {
              businessId,
              productId,
              variantId: update.variantId,
              userId: currentUser.id,
              images: update.dto.images,
            });
          }

          const [variant] = await tx
            .update(productVariant)
            .set({
              ...(update.dto.title !== undefined && {
                title: this.lookup.normalizeName(update.dto.title),
              }),
              ...(update.dto.priceOverride !== undefined && {
                priceOverride:
                  update.dto.priceOverride === null
                    ? null
                    : new Decimal(update.dto.priceOverride),
              }),
              ...(update.dto.weight !== undefined && {
                weight:
                  update.dto.weight === null
                    ? null
                    : new Decimal(update.dto.weight),
              }),
              ...(update.dto.status !== undefined && {
                status: update.dto.status,
              }),
              updatedBy: currentUser.id,
            })
            .where(eq(productVariant.id, update.variantId))
            .returning();

          updated.push(await this.getVariantDetails(variant));
        }

        return updated;
      });

      return apiResponse(
        updatedVariants,
        "Product variants updated successfully",
      );
    } catch (error) {
      this.lookup.handleUniqueError(error, "Variant attribute already exists");
    }
  }

  async updateAttributes(
    currentUser: CurrentUserPayload,
    businessId: string,
    productId: string,
    variantId: string,
    attributes: ProductVariantAttributeInputDto[],
  ) {
    return this.update(currentUser, businessId, productId, variantId, {
      attributes,
    });
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    productId: string,
    variantId: string,
  ) {
    await this.lookup.assertVariantExists(businessId, productId, variantId);
    await this.assertVariantCanBeDeleted(businessId, variantId);

    await this.db.transaction(async (tx) => {
      await tx
        .update(productVariant)
        .set({
          status: ProductVariantStatus.INACTIVE,
          deletedAt: new Date(),
          deletedBy: currentUser.id,
          updatedBy: currentUser.id,
        })
        .where(eq(productVariant.id, variantId));

      await tx
        .delete(inventoryStock)
        .where(
          and(
            eq(inventoryStock.businessId, businessId),
            eq(inventoryStock.variantId, variantId),
          ),
        );
    });

    return apiResponse(null, "Product variant deleted successfully");
  }

  private async insertAttributes(
    tx: DatabaseTransaction,
    variantId: string,
    attributes: ProductVariantAttributeInputDto[] = [],
  ) {
    if (attributes.length > 0) {
      await tx.insert(productVariantAttribute).values(
        attributes.map((attribute) => ({
          variantId,
          attributeId: attribute.attributeId,
          attributeValueId: attribute.attributeValueId,
        })),
      );
    }
  }

  private async insertImages(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      productId: string;
      variantId: string;
      userId: string;
      images: { imageUrl: string; altText?: string }[] | undefined;
    },
  ) {
    if (!params.images?.length) {
      return;
    }

    await tx.insert(productImage).values(
      params.images.map((image, index) => ({
        businessId: params.businessId,
        productId: params.productId,
        variantId: params.variantId,
        imageUrl: image.imageUrl.trim(),
        altText: this.lookup.normalizeNullableText(image.altText),
        isThumbnail: index === 0,
        createdBy: params.userId,
        updatedBy: params.userId,
      })),
    );
  }

  private async getOptionVariants(businessId: string, productId: string) {
    const variants = await this.db
      .select()
      .from(productVariant)
      .where(
        and(
          eq(productVariant.businessId, businessId),
          eq(productVariant.productId, productId),
          isNull(productVariant.deletedAt),
          eq(productVariant.status, ProductVariantStatus.ACTIVE),
        ),
      )
      .orderBy(desc(productVariant.createdAt))
      .then((rows) => this.getVariantsDetails(rows));
    const stocks = await this.db
      .select({
        variantId: inventoryStock.variantId,
        totalQuantity: inventoryStock.totalQuantity,
        quantityReserved: inventoryStock.quantityReserved,
      })
      .from(inventoryStock)
      .where(
        and(
          eq(inventoryStock.businessId, businessId),
          eq(inventoryStock.productId, productId),
          inArray(
            inventoryStock.variantId,
            variants.map((variant) => variant.id),
          ),
        ),
      );
    const stockByVariantId = new Map(
      stocks
        .filter((stock) => stock.variantId)
        .map((stock) => [
          stock.variantId,
          {
            totalQuantity: Number(stock.totalQuantity.toString()),
            quantityReserved: Number(stock.quantityReserved.toString()),
          },
        ]),
    );

    return variants.map((variant) => {
      const stock = stockByVariantId.get(variant.id) ?? {
        totalQuantity: 0,
        quantityReserved: 0,
      };
      const availableQuantity = Math.max(
        stock.totalQuantity - stock.quantityReserved,
        0,
      );

      return {
        ...variant,
        effectivePrice: (
          variant.priceOverride ?? variant.product.price
        ).toString(),
        stock: {
          ...stock,
          availableQuantity,
          inStock: availableQuantity > 0,
        },
      } satisfies VariantOptionVariant;
    });
  }

  private buildAvailableOptions(
    variants: VariantOptionVariant[],
    selectedAttributes: ProductVariantAttributeInputDto[],
    includeOutOfStock: boolean,
  ) {
    const attributes = new Map<
      string,
      {
        attributeId: string;
        name: string;
        values: Map<
          string,
          {
            attributeValueId: string;
            value: string;
            matchingVariantCount: number;
            availableQuantity: number;
            inStock: boolean;
            selected: boolean;
          }
        >;
      }
    >();
    const selectedValueByAttributeId = new Map(
      selectedAttributes.map((attribute) => [
        attribute.attributeId,
        attribute.attributeValueId,
      ]),
    );

    for (const variant of variants) {
      for (const attribute of variant.attributes) {
        if (!attributes.has(attribute.attributeId)) {
          attributes.set(attribute.attributeId, {
            attributeId: attribute.attributeId,
            name: attribute.attribute.name,
            values: new Map(),
          });
        }
      }
    }

    for (const option of attributes.values()) {
      const comparableSelections = selectedAttributes.filter(
        (attribute) => attribute.attributeId !== option.attributeId,
      );
      const candidateVariants = variants.filter(
        (variant) =>
          (includeOutOfStock || variant.stock.inStock) &&
          variantMatchesAttributes(variant, comparableSelections),
      );

      for (const variant of candidateVariants) {
        const attribute = variant.attributes.find(
          (item) => item.attributeId === option.attributeId,
        );

        if (!attribute) {
          continue;
        }

        const current = option.values.get(attribute.attributeValueId) ?? {
          attributeValueId: attribute.attributeValueId,
          value: attribute.attributeValue.value,
          matchingVariantCount: 0,
          availableQuantity: 0,
          inStock: false,
          selected:
            selectedValueByAttributeId.get(option.attributeId) ===
            attribute.attributeValueId,
        };

        current.matchingVariantCount += 1;
        current.availableQuantity += variant.stock.availableQuantity;
        current.inStock = current.inStock || variant.stock.inStock;
        option.values.set(attribute.attributeValueId, current);
      }
    }

    return Array.from(attributes.values())
      .map((option) => ({
        attributeId: option.attributeId,
        name: option.name,
        values: Array.from(option.values.values()).sort((a, b) =>
          a.value.localeCompare(b.value),
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private describeSelectedAttributes(
    variants: VariantOptionVariant[],
    selectedAttributes: ProductVariantAttributeInputDto[],
  ) {
    return selectedAttributes.map((selectedAttribute) => {
      const attribute = variants
        .flatMap((variant) => variant.attributes)
        .find(
          (item) =>
            item.attributeId === selectedAttribute.attributeId &&
            item.attributeValueId === selectedAttribute.attributeValueId,
        );

      return {
        attributeId: selectedAttribute.attributeId,
        attributeName: attribute?.attribute.name ?? null,
        attributeValueId: selectedAttribute.attributeValueId,
        attributeValue: attribute?.attributeValue.value ?? null,
      };
    });
  }

  private assertUniqueVariantIds(variantIds: string[]) {
    const uniqueVariantIds = new Set(variantIds);

    if (uniqueVariantIds.size !== variantIds.length) {
      throw new BadRequestException(
        "Bulk variant update cannot contain duplicate variants",
      );
    }
  }

  private async assertAttributeCombinationsAvailable(
    businessId: string,
    productId: string,
    attributeSets: ProductVariantAttributeInputDto[][],
  ) {
    const requestedKeys = new Set(
      attributeSets
        .map((attributes) => buildAttributeCombinationKey(attributes))
        .filter((key): key is string => Boolean(key)),
    );

    if (requestedKeys.size === 0) {
      return;
    }

    const existingRows = await this.db
      .select()
      .from(productVariant)
      .where(
        and(
          eq(productVariant.businessId, businessId),
          eq(productVariant.productId, productId),
          isNull(productVariant.deletedAt),
        ),
      );
    const existingVariants = await Promise.all(
      existingRows.map(async (variant) => ({
        attributes: await this.getAttributeSelections(variant.id),
      })),
    );

    const hasExistingCombination = existingVariants.some((variant) => {
      const key = buildAttributeCombinationKey(variant.attributes);

      return key ? requestedKeys.has(key) : false;
    });

    if (hasExistingCombination) {
      throw new BadRequestException(
        "One or more variant attribute combinations already exist",
      );
    }
  }

  private async generateUniqueVariantCodes(
    businessId: string,
    amount: number,
    codeType: "sku" | "barcode",
  ) {
    const codes = new Set<string>();
    const maxAttempts = amount * 10;
    let attempts = 0;

    while (codes.size < amount && attempts < maxAttempts) {
      attempts += 1;

      const code =
        codeType === "sku"
          ? await this.lookup.generateUniqueVariantSku(businessId)
          : await this.lookup.generateUniqueVariantBarcode(businessId);

      codes.add(code);
    }

    if (codes.size !== amount) {
      throw new BadRequestException(
        `Could not generate enough unique variant ${codeType}s`,
      );
    }

    return Array.from(codes);
  }

  private async assertVariantCanBeDeleted(
    businessId: string,
    variantId: string,
  ) {
    const referenceCounts = await Promise.all([
      this.countInventoryStockReferences(businessId, variantId),
      this.countByBusinessVariant(
        inventoryWarehouseStock,
        businessId,
        variantId,
      ),
      this.countByBusinessVariant(
        inventoryStockMovement,
        businessId,
        variantId,
      ),
      this.countByVariant(inventoryStockAdjustmentItem, variantId),
      this.countByVariant(inventoryStockTransferItem, variantId),
      this.countByVariant(orderCartItem, variantId),
      this.countByVariant(orderItem, variantId),
      this.countByVariant(orderReturnItem, variantId),
      this.countByVariant(invoiceItem, variantId),
      this.countByBusinessVariant(supplierProductMap, businessId, variantId),
      this.countByVariant(supplierPurchaseOrderItem, variantId),
      this.countByVariant(supplierInvoiceItem, variantId),
      this.countByVariant(supplierPurchaseReturnItem, variantId),
      this.countByVariant(courierShipmentItem, variantId),
      this.countByBusinessVariant(
        inventoryOrderAllocation,
        businessId,
        variantId,
      ),
    ]);

    if (referenceCounts.some((value) => value > 0)) {
      throw new BadRequestException(
        "Product variant cannot be deleted while referenced by inventory, order, invoice, supplier, or courier records",
      );
    }
  }

  private countInventoryStockReferences(businessId: string, variantId: string) {
    return this.db
      .select({ value: count() })
      .from(inventoryStock)
      .where(
        and(
          eq(inventoryStock.businessId, businessId),
          eq(inventoryStock.variantId, variantId),
          or(
            ne(inventoryStock.totalQuantity, new Decimal(0)),
            ne(inventoryStock.quantityReserved, new Decimal(0)),
          ),
        ),
      )
      .then(([row]) => row?.value ?? 0);
  }

  private countByBusinessVariant(
    table:
      | typeof inventoryWarehouseStock
      | typeof inventoryStockMovement
      | typeof supplierProductMap
      | typeof inventoryOrderAllocation,
    businessId: string,
    variantId: string,
  ) {
    return this.db
      .select({ value: count() })
      .from(table)
      .where(
        and(eq(table.businessId, businessId), eq(table.variantId, variantId)),
      )
      .then(([row]) => row?.value ?? 0);
  }

  private countByVariant(
    table:
      | typeof inventoryStockAdjustmentItem
      | typeof inventoryStockTransferItem
      | typeof orderCartItem
      | typeof orderItem
      | typeof orderReturnItem
      | typeof invoiceItem
      | typeof supplierPurchaseOrderItem
      | typeof supplierInvoiceItem
      | typeof supplierPurchaseReturnItem
      | typeof courierShipmentItem,
    variantId: string,
  ) {
    return this.db
      .select({ value: count() })
      .from(table)
      .where(eq(table.variantId, variantId))
      .then(([row]) => row?.value ?? 0);
  }

  private async zeroProductLevelStock(
    tx: DatabaseTransaction,
    businessId: string,
    productId: string,
  ) {
    const stockItemKey = buildStockItemKey(productId, null);
    const [productStock] = await tx
      .select()
      .from(inventoryStock)
      .where(
        and(
          eq(inventoryStock.businessId, businessId),
          eq(inventoryStock.stockItemKey, stockItemKey),
        ),
      )
      .limit(1);

    if (!productStock) {
      const lowStockAlertQty = await this.resolveLowStockThreshold(
        tx,
        businessId,
      );

      await tx.insert(inventoryStock).values({
        businessId,
        productId,
        variantId: null,
        stockItemKey,
        lowStockAlertQty,
        quantityReserved: new Decimal(0),
        totalQuantity: new Decimal(0),
      });
      return;
    }

    await tx
      .update(inventoryStock)
      .set({
        totalQuantity: new Decimal(0),
        quantityReserved: new Decimal(0),
      })
      .where(eq(inventoryStock.id, productStock.id));

    await tx
      .update(inventoryWarehouseStock)
      .set({
        totalQuantity: new Decimal(0),
        quantityReserved: new Decimal(0),
      })
      .where(
        and(
          eq(inventoryWarehouseStock.businessId, businessId),
          eq(inventoryWarehouseStock.productId, productId),
          isNull(inventoryWarehouseStock.variantId),
        ),
      );
  }

  private findVariantRow(
    businessId: string,
    productId: string,
    variantId: string,
  ) {
    return this.db
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
      .limit(1)
      .then(([row]) => row ?? null);
  }

  private async resolveLowStockThreshold(
    tx: DatabaseTransaction,
    businessId: string,
  ) {
    const [settings] = await tx
      .select({ lowStockThreshold: businessSetting.lowStockThreshold })
      .from(businessSetting)
      .where(eq(businessSetting.businessId, businessId))
      .limit(1);

    return new Decimal(settings?.lowStockThreshold ?? 0);
  }

  private async getVariantsDetails(variants: ProductVariant[]) {
    return Promise.all(
      variants.map((variant) => this.getVariantDetails(variant)),
    );
  }

  private async getVariantDetails(
    variant: ProductVariant,
  ): Promise<ProductVariantWithDetails> {
    const [productSummary, attributes, images] = await Promise.all([
      this.db
        .select({ name: product.name, price: product.price })
        .from(product)
        .where(eq(product.id, variant.productId))
        .limit(1)
        .then(([row]) => row),
      this.getVariantAttributes(variant.id),
      this.getImages(variant.productId, variant.id),
    ]);

    if (!productSummary) {
      throw new NotFoundException(
        "Product could not be found. It may not exist, may have been deleted, or may not belong to the current business or storefront.",
      );
    }

    return {
      ...variant,
      product: productSummary,
      attributes,
      images,
    };
  }

  private getImages(productId: string, variantId: string) {
    return this.db
      .select()
      .from(productImage)
      .where(
        and(
          eq(productImage.productId, productId),
          eq(productImage.variantId, variantId),
          isNull(productImage.deletedAt),
        ),
      );
  }

  private async getVariantAttributes(
    variantId: string,
  ): Promise<VariantAttributeWithDetails[]> {
    const rows = await this.db
      .select({
        map: productVariantAttribute,
        attribute: productAttribute,
        attributeValue: productAttributeValue,
      })
      .from(productVariantAttribute)
      .innerJoin(
        productAttribute,
        eq(productAttribute.id, productVariantAttribute.attributeId),
      )
      .innerJoin(
        productAttributeValue,
        eq(productAttributeValue.id, productVariantAttribute.attributeValueId),
      )
      .where(eq(productVariantAttribute.variantId, variantId))
      .orderBy(asc(productVariantAttribute.createdAt));

    return rows.map((row) => ({
      ...row.map,
      attribute: row.attribute,
      attributeValue: row.attributeValue,
    }));
  }

  private getAttributeSelections(variantId: string) {
    return this.db
      .select({
        attributeId: productVariantAttribute.attributeId,
        attributeValueId: productVariantAttribute.attributeValueId,
      })
      .from(productVariantAttribute)
      .where(eq(productVariantAttribute.variantId, variantId));
  }
}
