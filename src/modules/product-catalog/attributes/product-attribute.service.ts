import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type ProductAttribute,
  type ProductAttributeValue,
  ProductSimpleStatus,
  productAttribute,
  productAttributeValue,
  productVariantAttribute,
} from "@/database/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  isNull,
  ne,
  or,
} from "drizzle-orm";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import {
  CreateProductAttributeDto,
  CreateProductAttributeValueDto,
  ProductAttributeSortBy,
  QueryProductAttributeDto,
  UpdateProductAttributeDto,
  UpdateProductAttributeValueDto,
} from "./dto/product-attribute.dto";
import { ProductCatalogLookupService } from "../common/product-catalog-lookup.service";
import { CatalogSortOrder } from "../common/dto/query-catalog.dto";
import { DatabaseService } from "../../../database/database.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";

type AttributeWithValues = ProductAttribute & {
  values: ProductAttributeValue[];
};

@Injectable()
export class ProductAttributeService {
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
    dto: CreateProductAttributeDto,
  ) {
    await this.assertAttributeNameAvailable(businessId, dto.name);

    const values = this.normalizeValues(dto.values);

    try {
      const attribute = await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(productAttribute)
          .values({
            businessId,
            name: this.lookup.normalizeName(dto.name),
            status: dto.status ?? ProductSimpleStatus.ACTIVE,
            createdBy: currentUser.id,
            updatedBy: currentUser.id,
          })
          .returning();

        if (values.length > 0) {
          await tx.insert(productAttributeValue).values(
            values.map((value) => ({
              businessId,
              attributeId: created.id,
              value,
              createdBy: currentUser.id,
              updatedBy: currentUser.id,
            })),
          );
        }

        return this.withAttributeValues(created);
      });

      return apiResponse(attribute, "Product attribute created successfully");
    } catch (error) {
      this.lookup.handleUniqueError(
        error,
        "Product attribute or value already exists",
      );
    }
  }

  async findAll(businessId: string, query: QueryProductAttributeDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? ProductAttributeSortBy.NAME;
    const sortOrder = query.sortOrder ?? CatalogSortOrder.ASC;
    const where = and(
      eq(productAttribute.businessId, businessId),
      isNull(productAttribute.deletedAt),
      query.status ? eq(productAttribute.status, query.status) : undefined,
      query.search
        ? or(
            ilike(productAttribute.name, `%${query.search}%`),
            exists(
              this.db
                .select({ id: productAttributeValue.id })
                .from(productAttributeValue)
                .where(
                  and(
                    eq(productAttributeValue.attributeId, productAttribute.id),
                    ilike(productAttributeValue.value, `%${query.search}%`),
                    isNull(productAttributeValue.deletedAt),
                  ),
                ),
            ),
          )
        : undefined,
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(productAttribute)
        .where(where)
        .orderBy(
          this.attributeOrderBy(sortBy, sortOrder),
          asc(productAttribute.createdAt),
        )
        .limit(limit)
        .offset(skip)
        .then((rows) => this.withAttributesValues(rows)),
      this.db
        .select({ value: count() })
        .from(productAttribute)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, attributeId: string) {
    return apiResponse(
      await this.findAttributeOrThrow(businessId, attributeId),
    );
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    attributeId: string,
    dto: UpdateProductAttributeDto,
  ) {
    await this.findAttributeOrThrow(businessId, attributeId);

    if (dto.name !== undefined) {
      await this.assertAttributeNameAvailable(
        businessId,
        dto.name,
        attributeId,
      );
    }

    try {
      const [attribute] = await this.db
        .update(productAttribute)
        .set({
          ...(dto.name !== undefined && {
            name: this.lookup.normalizeName(dto.name),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          updatedBy: currentUser.id,
        })
        .where(eq(productAttribute.id, attributeId))
        .returning();

      return apiResponse(
        await this.withAttributeValues(attribute),
        "Product attribute updated successfully",
      );
    } catch (error) {
      this.lookup.handleUniqueError(error, "Product attribute already exists");
    }
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    attributeId: string,
  ) {
    await this.findAttributeOrThrow(businessId, attributeId);
    await this.assertAttributeCanBeDeleted(attributeId);

    await this.db.transaction(async (tx) => {
      const deletedAt = new Date();
      await tx
        .update(productAttributeValue)
        .set({
          deletedAt,
          deletedBy: currentUser.id,
          updatedBy: currentUser.id,
        })
        .where(
          and(
            eq(productAttributeValue.attributeId, attributeId),
            isNull(productAttributeValue.deletedAt),
          ),
        );

      await tx
        .update(productAttribute)
        .set({
          status: ProductSimpleStatus.INACTIVE,
          deletedAt,
          deletedBy: currentUser.id,
          updatedBy: currentUser.id,
        })
        .where(eq(productAttribute.id, attributeId));
    });

    return apiResponse(null, "Product attribute deleted successfully");
  }

  async createValue(
    currentUser: CurrentUserPayload,
    businessId: string,
    attributeId: string,
    dto: CreateProductAttributeValueDto,
  ) {
    await this.findAttributeOrThrow(businessId, attributeId);

    try {
      const [value] = await this.db
        .insert(productAttributeValue)
        .values({
          businessId,
          attributeId,
          value: this.lookup.normalizeName(dto.value),
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        })
        .returning();

      return apiResponse(value, "Product attribute value created successfully");
    } catch (error) {
      this.lookup.handleUniqueError(
        error,
        "Product attribute value already exists",
      );
    }
  }

  async updateValue(
    currentUser: CurrentUserPayload,
    businessId: string,
    attributeId: string,
    valueId: string,
    dto: UpdateProductAttributeValueDto,
  ) {
    await this.findValueOrThrow(businessId, attributeId, valueId);

    try {
      const [value] = await this.db
        .update(productAttributeValue)
        .set({
          ...(dto.value !== undefined && {
            value: this.lookup.normalizeName(dto.value),
          }),
          updatedBy: currentUser.id,
        })
        .where(eq(productAttributeValue.id, valueId))
        .returning();

      return apiResponse(value, "Product attribute value updated successfully");
    } catch (error) {
      this.lookup.handleUniqueError(
        error,
        "Product attribute value already exists",
      );
    }
  }

  async removeValue(
    currentUser: CurrentUserPayload,
    businessId: string,
    attributeId: string,
    valueId: string,
  ) {
    await this.findValueOrThrow(businessId, attributeId, valueId);
    await this.assertAttributeValueCanBeDeleted(attributeId, valueId);

    await this.db
      .update(productAttributeValue)
      .set({
        deletedAt: new Date(),
        deletedBy: currentUser.id,
        updatedBy: currentUser.id,
      })
      .where(eq(productAttributeValue.id, valueId));

    return apiResponse(null, "Product attribute value deleted successfully");
  }

  private async findAttributeOrThrow(businessId: string, attributeId: string) {
    const [attribute] = await this.db
      .select()
      .from(productAttribute)
      .where(
        and(
          eq(productAttribute.id, attributeId),
          eq(productAttribute.businessId, businessId),
          isNull(productAttribute.deletedAt),
        ),
      )
      .limit(1);

    if (!attribute) {
      throw new NotFoundException("Product attribute not found");
    }

    return this.withAttributeValues(attribute);
  }

  private async findValueOrThrow(
    businessId: string,
    attributeId: string,
    valueId: string,
  ) {
    await this.findAttributeOrThrow(businessId, attributeId);

    const [value] = await this.db
      .select()
      .from(productAttributeValue)
      .where(
        and(
          eq(productAttributeValue.id, valueId),
          eq(productAttributeValue.businessId, businessId),
          eq(productAttributeValue.attributeId, attributeId),
          isNull(productAttributeValue.deletedAt),
        ),
      )
      .limit(1);

    if (!value) {
      throw new NotFoundException("Product attribute value not found");
    }

    return value;
  }

  private async assertAttributeNameAvailable(
    businessId: string,
    name: string,
    excludeAttributeId?: string,
  ) {
    const [attribute] = await this.db
      .select({ id: productAttribute.id })
      .from(productAttribute)
      .where(
        and(
          eq(productAttribute.businessId, businessId),
          eq(productAttribute.name, this.lookup.normalizeName(name)),
          isNull(productAttribute.deletedAt),
          excludeAttributeId
            ? ne(productAttribute.id, excludeAttributeId)
            : undefined,
        ),
      )
      .limit(1);

    if (attribute) {
      throw new BadRequestException(
        "Product attribute name already exists for this business",
      );
    }
  }

  private normalizeValues(values: CreateProductAttributeValueDto[] = []) {
    const normalizedValues = values.map((item) =>
      this.lookup.normalizeName(item.value),
    );
    const uniqueValues = new Set(
      normalizedValues.map((value) => value.toLowerCase()),
    );

    if (uniqueValues.size !== normalizedValues.length) {
      throw new BadRequestException("Attribute values must be unique");
    }

    return normalizedValues;
  }

  private async assertAttributeCanBeDeleted(attributeId: string) {
    const [{ value }] = await this.db
      .select({ value: count() })
      .from(productVariantAttribute)
      .where(eq(productVariantAttribute.attributeId, attributeId));

    if (value > 0) {
      throw new BadRequestException(
        "Product attribute cannot be deleted while assigned to variants",
      );
    }
  }

  private async assertAttributeValueCanBeDeleted(
    attributeId: string,
    valueId: string,
  ) {
    const [{ value }] = await this.db
      .select({ value: count() })
      .from(productVariantAttribute)
      .where(
        and(
          eq(productVariantAttribute.attributeId, attributeId),
          eq(productVariantAttribute.attributeValueId, valueId),
        ),
      );

    if (value > 0) {
      throw new BadRequestException(
        "Product attribute value cannot be deleted while assigned to variants",
      );
    }
  }

  private async withAttributesValues(attributes: ProductAttribute[]) {
    return Promise.all(
      attributes.map((attribute) => this.withAttributeValues(attribute)),
    );
  }

  private async withAttributeValues(
    attribute: ProductAttribute,
  ): Promise<AttributeWithValues> {
    const values = await this.db
      .select()
      .from(productAttributeValue)
      .where(
        and(
          eq(productAttributeValue.attributeId, attribute.id),
          isNull(productAttributeValue.deletedAt),
        ),
      )
      .orderBy(asc(productAttributeValue.createdAt));

    return {
      ...attribute,
      values,
    };
  }

  private attributeOrderBy(
    sortBy: NonNullable<QueryProductAttributeDto["sortBy"]>,
    sortOrder: NonNullable<QueryProductAttributeDto["sortOrder"]>,
  ) {
    const column =
      sortBy === ProductAttributeSortBy.CREATED_AT
        ? productAttribute.createdAt
        : productAttribute.name;

    return sortOrder === "asc" ? asc(column) : desc(column);
  }
}
