import { and, count, eq, ilike, isNull, or, sql, SQL } from "drizzle-orm";

import {
  business,
  businessBranding,
  businessMember,
  businessSetting,
  BusinessStatus,
  financeAccount,
  FinanceAccountStatus,
  FinanceAccountType,
  financeTax,
  FinanceTaxStatus,
  productUnit,
  ProductSimpleStatus,
  systemUser,
  SystemUserType,
  warehouse,
  WarehouseStatus,
  website,
} from "@/database/schema";
import Decimal from "decimal.js";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { throwConflictOnUnique } from "../../common/database/db-error.util";
import { buildOrderBy, resolveSortColumn } from "../../common/http/sort.util";
import { BusinessAccessContext } from "../../common/request-context/request-context.types";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import { generateRandomSlug } from "../../common/utils/slug-generator.util";
import {
  Database,
  DatabaseService,
  DatabaseTransaction,
} from "../../database/database.service";
import { BusinessAccessService } from "../access/services/business-access.service";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { BusinessSortBy, QueryBusinessDto } from "./dto/query-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

const BUSINESS_SLUG_MAX_LENGTH = 180;
const BUSINESS_SLUG_RETRY_LIMIT = 5;
const BUSINESS_SETTING_PREFIX_FIELDS = [
  "orderPrefix",
  "invoicePrefix",
  "paymentPrefix",
  "shipmentPrefix",
  "purchaseOrderPrefix",
  "purchaseReturnPrefix",
  "stockAdjustmentPrefix",
  "stockTransferPrefix",
  "expensePrefix",
  "supplierInvoicePrefix",
  "supplierPaymentPrefix",
  "receivablePrefix",
  "payablePrefix",
  "transactionPrefix",
  "productSkuPrefix",
  "productBarcodePrefix",
  "variantSkuPrefix",
  "variantBarcodePrefix",
] as const;
const BUSINESS_BRANDING_COLOR_FIELDS = [
  "primaryColor",
  "primaryHoverColor",
  "primaryActiveColor",
  "secondaryColor",
  "accentColor",
  "successColor",
  "warningColor",
  "errorColor",
  "infoColor",
  "dashboardBackgroundColor",
  "sidebarBackgroundColor",
  "sidebarTextColor",
  "sidebarMutedTextColor",
  "sidebarActiveBackgroundColor",
  "sidebarActiveTextColor",
  "sidebarHoverBackgroundColor",
  "headerBackgroundColor",
  "headerTextColor",
  "cardBackgroundColor",
  "elevatedBackgroundColor",
  "tableHeaderBackgroundColor",
  "tableRowHoverColor",
  "inputBackgroundColor",
  "disabledBackgroundColor",
  "textPrimaryColor",
  "textSecondaryColor",
  "textMutedColor",
  "textInverseColor",
  "borderColor",
  "borderSubtleColor",
  "focusRingColor",
] as const;
const BUSINESS_BRANDING_TEXT_FIELDS = [
  "logoUrl",
  "faviconUrl",
  "fontFamily",
  "borderRadius",
  "seoTitle",
  "seoDescription",
] as const;
const DEFAULT_CURRENCY_CODE = "BDT";

type BusinessClient = Database | DatabaseTransaction;

@Injectable()
export class BusinessService {
  constructor(
    private readonly database: DatabaseService,
    private readonly businessAccess: BusinessAccessService,
  ) {}

