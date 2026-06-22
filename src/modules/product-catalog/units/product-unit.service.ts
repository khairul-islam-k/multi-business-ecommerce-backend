import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type ProductUnit,
  ProductSimpleStatus,
  product,
  productUnit,
} from "@/database/schema";
import { and, count, eq, ilike, isNull } from "drizzle-orm";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import {
  CatalogSortBy,
  QueryCatalogDto,
} from "../common/dto/query-catalog.dto";
import {
  CreateProductUnitDto,
  UpdateProductUnitDto,
} from "./dto/product-unit.dto";
import { ProductCatalogLookupService } from "../common/product-catalog-lookup.service";
import { DatabaseService } from "../../../database/database.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import {
  buildOrderBy,
  resolveSortColumn,
} from "../../../common/http/sort.util";

type UnitWithCount = ProductUnit & {
  _count: { products: number };
};

@Injectable()
export class ProductUnitService {
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
    dto: CreateProductUnitDto,
  ) {
    try {
      const [unit] = await this.db
        .insert(productUnit)
        .values({
          businessId,
          name: this.lookup.normalizeName(dto.name),
          status: dto.status ?? ProductSimpleStatus.ACTIVE,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        })
        .returning();

      return apiResponse(
        await this.withUnitCount(unit),
        "Unit created successfully",
      );
    } catch (error) {
      this.lookup.handleUniqueError(error, "Unit name already exists");
    }
  }

  async findAll(businessId: string, query: QueryCatalogDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(productUnit.businessId, businessId),
      isNull(productUnit.deletedAt),
      query.status ? eq(productUnit.status, query.status) : undefined,
      query.search ? ilike(productUnit.name, `%${query.search}%`) : undefined,
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(productUnit)
        .where(where)
        .orderBy(
          buildOrderBy(
            resolveSortColumn(
              query.sortBy,
              {
                [CatalogSortBy.NAME]: productUnit.name,
                [CatalogSortBy.CREATED_AT]: productUnit.createdAt,
                [CatalogSortBy.UPDATED_AT]: productUnit.updatedAt,
              },
              CatalogSortBy.CREATED_AT,
            ),
            query.sortOrder,
          ),
        )
        .limit(limit)
        .offset(skip)
        .then((rows) => this.withUnitsCount(rows)),
      this.db
        .select({ value: count() })
        .from(productUnit)
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

  async findOne(businessId: string, unitId: string) {
    const unit = await this.findUnitRow(businessId, unitId);

    if (!unit) {
      throw new NotFoundException("Unit not found");
    }

    return apiResponse(await this.withUnitCount(unit));
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    unitId: string,
    dto: UpdateProductUnitDto,
  ) {
    await this.findUnitOrThrow(businessId, unitId);

    try {
      const [unit] = await this.db
        .update(productUnit)
        .set({
          ...(dto.name !== undefined && {
            name: this.lookup.normalizeName(dto.name),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          updatedBy: currentUser.id,
        })
        .where(eq(productUnit.id, unitId))
        .returning();

      return apiResponse(
        await this.withUnitCount(unit),
        "Unit updated successfully",
      );
    } catch (error) {
      this.lookup.handleUniqueError(error, "Unit name already exists");
    }
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    unitId: string,
  ) {
    await this.findUnitOrThrow(businessId, unitId);
    await this.assertUnitCanBeDeleted(businessId, unitId);

    await this.db
      .update(productUnit)
      .set({
        status: ProductSimpleStatus.INACTIVE,
        deletedAt: new Date(),
        deletedBy: currentUser.id,
        updatedBy: currentUser.id,
      })
      .where(eq(productUnit.id, unitId));

    return apiResponse(null, "Unit deleted successfully");
  }

  private async findUnitOrThrow(businessId: string, unitId: string) {
    const unit = await this.findUnitRow(businessId, unitId);

    if (!unit) {
      throw new NotFoundException("Unit not found");
    }
  }

  private findUnitRow(businessId: string, unitId: string) {
    return this.db
      .select()
      .from(productUnit)
      .where(
        and(
          eq(productUnit.id, unitId),
          eq(productUnit.businessId, businessId),
          isNull(productUnit.deletedAt),
        ),
      )
      .limit(1)
      .then(([unit]) => unit ?? null);
  }

  private async assertUnitCanBeDeleted(businessId: string, unitId: string) {
    const [{ value }] = await this.db
      .select({ value: count() })
      .from(product)
      .where(
        and(
          eq(product.businessId, businessId),
          eq(product.unitId, unitId),
          isNull(product.deletedAt),
        ),
      );

    if (value > 0) {
      throw new BadRequestException(
        "Unit cannot be deleted while assigned to active products",
      );
    }
  }

  private async withUnitsCount(units: ProductUnit[]) {
    return Promise.all(units.map((unit) => this.withUnitCount(unit)));
  }

  private async withUnitCount(unit: ProductUnit): Promise<UnitWithCount> {
    const [{ value }] = await this.db
      .select({ value: count() })
      .from(product)
      .where(eq(product.unitId, unit.id));

    return {
      ...unit,
      _count: {
        products: value,
      },
    };
  }
}
