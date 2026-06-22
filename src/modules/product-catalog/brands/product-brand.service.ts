import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type ProductBrand,
  ProductSimpleStatus,
  product,
  productBrand,
} from "@/database/schema";
import { and, asc, count, eq, ilike, isNull, or } from "drizzle-orm";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import {
  CatalogSortBy,
  QueryCatalogDto,
} from "../common/dto/query-catalog.dto";
import {
  CreateProductBrandDto,
  UpdateProductBrandDto,
} from "./dto/product-brand.dto";
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

type BrandWithCount = ProductBrand & {
  _count: { products: number };
};

@Injectable()
export class ProductBrandService {
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
    dto: CreateProductBrandDto,
  ) {
    try {
      const [brand] = await this.db
        .insert(productBrand)
        .values({
          businessId,
          name: this.lookup.normalizeName(dto.name),
          description: this.lookup.normalizeNullableText(dto.description),
          logoUrl: this.lookup.normalizeNullableText(dto.logoUrl),
          status: dto.status ?? ProductSimpleStatus.ACTIVE,
          sortOrder: dto.sortOrder ?? 0,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        })
        .returning();

      return apiResponse(
        await this.withBrandCount(brand),
        "Brand created successfully",
      );
    } catch (error) {
      this.lookup.handleUniqueError(error, "Brand name already exists");
    }
  }

  async findAll(businessId: string, query: QueryCatalogDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(productBrand.businessId, businessId),
      isNull(productBrand.deletedAt),
      query.status ? eq(productBrand.status, query.status) : undefined,
      query.search
        ? or(
            ilike(productBrand.name, `%${query.search}%`),
            ilike(productBrand.description, `%${query.search}%`),
          )
        : undefined,
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(productBrand)
        .where(where)
        .orderBy(
          asc(productBrand.sortOrder),
          buildOrderBy(
            resolveSortColumn(
              query.sortBy,
              {
                [CatalogSortBy.NAME]: productBrand.name,
                [CatalogSortBy.CREATED_AT]: productBrand.createdAt,
                [CatalogSortBy.UPDATED_AT]: productBrand.updatedAt,
              },
              CatalogSortBy.CREATED_AT,
            ),
            query.sortOrder,
          ),
        )
        .limit(limit)
        .offset(skip)
        .then((rows) => this.withBrandsCount(rows)),
      this.db
        .select({ value: count() })
        .from(productBrand)
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

  async findOne(businessId: string, brandId: string) {
    const brand = await this.findBrandRow(businessId, brandId);

    if (!brand) {
      throw new NotFoundException("Brand not found");
    }

    return apiResponse(await this.withBrandCount(brand));
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    brandId: string,
    dto: UpdateProductBrandDto,
  ) {
    await this.findBrandOrThrow(businessId, brandId);

    try {
      const [brand] = await this.db
        .update(productBrand)
        .set({
          ...(dto.name !== undefined && {
            name: this.lookup.normalizeName(dto.name),
          }),
          ...(dto.description !== undefined && {
            description: this.lookup.normalizeNullableText(dto.description),
          }),
          ...(dto.logoUrl !== undefined && {
            logoUrl: this.lookup.normalizeNullableText(dto.logoUrl),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          updatedBy: currentUser.id,
        })
        .where(eq(productBrand.id, brandId))
        .returning();

      return apiResponse(
        await this.withBrandCount(brand),
        "Brand updated successfully",
      );
    } catch (error) {
      this.lookup.handleUniqueError(error, "Brand name already exists");
    }
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    brandId: string,
  ) {
    await this.findBrandOrThrow(businessId, brandId);
    await this.assertBrandCanBeDeleted(businessId, brandId);

    await this.db
      .update(productBrand)
      .set({
        status: ProductSimpleStatus.INACTIVE,
        deletedAt: new Date(),
        deletedBy: currentUser.id,
        updatedBy: currentUser.id,
      })
      .where(eq(productBrand.id, brandId));

    return apiResponse(null, "Brand deleted successfully");
  }

  private async findBrandOrThrow(businessId: string, brandId: string) {
    const brand = await this.findBrandRow(businessId, brandId);

    if (!brand) {
      throw new NotFoundException("Brand not found");
    }
  }

  private findBrandRow(businessId: string, brandId: string) {
    return this.db
      .select()
      .from(productBrand)
      .where(
        and(
          eq(productBrand.id, brandId),
          eq(productBrand.businessId, businessId),
          isNull(productBrand.deletedAt),
        ),
      )
      .limit(1)
      .then(([brand]) => brand ?? null);
  }

  private async assertBrandCanBeDeleted(businessId: string, brandId: string) {
    const [{ value }] = await this.db
      .select({ value: count() })
      .from(product)
      .where(
        and(
          eq(product.businessId, businessId),
          eq(product.brandId, brandId),
          isNull(product.deletedAt),
        ),
      );

    if (value > 0) {
      throw new BadRequestException(
        "Brand cannot be deleted while assigned to active products",
      );
    }
  }

  private async withBrandsCount(brands: ProductBrand[]) {
    return Promise.all(brands.map((brand) => this.withBrandCount(brand)));
  }

  private async withBrandCount(brand: ProductBrand): Promise<BrandWithCount> {
    const [{ value }] = await this.db
      .select({ value: count() })
      .from(product)
      .where(eq(product.brandId, brand.id));

    return {
      ...brand,
      _count: {
        products: value,
      },
    };
  }
}