  async create(
    userId: string,
    dto: CreateBusinessDto,
    tx?: DatabaseTransaction,
  ) {
    const client = tx ?? this.database.db;

    const slug = await this.generateUniqueBusinessSlug(
      dto.name,
      userId,
      client,
    );

    const currencyCode = this.normalizeCurrency(dto.currencyCode);
    const settingsData = dto.settings
      ? this.buildBusinessSettingData(dto.settings)
      : {};

    const brandingData = dto.branding
      ? this.buildBusinessBrandingData(dto.branding)
      : {};

    try {
      const createdBusiness = await client.transaction(async (transaction) => {
        const [created] = await transaction
          .insert(business)
          .values({
            name: dto.name.trim(),
            slug,
            email: dto.email ? this.normalizeEmail(dto.email) : null,
            phone: dto.phone?.trim() || null,
            country: dto.country?.trim() || null,
            currencyCode,
            timezone: dto.timezone?.trim(),
            status: dto.status ?? BusinessStatus.ACTIVE,
            ownerUserId: userId,
            createdById: userId,
          })
          .returning();

        const defaults = await this.createDefaultBusinessResources(
          transaction,
          created.id,
          userId,
          currencyCode,
        );

        await transaction.insert(businessSetting).values({
          businessId: created.id,
          ...settingsData,
          defaultWarehouseId: defaults.defaultWarehouseId,
          defaultFinanceAccountId: defaults.defaultFinanceAccountId,
          defaultUnitId: defaults.defaultUnitId,
          defaultTaxId: defaults.defaultTaxId,
        });

        await transaction.insert(businessBranding).values({
          businessId: created.id,
          ...brandingData,
        });

        return this.findBusinessById(created.id, transaction);
      });

      return apiResponse(createdBusiness, "Business created successfully");
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findAll(currentUser: CurrentUserPayload, query: QueryBusinessDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const canIncludeDeleted =
      currentUser.type === SystemUserType.ADMIN && query.includeDeleted;

    const conditions = [
      !canIncludeDeleted ? isNull(business.deletedAt) : undefined,
      this.getBusinessAccessCondition(currentUser),
      this.getStatusCondition(currentUser, query.status),
      query.search
        ? or(
            ilike(business.name, `%${query.search}%`),
            ilike(business.slug, `%${query.search}%`),
            ilike(business.email, `%${query.search}%`),
            ilike(business.phone, `%${query.search}%`),
            ilike(business.country, `%${query.search}%`),
          )
        : undefined,
      query.country ? ilike(business.country, query.country) : undefined,
      query.currencyCode
        ? ilike(business.currencyCode, query.currencyCode)
        : undefined,
    ].filter(Boolean);

    const where = and(...conditions);
    const orderBy = buildOrderBy(
      resolveSortColumn(
        query.sortBy,
        {
          [BusinessSortBy.ID]: business.id,
          [BusinessSortBy.NAME]: business.name,
          [BusinessSortBy.STATUS]: business.status,
          [BusinessSortBy.CREATED_AT]: business.createdAt,
          [BusinessSortBy.UPDATED_AT]: business.updatedAt,
        },
        BusinessSortBy.CREATED_AT,
      ),
      query.sortOrder,
    );

    const items = await this.selectBusinesses(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(skip);

    const [totalRow] = await this.database.db
      .select({ value: count() })
      .from(business)
      .where(where);

    const total = totalRow?.value ?? 0;

    return paginatedResponse(this.mapBusinessRows(items), {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(currentUser: CurrentUserPayload, businessId: string) {
    const matchedBusiness = await this.findBusinessByCondition(
      and(
        eq(business.id, businessId),
        isNull(business.deletedAt),
        this.getBusinessAccessCondition(currentUser),
      ),
    );

    if (!matchedBusiness) {
      throw new NotFoundException("Business not found");
    }

    return apiResponse(matchedBusiness);
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: UpdateBusinessDto,
  ) {
    await this.assertCanManageBusiness(currentUser, businessId);

    const settingData = dto.settings
      ? this.buildBusinessSettingData(dto.settings)
      : null;

    const brandingData = dto.branding
      ? this.buildBusinessBrandingData(dto.branding)
      : null;

    try {
      const updatedBusiness = await this.database.db.transaction(
        async (transaction) => {
          await transaction
            .update(business)
            .set({
              ...(dto.name !== undefined && {
                name: dto.name.trim(),
              }),
              ...(dto.email !== undefined && {
                email: dto.email ? this.normalizeEmail(dto.email) : null,
              }),
              ...(dto.phone !== undefined && {
                phone: dto.phone?.trim() || null,
              }),
              ...(dto.country !== undefined && {
                country: dto.country?.trim() || null,
              }),
              ...(dto.currencyCode !== undefined && {
                currencyCode: this.normalizeCurrency(dto.currencyCode),
              }),
              ...(dto.timezone !== undefined && {
                timezone: dto.timezone.trim(),
              }),
              ...(dto.status !== undefined && {
                status: dto.status,
              }),
              updatedById: currentUser.id,
            })
            .where(eq(business.id, businessId));

          if (dto.name !== undefined) {
            await transaction
              .update(website)
              .set({
                name: dto.name.trim(),
                updatedBy: currentUser.id,
              })
              .where(
                and(
                  eq(website.businessId, businessId),
                  isNull(website.deletedAt),
                ),
              );
          }

          if (settingData && this.hasKeys(settingData)) {
            if (dto.settings?.defaultWarehouseId) {
              await this.assertActiveWarehouse(
                transaction,
                businessId,
                dto.settings.defaultWarehouseId,
              );
            }

            if (dto.settings?.defaultFinanceAccountId) {
              await this.assertActiveFinanceAccount(
                transaction,
                businessId,
                dto.settings.defaultFinanceAccountId,
              );
            }

            if (dto.settings?.defaultUnitId) {
              await this.assertActiveUnit(
                transaction,
                businessId,
                dto.settings.defaultUnitId,
              );
            }

            if (dto.settings?.defaultTaxId) {
              await this.assertActiveTax(
                transaction,
                businessId,
                dto.settings.defaultTaxId,
              );
            }

            await this.upsertBusinessSettings(
              transaction,
              businessId,
              settingData,
              currentUser.id,
            );
          }

          if (brandingData && this.hasKeys(brandingData)) {
            await this.upsertBusinessBranding(
              transaction,
              businessId,
              brandingData,
            );
          }

          return this.findBusinessById(businessId, transaction);
        },
      );

      return apiResponse(updatedBusiness, "Business updated successfully");
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async remove(currentUser: CurrentUserPayload, businessId: string) {
    const matchedBusiness = await this.assertCanDeleteBusiness(
      currentUser,
      businessId,
    );

    const [activeOwnedBusinessCount] = await this.database.db
      .select({ value: count() })
      .from(business)
      .where(
        and(
          eq(business.ownerUserId, matchedBusiness.ownerUserId),
          isNull(business.deletedAt),
          eq(business.status, BusinessStatus.ACTIVE),
        ),
      );

    const isActiveOwnedBusiness =
      matchedBusiness.status === BusinessStatus.ACTIVE;

    if (isActiveOwnedBusiness && (activeOwnedBusinessCount?.value ?? 0) <= 1) {
      throw new ForbiddenException(
        "You must have at least one active business",
      );
    }

    await this.database.db
      .update(business)
      .set({
        status: BusinessStatus.INACTIVE,
        deletedAt: new Date(),
        deletedById: currentUser.id,
        updatedById: currentUser.id,
      })
      .where(eq(business.id, businessId));

    return apiResponse(null, "Business deleted successfully");
  }

  async assertCanAccessBusiness(
    currentUser: CurrentUserPayload,
    businessId: string,
  ): Promise<BusinessAccessContext> {
    return this.businessAccess.assertCanAccessBusiness(currentUser, businessId);
  }

  async assertCanManageBusiness(
    currentUser: CurrentUserPayload,
    businessId: string,
  ) {
    return this.assertCanAccessBusiness(currentUser, businessId);
  }

  private async assertCanDeleteBusiness(
    currentUser: CurrentUserPayload,
    businessId: string,
  ) {
    const access = await this.assertCanAccessBusiness(currentUser, businessId);

    if (!access.isAdmin && !access.isOwner) {
      throw new ForbiddenException(
        "Only the business owner can delete this business",
      );
    }

    const [matchedBusiness] = await this.database.db
      .select({
        id: business.id,
        ownerUserId: business.ownerUserId,
        status: business.status,
      })
      .from(business)
      .where(and(eq(business.id, businessId), isNull(business.deletedAt)))
      .limit(1);

    if (!matchedBusiness) {
      throw new NotFoundException("Business not found");
    }

    return matchedBusiness;
  }

  private selectBusinesses(
    condition: SQL | undefined,
    client = this.database.db,
  ) {
    return client
      .select({
        business,
        ownerUser: {
          id: systemUser.id,
          name: systemUser.name,
          email: systemUser.email,
          type: systemUser.type,
          status: systemUser.status,
        },
        settings: businessSetting,
        branding: businessBranding,
        _count: {
          members: sql<number>`(
            select count(*)::int
            from ${businessMember}
            where ${businessMember.businessId} = ${business.id}
          )`,
        },
      })
      .from(business)
      .innerJoin(systemUser, eq(systemUser.id, business.ownerUserId))
      .leftJoin(businessSetting, eq(businessSetting.businessId, business.id))
      .leftJoin(businessBranding, eq(businessBranding.businessId, business.id))
      .where(condition);
  }

  private async findBusinessByCondition(
    condition: SQL | undefined,
    client: BusinessClient = this.database.db,
  ) {
    const [row] = await this.selectBusinesses(condition, client).limit(1);

    if (!row) {
      return null;
    }

    return this.mapBusinessRow(row);
  }

  private async findBusinessById(
    businessId: string,
    client: BusinessClient = this.database.db,
  ) {
    const matchedBusiness = await this.findBusinessByCondition(
      eq(business.id, businessId),
      client,
    );

    if (!matchedBusiness) {
      throw new NotFoundException("Business not found");
    }

    return matchedBusiness;
  }

  private mapBusinessRows(
    rows: Awaited<
      ReturnType<ReturnType<typeof this.selectBusinesses>["execute"]>
    >,
  ) {
    return rows.map((row) => this.mapBusinessRow(row));
  }

  private mapBusinessRow(row: {
    business: typeof business.$inferSelect;
    ownerUser: Pick<
      typeof systemUser.$inferSelect,
      "id" | "name" | "email" | "type" | "status"
    >;
    settings: typeof businessSetting.$inferSelect | null;
    branding: typeof businessBranding.$inferSelect | null;
    _count: {
      members: number;
    };
  }) {
    return {
      ...row.business,
      ownerUser: row.ownerUser,
      settings: row.settings,
      branding: row.branding,
      _count: row._count,
    };
  }

  private getBusinessAccessCondition(currentUser: CurrentUserPayload) {
    return this.businessAccess.getBusinessAccessCondition(currentUser);
  }

  private getStatusCondition(
    currentUser: CurrentUserPayload,
    status?: BusinessStatus,
  ) {
    if (currentUser.type === SystemUserType.ADMIN) {
      return status ? eq(business.status, status) : undefined;
    }

    return status
      ? and(
          eq(business.status, BusinessStatus.ACTIVE),
          eq(business.status, status),
        )
      : eq(business.status, BusinessStatus.ACTIVE);
  }

  private async upsertBusinessSettings(
    transaction: DatabaseTransaction,
    businessId: string,
    data: ReturnType<BusinessService["buildBusinessSettingData"]>,
    currentUserId: string,
  ) {
    const [existing] = await transaction
      .select({ id: businessSetting.id })
      .from(businessSetting)
      .where(eq(businessSetting.businessId, businessId))
      .limit(1);

    if (existing) {
      await transaction
        .update(businessSetting)
        .set(data)
        .where(eq(businessSetting.id, existing.id));
      return;
    }

    const [businessRow] = await transaction
      .select({ currencyCode: business.currencyCode })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    const defaults = await this.createDefaultBusinessResources(
      transaction,
      businessId,
      currentUserId,
      this.normalizeCurrency(businessRow?.currencyCode),
    );

    await transaction.insert(businessSetting).values({
      businessId,
      ...data,
      defaultWarehouseId: defaults.defaultWarehouseId,
      defaultFinanceAccountId: defaults.defaultFinanceAccountId,
      defaultUnitId: defaults.defaultUnitId,
      defaultTaxId: defaults.defaultTaxId,
    });
  }

  private async upsertBusinessBranding(
    transaction: DatabaseTransaction,
    businessId: string,
    data: ReturnType<BusinessService["buildBusinessBrandingData"]>,
  ) {
    const [existing] = await transaction
      .select({ id: businessBranding.id })
      .from(businessBranding)
      .where(eq(businessBranding.businessId, businessId))
      .limit(1);

    if (existing) {
      await transaction
        .update(businessBranding)
        .set(data)
        .where(eq(businessBranding.id, existing.id));
      return;
    }

    await transaction.insert(businessBranding).values({
      businessId,
      ...data,
    });
  }

  private buildBusinessSettingData(
    dto: NonNullable<CreateBusinessDto["settings"]>,
  ) {
    const data: Record<string, unknown> = {
      ...(dto.lowStockThreshold !== undefined && {
        lowStockThreshold: dto.lowStockThreshold,
      }),
      ...(dto.allowBackorder !== undefined && {
        allowBackorder: dto.allowBackorder,
      }),
      ...(dto.autoConfirmOrder !== undefined && {
        autoConfirmOrder: dto.autoConfirmOrder,
      }),
      ...(dto.codEnabled !== undefined && {
        codEnabled: dto.codEnabled,
      }),
      ...(dto.onlinePaymentEnabled !== undefined && {
        onlinePaymentEnabled: dto.onlinePaymentEnabled,
      }),
      ...(dto.defaultWarehouseId !== undefined && {
        defaultWarehouseId: dto.defaultWarehouseId,
      }),
      ...(dto.defaultFinanceAccountId !== undefined && {
        defaultFinanceAccountId: dto.defaultFinanceAccountId,
      }),
      ...(dto.defaultUnitId !== undefined && {
        defaultUnitId: dto.defaultUnitId,
      }),
      ...(dto.defaultTaxId !== undefined && {
        defaultTaxId: dto.defaultTaxId,
      }),
    };

    for (const field of BUSINESS_SETTING_PREFIX_FIELDS) {
      if (dto[field] !== undefined) {
        data[field] = this.normalizeNullablePrefix(dto[field]);
      }
    }

    return data;
  }

  private async createDefaultBusinessResources(
    transaction: DatabaseTransaction,
    businessId: string,
    userId: string,
    currencyCode: string,
  ) {
    const [[defaultWarehouse], [defaultFinanceAccount], [defaultUnit], [tax]] =
      await Promise.all([
        transaction
          .insert(warehouse)
          .values({
            businessId,
            name: "Default Warehouse",
            status: WarehouseStatus.ACTIVE,
            createdBy: userId,
            updatedBy: userId,
          })
          .returning({ id: warehouse.id }),
        transaction
          .insert(financeAccount)
          .values({
            businessId,
            name: "Main Cash",
            accountType: FinanceAccountType.CASH,
            currencyCode,
            openingBalance: new Decimal(0),
            currentBalance: new Decimal(0),
            status: FinanceAccountStatus.ACTIVE,
            createdBy: userId,
            updatedBy: userId,
          })
          .returning({ id: financeAccount.id }),
        transaction
          .insert(productUnit)
          .values({
            businessId,
            name: "Piece",
            status: ProductSimpleStatus.ACTIVE,
            createdBy: userId,
            updatedBy: userId,
          })
          .returning({ id: productUnit.id }),
        transaction
          .insert(financeTax)
          .values({
            businessId,
            name: "No Tax",
            rate: new Decimal(0),
            description: "Default zero-percent tax",
            status: FinanceTaxStatus.ACTIVE,
            createdBy: userId,
            updatedBy: userId,
          })
          .returning({ id: financeTax.id }),
      ]);

    return {
      defaultWarehouseId: defaultWarehouse.id,
      defaultFinanceAccountId: defaultFinanceAccount.id,
      defaultUnitId: defaultUnit.id,
      defaultTaxId: tax.id,
    };
  }

  private buildBusinessBrandingData(
    dto: NonNullable<CreateBusinessDto["branding"]>,
  ) {
    const data: Record<string, unknown> = {};

    for (const field of BUSINESS_BRANDING_COLOR_FIELDS) {
      if (dto[field] !== undefined) {
        data[field] = this.normalizeNullableText(dto[field]);
      }
    }

    for (const field of BUSINESS_BRANDING_TEXT_FIELDS) {
      if (dto[field] !== undefined) {
        data[field] = this.normalizeNullableText(dto[field].toString());
      }
    }

    if (dto.density !== undefined) {
      data.density = dto.density;
    }

    return data;
  }

  private async generateUniqueBusinessSlug(
    name: string,
    ownerUserId: string,
    client: BusinessClient = this.database.db,
  ) {
    for (let attempt = 0; attempt < BUSINESS_SLUG_RETRY_LIMIT; attempt++) {
      const slug = generateRandomSlug(name, {
        fallback: "business",
        maxLength: BUSINESS_SLUG_MAX_LENGTH,
      });

      const [existingBusiness] = await client
        .select({ id: business.id })
        .from(business)
        .where(
          and(eq(business.slug, slug), eq(business.ownerUserId, ownerUserId)),
        )
        .limit(1);

      if (!existingBusiness) {
        return slug;
      }
    }

    throw new ConflictException("Could not generate a unique business slug");
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private normalizeCurrency(currencyCode?: string | null) {
    return currencyCode?.trim().toUpperCase() || DEFAULT_CURRENCY_CODE;
  }

  private normalizeNullablePrefix(value?: string | null) {
    const normalized = value?.trim().toUpperCase();

    return normalized || null;
  }

  private normalizeNullableText(value?: string | null) {
    const normalized = value?.trim();

    return normalized || null;
  }

  private hasKeys(value: object) {
    return Object.keys(value).length > 0;
  }

  private async assertActiveWarehouse(
    client: BusinessClient,
    businessId: string,
    warehouseId: string,
  ) {
    const [warehouseRow] = await client
      .select({ id: warehouse.id })
      .from(warehouse)
      .where(
        and(
          eq(warehouse.id, warehouseId),
          eq(warehouse.businessId, businessId),
          eq(warehouse.status, WarehouseStatus.ACTIVE),
          isNull(warehouse.deletedAt),
        ),
      )
      .limit(1);

    if (!warehouseRow) {
      throw new NotFoundException(
        "Default warehouse must be an active warehouse for this business",
      );
    }
  }

  private async assertActiveFinanceAccount(
    client: BusinessClient,
    businessId: string,
    accountId: string,
  ) {
    const [account] = await client
      .select({ id: financeAccount.id })
      .from(financeAccount)
      .where(
        and(
          eq(financeAccount.id, accountId),
          eq(financeAccount.businessId, businessId),
          eq(financeAccount.status, FinanceAccountStatus.ACTIVE),
          isNull(financeAccount.deletedAt),
        ),
      )
      .limit(1);

    if (!account) {
      throw new NotFoundException(
        "Default finance account must be an active account for this business",
      );
    }
  }

  private async assertActiveUnit(
    client: BusinessClient,
    businessId: string,
    unitId: string,
  ) {
    const [unit] = await client
      .select({ id: productUnit.id })
      .from(productUnit)
      .where(
        and(
          eq(productUnit.id, unitId),
          eq(productUnit.businessId, businessId),
          eq(productUnit.status, ProductSimpleStatus.ACTIVE),
          isNull(productUnit.deletedAt),
        ),
      )
      .limit(1);

    if (!unit) {
      throw new NotFoundException(
        "Default product unit must be an active unit for this business",
      );
    }
  }

  private async assertActiveTax(
    client: BusinessClient,
    businessId: string,
    taxId: string,
  ) {
    const [tax] = await client
      .select({ id: financeTax.id })
      .from(financeTax)
      .where(
        and(
          eq(financeTax.id, taxId),
          eq(financeTax.businessId, businessId),
          eq(financeTax.status, FinanceTaxStatus.ACTIVE),
          isNull(financeTax.deletedAt),
        ),
      )
      .limit(1);

    if (!tax) {
      throw new NotFoundException(
        "Default tax must be an active tax for this business",
      );
    }
  }

  private handleDatabaseError(error: unknown): never {
    throwConflictOnUnique(error, "Business name or slug already exists");
  }
}
