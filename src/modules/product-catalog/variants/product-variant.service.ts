import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, ProductVariantStatus } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { apiResponse } from "../../../common/utils/api-response.util";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { ProductCatalogLookupService } from "../common/product-catalog-lookup.service";
import {
  BulkCreateProductVariantsDto,
  BulkUpdateProductVariantsDto,
  CreateProductVariantDto,
  ProductVariantAttributeInputDto,
  ProductVariantOptionsDto,
  QueryProductVariantDto,
  UpdateProductVariantDto,
} from "./dto/product-variant.dto";

const VARIANT_INCLUDE = {
  product: {
    select: { name: true, price: true },
  },
  attributes: {
    include: {
      attribute: true,
      attributeValue: true,
    },
    orderBy: { createdAt: "asc" },
  },
  images: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
} satisfies Prisma.ProductVariantInclude;

type ProductVariantWithInclude = Prisma.ProductVariantGetPayload<{
  include: typeof VARIANT_INCLUDE;
}>;

type VariantOptionVariant = ProductVariantWithInclude & {
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
    private readonly prisma: PrismaService,
    private readonly lookup: ProductCatalogLookupService,
  ) {}

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
      const variant = await this.prisma.$transaction(async (tx) => {
        const createdVariant = await tx.productVariant.create({
          data: {
            businessId,
            productId,
            title: this.lookup.normalizeName(dto.title),
            sku,
            barcode,
            priceOverride: dto.priceOverride ?? null,
            weight: dto.weight ?? null,
            status: dto.status ?? ProductVariantStatus.ACTIVE,
            createdBy: currentUser.id,
            updatedBy: currentUser.id,
            attributes: this.buildAttributeCreate(attributes),
            images: this.buildImageCreate(
              businessId,
              productId,
              currentUser.id,
              dto.images,
            ),
          },
          include: VARIANT_INCLUDE,
        });

        await tx.inventoryStock.create({
          data: {
            businessId,
            productId,
            variantId: createdVariant.id,
            stockItemKey: this.buildStockItemKey(productId, createdVariant.id),
          },
        });

        await this.zeroProductLevelStock(tx, businessId, productId);

        return createdVariant;
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

    this.assertUniqueAttributeCombinations(
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
      const createdVariants = await this.prisma.$transaction(async (tx) => {
        const created: ProductVariantWithInclude[] = [];

        for (const [index, variant] of variants.entries()) {
          const createdVariant = await tx.productVariant.create({
            data: {
              businessId,
              productId,
              title: variant.title,
              sku: skus[index],
              barcode: barcodes[index],
              priceOverride: variant.dto.priceOverride ?? null,
              weight: variant.dto.weight ?? null,
              status: variant.dto.status ?? ProductVariantStatus.ACTIVE,
              createdBy: currentUser.id,
              updatedBy: currentUser.id,
              attributes: this.buildAttributeCreate(variant.attributes),
              images: this.buildImageCreate(
                businessId,
                productId,
                currentUser.id,
                variant.dto.images,
              ),
            },
            include: VARIANT_INCLUDE,
          });

          await tx.inventoryStock.create({
            data: {
              businessId,
              productId,
              variantId: createdVariant.id,
              stockItemKey: this.buildStockItemKey(
                productId,
                createdVariant.id,
              ),
            },
          });

          created.push(createdVariant);
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
      this.variantMatchesAttributes(variant, selectedAttributes),
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
    const where: Prisma.ProductVariantWhereInput = {
      businessId,
      productId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              {
                attributes: {
                  some: {
                    attribute: {
                      name: { contains: search, mode: "insensitive" },
                      deletedAt: null,
                    },
                  },
                },
              },
              {
                attributes: {
                  some: {
                    attributeValue: {
                      value: { contains: search, mode: "insensitive" },
                      deletedAt: null,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const variants = await this.prisma.productVariant.findMany({
      where,
      include: VARIANT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return apiResponse(variants);
  }

  async findOne(businessId: string, productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, businessId, productId, deletedAt: null },
      include: VARIANT_INCLUDE,
    });

    if (!variant) {
      throw new NotFoundException("Product variant not found");
    }

    return apiResponse(variant);
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
      const variant = await this.prisma.$transaction(async (tx) => {
        if (attributes !== undefined) {
          await tx.productVariantAttribute.deleteMany({ where: { variantId } });
        }

        if (dto.images !== undefined) {
          await tx.productImage.updateMany({
            where: { variantId, deletedAt: null },
            data: { deletedAt: new Date(), updatedBy: currentUser.id },
          });
        }

        return tx.productVariant.update({
          where: { id: variantId },
          data: {
            ...(dto.title !== undefined && {
              title: this.lookup.normalizeName(dto.title),
            }),
            ...(dto.priceOverride !== undefined && {
              priceOverride: dto.priceOverride,
            }),
            ...(dto.weight !== undefined && { weight: dto.weight }),
            ...(dto.status !== undefined && { status: dto.status }),
            updatedBy: currentUser.id,
            ...(attributes !== undefined && {
              attributes: this.buildAttributeCreate(attributes),
            }),
            ...(dto.images !== undefined && {
              images: this.buildImageCreate(
                businessId,
                productId,
                currentUser.id,
                dto.images,
              ),
            }),
          },
          include: VARIANT_INCLUDE,
        });
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

    const existingVariants = await this.prisma.productVariant.findMany({
      where: {
        businessId,
        productId,
        deletedAt: null,
      },
      select: {
        id: true,
        attributes: {
          select: {
            attributeId: true,
            attributeValueId: true,
          },
        },
      },
    });
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

    this.assertBulkUpdateAttributeCombinations(existingVariants, updates);

    try {
      const updatedVariants = await this.prisma.$transaction(async (tx) => {
        const updated: ProductVariantWithInclude[] = [];

        for (const update of updates) {
          if (update.attributes !== undefined) {
            await tx.productVariantAttribute.deleteMany({
              where: { variantId: update.variantId },
            });
          }

          if (update.dto.images !== undefined) {
            await tx.productImage.updateMany({
              where: { variantId: update.variantId, deletedAt: null },
              data: { deletedAt: new Date(), updatedBy: currentUser.id },
            });
          }

          const variant = await tx.productVariant.update({
            where: { id: update.variantId },
            data: {
              ...(update.dto.title !== undefined && {
                title: this.lookup.normalizeName(update.dto.title),
              }),
              ...(update.dto.priceOverride !== undefined && {
                priceOverride: update.dto.priceOverride,
              }),
              ...(update.dto.weight !== undefined && {
                weight: update.dto.weight,
              }),
              ...(update.dto.status !== undefined && {
                status: update.dto.status,
              }),
              updatedBy: currentUser.id,
              ...(update.attributes !== undefined && {
                attributes: this.buildAttributeCreate(update.attributes),
              }),
              ...(update.dto.images !== undefined && {
                images: this.buildImageCreate(
                  businessId,
                  productId,
                  currentUser.id,
                  update.dto.images,
                ),
              }),
            },
            include: VARIANT_INCLUDE,
          });

          updated.push(variant);
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

    await this.prisma.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          status: ProductVariantStatus.INACTIVE,
          deletedAt: new Date(),
          updatedBy: currentUser.id,
        },
      });

      await tx.inventoryStock.deleteMany({
        where: { businessId, variantId },
      });
    });

    return apiResponse(null, "Product variant deleted successfully");
  }

  private buildAttributeCreate(
    attributes: ProductVariantAttributeInputDto[] = [],
  ) {
    return attributes.length > 0
      ? {
          create: attributes.map((attribute) => ({
            attributeId: attribute.attributeId,
            attributeValueId: attribute.attributeValueId,
          })),
        }
      : undefined;
  }

  private async getOptionVariants(businessId: string, productId: string) {
    const variants = await this.prisma.productVariant.findMany({
      where: {
        businessId,
        productId,
        deletedAt: null,
        status: ProductVariantStatus.ACTIVE,
      },
      include: VARIANT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    const stocks = await this.prisma.inventoryStock.findMany({
      where: {
        businessId,
        productId,
        variantId: { in: variants.map((variant) => variant.id) },
      },
      select: {
        variantId: true,
        totalQuantity: true,
        quantityReserved: true,
      },
    });
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
          this.variantMatchesAttributes(variant, comparableSelections),
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

  private variantMatchesAttributes(
    variant: { attributes: ProductVariantAttributeInputDto[] },
    selectedAttributes: ProductVariantAttributeInputDto[],
  ) {
    return selectedAttributes.every((selectedAttribute) =>
      variant.attributes.some(
        (attribute) =>
          attribute.attributeId === selectedAttribute.attributeId &&
          attribute.attributeValueId === selectedAttribute.attributeValueId,
      ),
    );
  }

  private assertUniqueAttributeCombinations(
    attributeSets: ProductVariantAttributeInputDto[][],
  ) {
    const seenKeys = new Set<string>();

    for (const attributes of attributeSets) {
      const key = this.buildAttributeCombinationKey(attributes);

      if (!key) {
        continue;
      }

      if (seenKeys.has(key)) {
        throw new BadRequestException(
          "Bulk variants cannot contain duplicate attribute combinations",
        );
      }

      seenKeys.add(key);
    }
  }

  private assertUniqueVariantIds(variantIds: string[]) {
    const uniqueVariantIds = new Set(variantIds);

    if (uniqueVariantIds.size !== variantIds.length) {
      throw new BadRequestException(
        "Bulk variant update cannot contain duplicate variants",
      );
    }
  }

  private assertBulkUpdateAttributeCombinations(
    existingVariants: {
      id: string;
      attributes: ProductVariantAttributeInputDto[];
    }[],
    updates: {
      variantId: string;
      attributes?: ProductVariantAttributeInputDto[];
    }[],
  ) {
    const nextAttributesByVariantId = new Map(
      updates
        .filter((update) => update.attributes !== undefined)
        .map((update) => [update.variantId, update.attributes ?? []]),
    );
    const keyToVariantIds = new Map<string, string[]>();

    for (const variant of existingVariants) {
      const attributes =
        nextAttributesByVariantId.get(variant.id) ?? variant.attributes;
      const key = this.buildAttributeCombinationKey(attributes);

      if (!key) {
        continue;
      }

      keyToVariantIds.set(key, [
        ...(keyToVariantIds.get(key) ?? []),
        variant.id,
      ]);
    }

    for (const update of updates) {
      const variant = existingVariants.find(
        (existingVariant) => existingVariant.id === update.variantId,
      );
      const attributes =
        update.attributes !== undefined
          ? update.attributes
          : (variant?.attributes ?? []);
      const key = this.buildAttributeCombinationKey(attributes);

      if (!key) {
        continue;
      }

      const conflictingVariantIds = (keyToVariantIds.get(key) ?? []).filter(
        (variantId) => variantId !== update.variantId,
      );

      if (conflictingVariantIds.length > 0) {
        throw new BadRequestException(
          "One or more variant attribute combinations already exist",
        );
      }
    }
  }

  private async assertAttributeCombinationsAvailable(
    businessId: string,
    productId: string,
    attributeSets: ProductVariantAttributeInputDto[][],
  ) {
    const requestedKeys = new Set(
      attributeSets
        .map((attributes) => this.buildAttributeCombinationKey(attributes))
        .filter((key): key is string => Boolean(key)),
    );

    if (requestedKeys.size === 0) {
      return;
    }

    const existingVariants = await this.prisma.productVariant.findMany({
      where: {
        businessId,
        productId,
        deletedAt: null,
      },
      select: {
        attributes: {
          select: {
            attributeId: true,
            attributeValueId: true,
          },
        },
      },
    });

    const hasExistingCombination = existingVariants.some((variant) => {
      const key = this.buildAttributeCombinationKey(variant.attributes);

      return key ? requestedKeys.has(key) : false;
    });

    if (hasExistingCombination) {
      throw new BadRequestException(
        "One or more variant attribute combinations already exist",
      );
    }
  }

  private buildAttributeCombinationKey(
    attributes: ProductVariantAttributeInputDto[] = [],
  ) {
    if (attributes.length === 0) {
      return null;
    }

    return attributes
      .map(
        (attribute) => `${attribute.attributeId}:${attribute.attributeValueId}`,
      )
      .sort()
      .join("|");
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

  private buildImageCreate(
    businessId: string,
    productId: string,
    userId: string,
    images: { imageUrl: string; altText?: string }[] = [],
  ) {
    return images.length > 0
      ? {
          create: images.map((image, index) => ({
            businessId,
            productId,
            imageUrl: image.imageUrl.trim(),
            altText: this.lookup.normalizeNullableText(image.altText),
            sortOrder: index,
            isThumbnail: index === 0,
            createdBy: userId,
            updatedBy: userId,
          })),
        }
      : undefined;
  }

  private async assertVariantCanBeDeleted(
    businessId: string,
    variantId: string,
  ) {
    const referenceCounts = await Promise.all([
      this.prisma.inventoryStock.count({
        where: {
          businessId,
          variantId,
          OR: [{ totalQuantity: { not: 0 } }, { quantityReserved: { not: 0 } }],
        },
      }),
      this.prisma.inventoryWarehouseStock.count({
        where: { businessId, variantId },
      }),
      this.prisma.inventoryStockMovement.count({
        where: { businessId, variantId },
      }),
      this.prisma.inventoryStockAdjustmentItem.count({ where: { variantId } }),
      this.prisma.inventoryStockTransferItem.count({ where: { variantId } }),
      this.prisma.orderCartItem.count({ where: { variantId } }),
      this.prisma.orderOrderItem.count({ where: { variantId } }),
      this.prisma.orderReturnItem.count({ where: { variantId } }),
      this.prisma.invoiceItem.count({ where: { variantId } }),
      this.prisma.supplierProductMap.count({
        where: { businessId, variantId },
      }),
      this.prisma.supplierPurchaseOrderItem.count({
        where: { variantId },
      }),
      this.prisma.supplierInvoiceItem.count({ where: { variantId } }),
      this.prisma.supplierPurchaseReturnItem.count({
        where: { variantId },
      }),
      this.prisma.courierShipmentItem.count({ where: { variantId } }),
      this.prisma.inventoryOrderAllocation.count({
        where: { businessId, variantId },
      }),
    ]);

    if (referenceCounts.some((count) => count > 0)) {
      throw new BadRequestException(
        "Product variant cannot be deleted while referenced by inventory, order, invoice, supplier, or courier records",
      );
    }
  }

  private buildStockItemKey(productId: string, variantId?: string | null) {
    return variantId ?? `product:${productId}`;
  }

  private async zeroProductLevelStock(
    tx: Prisma.TransactionClient,
    businessId: string,
    productId: string,
  ) {
    const stockItemKey = this.buildStockItemKey(productId, null);
    const productStock = await tx.inventoryStock.findUnique({
      where: {
        businessId_stockItemKey: {
          businessId,
          stockItemKey,
        },
      },
    });

    if (!productStock) {
      await tx.inventoryStock.create({
        data: {
          businessId,
          productId,
          variantId: null,
          stockItemKey,
        },
      });
      return;
    }

    await tx.inventoryStock.update({
      where: { id: productStock.id },
      data: {
        totalQuantity: 0,
        quantityReserved: 0,
      },
    });

    await tx.inventoryWarehouseStock.updateMany({
      where: {
        businessId,
        productId,
        variantId: null,
      },
      data: {
        totalQuantity: 0,
        quantityReserved: 0,
      },
    });
  }
}
