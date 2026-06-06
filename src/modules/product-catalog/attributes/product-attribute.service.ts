import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, ProductSimpleStatus } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { ProductCatalogLookupService } from "../common/product-catalog-lookup.service";
import {
  CreateProductAttributeDto,
  CreateProductAttributeValueDto,
  QueryProductAttributeDto,
  UpdateProductAttributeDto,
  UpdateProductAttributeValueDto,
} from "./dto/product-attribute.dto";

const ATTRIBUTE_INCLUDE = {
  values: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.ProductAttributeInclude;

@Injectable()
export class ProductAttributeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: ProductCatalogLookupService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateProductAttributeDto,
  ) {
    await this.assertAttributeNameAvailable(businessId, dto.name);

    const values = this.normalizeValues(dto.values);

    try {
      const attribute = await this.prisma.productAttribute.create({
        data: {
          businessId,
          name: this.lookup.normalizeName(dto.name),
          status: dto.status ?? ProductSimpleStatus.ACTIVE,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
          values:
            values.length > 0
              ? {
                  create: values.map((value) => ({
                    businessId,
                    value,
                    createdBy: currentUser.id,
                    updatedBy: currentUser.id,
                  })),
                }
              : undefined,
        },
        include: ATTRIBUTE_INCLUDE,
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
    const sortBy = query.sortBy ?? "name";
    const sortOrder = query.sortOrder ?? "asc";
    const where: Prisma.ProductAttributeWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              {
                values: {
                  some: {
                    value: { contains: query.search, mode: "insensitive" },
                    deletedAt: null,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.productAttribute.findMany({
        where,
        skip,
        take: limit,
        include: ATTRIBUTE_INCLUDE,
        orderBy: [{ [sortBy]: sortOrder }, { createdAt: "asc" }],
      }),
      this.prisma.productAttribute.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, attributeId: string) {
    return apiResponse(await this.findAttributeOrThrow(businessId, attributeId));
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
      const attribute = await this.prisma.productAttribute.update({
        where: { id: attributeId },
        data: {
          ...(dto.name !== undefined && {
            name: this.lookup.normalizeName(dto.name),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          updatedBy: currentUser.id,
        },
        include: ATTRIBUTE_INCLUDE,
      });

      return apiResponse(attribute, "Product attribute updated successfully");
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

    await this.prisma.$transaction(async (tx) => {
      await tx.productAttributeValue.updateMany({
        where: { attributeId, deletedAt: null },
        data: {
          deletedAt: new Date(),
          updatedBy: currentUser.id,
        },
      });

      await tx.productAttribute.update({
        where: { id: attributeId },
        data: {
          status: ProductSimpleStatus.INACTIVE,
          deletedAt: new Date(),
          updatedBy: currentUser.id,
        },
      });
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
      const value = await this.prisma.productAttributeValue.create({
        data: {
          businessId,
          attributeId,
          value: this.lookup.normalizeName(dto.value),
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        },
      });

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
      const value = await this.prisma.productAttributeValue.update({
        where: { id: valueId },
        data: {
          ...(dto.value !== undefined && {
            value: this.lookup.normalizeName(dto.value),
          }),
          updatedBy: currentUser.id,
        },
      });

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

    await this.prisma.$transaction(async (tx) => {
      await tx.productAttributeValue.update({
        where: { id: valueId },
        data: {
          deletedAt: new Date(),
          updatedBy: currentUser.id,
        },
      });
    });

    return apiResponse(null, "Product attribute value deleted successfully");
  }

  private async findAttributeOrThrow(
    businessId: string,
    attributeId: string,
  ) {
    const attribute = await this.prisma.productAttribute.findFirst({
      where: { id: attributeId, businessId, deletedAt: null },
      include: ATTRIBUTE_INCLUDE,
    });

    if (!attribute) {
      throw new NotFoundException("Product attribute not found");
    }

    return attribute;
  }

  private async findValueOrThrow(
    businessId: string,
    attributeId: string,
    valueId: string,
  ) {
    await this.findAttributeOrThrow(businessId, attributeId);

    const value = await this.prisma.productAttributeValue.findFirst({
      where: { id: valueId, businessId, attributeId, deletedAt: null },
    });

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
    const attribute = await this.prisma.productAttribute.findFirst({
      where: {
        businessId,
        name: this.lookup.normalizeName(name),
        deletedAt: null,
        ...(excludeAttributeId ? { id: { not: excludeAttributeId } } : {}),
      },
      select: { id: true },
    });

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
    const variantCount = await this.prisma.productVariantAttribute.count({
      where: { attributeId },
    });

    if (variantCount > 0) {
      throw new BadRequestException(
        "Product attribute cannot be deleted while assigned to variants",
      );
    }
  }

  private async assertAttributeValueCanBeDeleted(
    attributeId: string,
    valueId: string,
  ) {
    const variantCount = await this.prisma.productVariantAttribute.count({
      where: { attributeId, attributeValueId: valueId },
    });

    if (variantCount > 0) {
      throw new BadRequestException(
        "Product attribute value cannot be deleted while assigned to variants",
      );
    }
  }
}
