import Decimal from "decimal.js";
import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

import {
  businessSetting,
  financeTax,
  FinanceTaxStatus,
  product,
} from "@/database/schema";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { isUniqueConstraintError } from "../../../common/database/db-error.util";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import { DatabaseService } from "../../../database/database.service";
import {
  CreateFinanceTaxDto,
  QueryFinanceTaxDto,
  UpdateFinanceTaxDto,
} from "./dto/finance-tax.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
@Injectable()
export class FinanceTaxService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateFinanceTaxDto,
  ) {
    try {
      const [tax] = await this.db
        .insert(financeTax)
        .values({
          businessId,
          name: this.normalizeName(dto.name),
          rate: new Decimal(dto.rate),
          description: this.normalizeNullableText(dto.description),
          status: dto.status ?? FinanceTaxStatus.ACTIVE,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        })
        .returning();

      return apiResponse(tax, "Tax created successfully");
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findAll(businessId: string, query: QueryFinanceTaxDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(financeTax.businessId, businessId),
      isNull(financeTax.deletedAt),
      query.status ? eq(financeTax.status, query.status) : undefined,
      query.search
        ? or(
            ilike(financeTax.name, `%${query.search}%`),
            ilike(financeTax.description, `%${query.search}%`),
          )
        : undefined,
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(financeTax)
        .where(where)
        .orderBy(desc(financeTax.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(financeTax)
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

  async findOne(businessId: string, taxId: string) {
    const tax = await this.findTaxRow(businessId, taxId);

    if (!tax) {
      throw new NotFoundException("Tax not found");
    }

    return apiResponse(tax);
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    taxId: string,
    dto: UpdateFinanceTaxDto,
  ) {
    await this.assertTaxExists(businessId, taxId);

    try {
      const [tax] = await this.db
        .update(financeTax)
        .set({
          ...(dto.name !== undefined && { name: this.normalizeName(dto.name) }),
          ...(dto.rate !== undefined && { rate: new Decimal(dto.rate) }),
          ...(dto.description !== undefined && {
            description: this.normalizeNullableText(dto.description),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          updatedBy: currentUser.id,
        })
        .where(eq(financeTax.id, taxId))
        .returning();

      return apiResponse(tax, "Tax updated successfully");
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    taxId: string,
  ) {
    await this.assertTaxExists(businessId, taxId);
    await this.assertTaxCanBeDeleted(businessId, taxId);

    await this.db
      .update(financeTax)
      .set({
        status: FinanceTaxStatus.INACTIVE,
        deletedAt: new Date(),
        deletedBy: currentUser.id,
        updatedBy: currentUser.id,
      })
      .where(eq(financeTax.id, taxId));

    return apiResponse(null, "Tax deleted successfully");
  }

  private async assertTaxExists(businessId: string, taxId: string) {
    const tax = await this.findTaxRow(businessId, taxId);

    if (!tax) {
      throw new NotFoundException("Tax not found");
    }
  }

  private async assertTaxCanBeDeleted(businessId: string, taxId: string) {
    const [defaultReference, productReference] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(businessSetting)
        .where(
          and(
            eq(businessSetting.businessId, businessId),
            eq(businessSetting.defaultTaxId, taxId),
          ),
        )
        .then(([row]) => row?.value ?? 0),
      this.db
        .select({ value: count() })
        .from(product)
        .where(
          and(
            eq(product.businessId, businessId),
            eq(product.taxId, taxId),
            isNull(product.deletedAt),
          ),
        )
        .then(([row]) => row?.value ?? 0),
    ]);

    if (defaultReference > 0) {
      throw new BadRequestException(
        "Default tax cannot be deleted. Select another active default tax in business settings first.",
      );
    }

    if (productReference > 0) {
      throw new BadRequestException(
        "Tax cannot be deleted while assigned to active products",
      );
    }
  }

  private async findTaxRow(businessId: string, taxId: string) {
    return this.db
      .select()
      .from(financeTax)
      .where(
        and(
          eq(financeTax.id, taxId),
          eq(financeTax.businessId, businessId),
          isNull(financeTax.deletedAt),
        ),
      )
      .limit(1)
      .then(([tax]) => tax ?? null);
  }

  private normalizeName(value: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException("Tax name is required");
    }

    return normalized;
  }

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }

  private handleDatabaseError(error: unknown): never {
    if (isUniqueConstraintError(error)) {
      throw new ConflictException("Tax name already exists");
    }

    throw error;
  }
}
