import Decimal from "decimal.js";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
} from "drizzle-orm";

import {
  Courier,
  courier,
  courierAreaCatalog,
  courierConfig,
  CourierConfig,
  CourierConfigStatus,
  courierDeliveryZone,
  courierDeliveryZoneArea,
  CourierDeliveryZoneStatus,
  CourierProvider,
  courierShipment,
  courierShipmentItem,
  CourierShipmentStatus,
  courierShippingCharge,
  CourierShippingChargeStatus,
  CourierStatus,
  JsonValue,
  order as orderTable,
} from "@/database/schema";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { isUniqueConstraintError } from "../../common/database/db-error.util";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import { DatabaseService } from "../../database/database.service";
import { WebsiteService } from "../website/website.service";
import { CourierConfigEncryptionService } from "./courier-config-encryption.service";
import { CourierProviderService } from "./courier-provider.service";
import {
  AddCourierAreaCatalogToZoneDto,
  BulkUpdateCourierConfigDto,
  CreateCourierDeliveryZoneAreaDto,
  CreateCourierDeliveryZoneDto,
  CreateCourierShippingChargeDto,
  PathaoBookShipmentDto,
  PathaoCreateStoreDto,
  PathaoPricePlanDto,
  QueryCourierAreaCatalogDto,
  QueryCourierConfigDto,
  QueryCourierDeliveryZoneDto,
  QueryCourierDto,
  QueryCourierShippingChargeDto,
  SeedCourierDto,
  StorefrontCourierQuoteDto,
  UpdateCourierDeliveryZoneAreaDto,
  UpdateCourierDeliveryZoneDto,
  UpdateCourierShippingChargeDto,
  UpdateCourierConfigDto,
} from "./dto/courier.dto";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import type { CourierBookingParams } from "./courier-provider.service";

@Injectable()
export class CourierService {
  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: CourierConfigEncryptionService,
    private readonly providers: CourierProviderService,
    private readonly websites: WebsiteService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async seedCouriers(items: SeedCourierDto[]) {
    const rows = await this.db.transaction(async (tx) => {
      const seeded: Courier[] = [];

      for (const item of items) {
        const [row] = await tx
          .insert(courier)
          .values({
            code: item.code,
            name: item.name,
            description: item.description,
            status: item.status ?? CourierStatus.ACTIVE,
          })
          .onConflictDoUpdate({
            target: courier.code,
            set: {
              name: item.name,
              description: item.description,
              status: item.status ?? CourierStatus.ACTIVE,
            },
          })
          .returning();

        seeded.push(row);
      }

      return seeded;
    });

    return apiResponse(rows, "Couriers seeded successfully");
  }

  async findCouriers(query: QueryCourierDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const where = and(
      query.status ? eq(courier.status, query.status) : undefined,
      search
        ? or(
            ilike(courier.name, `%${search}%`),
            ilike(courier.description, `%${search}%`),
          )
        : undefined,
    );

    const [items, total] = await Promise.all([
      this.db.select().from(courier).where(where).limit(limit).offset(skip),
      this.db
        .select({ value: count() })
        .from(courier)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      items,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Courier providers were loaded successfully. The response includes seeded providers and pagination metadata for browsing more results.",
    );
  }

  async findAreaCatalog(query: QueryCourierAreaCatalogDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const where = and(
      query.source
        ? eq(courierAreaCatalog.source, query.source.trim())
        : undefined,
      query.areaType
        ? eq(courierAreaCatalog.areaType, query.areaType)
        : undefined,
      query.divisionName
        ? ilike(
            courierAreaCatalog.divisionName,
            `%${query.divisionName.trim()}%`,
          )
        : undefined,
      query.districtName
        ? ilike(
            courierAreaCatalog.districtName,
            `%${query.districtName.trim()}%`,
          )
        : undefined,
      query.upazilaName
        ? ilike(courierAreaCatalog.upazilaName, `%${query.upazilaName.trim()}%`)
        : undefined,
      search
        ? or(
            ilike(courierAreaCatalog.name, `%${search}%`),
            ilike(courierAreaCatalog.bnName, `%${search}%`),
            ilike(courierAreaCatalog.divisionName, `%${search}%`),
            ilike(courierAreaCatalog.districtName, `%${search}%`),
            ilike(courierAreaCatalog.upazilaName, `%${search}%`),
          )
        : undefined,
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(courierAreaCatalog)
        .where(where)
        .orderBy(
          courierAreaCatalog.divisionName,
          courierAreaCatalog.districtName,
          courierAreaCatalog.upazilaName,
          courierAreaCatalog.name,
        )
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(courierAreaCatalog)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      items,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Courier area catalog loaded successfully",
    );
  }

  async findConfigs(businessId: string, query: QueryCourierConfigDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const where = and(
      eq(courierConfig.businessId, businessId),
      isNull(courierConfig.deletedAt),
      query.mode ? eq(courierConfig.mode, query.mode) : undefined,
      query.status ? eq(courierConfig.status, query.status) : undefined,
      query.provider ? eq(courier.code, query.provider) : undefined,
      search
        ? or(
            ilike(courier.name, `%${search}%`),
            ilike(courier.description, `%${search}%`),
          )
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select({ config: courierConfig, courier })
        .from(courierConfig)
        .innerJoin(courier, eq(courier.id, courierConfig.courierId))
        .where(where)
        .orderBy(desc(courierConfig.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(courierConfig)
        .innerJoin(courier, eq(courier.id, courierConfig.courierId))
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      rows.map((row) => this.toConfigResponse(row.config, row.courier)),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Courier configurations were loaded successfully. The response includes the requested page of business courier configurations and pagination metadata for browsing more results.",
    );
  }

  async findDeliveryZones(
    businessId: string,
    query: QueryCourierDeliveryZoneDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const where = and(
      eq(courierDeliveryZone.businessId, businessId),
      isNull(courierDeliveryZone.deletedAt),
      query.status ? eq(courierDeliveryZone.status, query.status) : undefined,
      search
        ? or(
            ilike(courierDeliveryZone.name, `%${search}%`),
            ilike(courierDeliveryZone.description, `%${search}%`),
          )
        : undefined,
    );
    const [zones, total] = await Promise.all([
      this.db
        .select()
        .from(courierDeliveryZone)
        .where(where)
        .orderBy(courierDeliveryZone.name)
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(courierDeliveryZone)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);
    const areas =
      zones.length === 0
        ? []
        : await this.db
            .select()
            .from(courierDeliveryZoneArea)
            .where(
              inArray(
                courierDeliveryZoneArea.deliveryZoneId,
                zones.map((zone) => zone.id),
              ),
            )
            .orderBy(courierDeliveryZoneArea.areaName);
    const areasByZone = new Map<
      string,
      (typeof courierDeliveryZoneArea.$inferSelect)[]
    >();

    for (const area of areas) {
      const entries = areasByZone.get(area.deliveryZoneId) ?? [];
      entries.push(area);
      areasByZone.set(area.deliveryZoneId, entries);
    }

    return paginatedResponse(
      zones.map((zone) => ({
        ...zone,
        areas: areasByZone.get(zone.id) ?? [],
      })),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Courier delivery zones loaded successfully",
    );
  }

  async createDeliveryZone(
    businessId: string,
    dto: CreateCourierDeliveryZoneDto,
  ) {
    try {
      const zone = await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(courierDeliveryZone)
          .values({
            businessId,
            name: dto.name.trim(),
            description: dto.description?.trim() || undefined,
            status: dto.status ?? CourierDeliveryZoneStatus.ACTIVE,
          })
          .returning();

        if (dto.areas?.length) {
          await tx.insert(courierDeliveryZoneArea).values(
            dto.areas.map((area) => ({
              deliveryZoneId: created.id,
              areaName: area.areaName.trim(),
              city: area.city?.trim() || undefined,
            })),
          );
        }

        return created;
      });

      return apiResponse(
        await this.hydrateDeliveryZone(zone),
        "Courier delivery zone created successfully",
      );
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async updateDeliveryZone(
    businessId: string,
    zoneId: string,
    dto: UpdateCourierDeliveryZoneDto,
  ) {
    await this.getDeliveryZoneOrThrow(businessId, zoneId);

    try {
      const [updated] = await this.db
        .update(courierDeliveryZone)
        .set({
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.description !== undefined && {
            description: dto.description?.trim() || null,
          }),
          ...(dto.status !== undefined && { status: dto.status }),
        })
        .where(eq(courierDeliveryZone.id, zoneId))
        .returning();

      return apiResponse(
        await this.hydrateDeliveryZone(updated),
        "Courier delivery zone updated successfully",
      );
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async deleteDeliveryZone(
    currentUser: CurrentUserPayload,
    businessId: string,
    zoneId: string,
  ) {
    await this.getDeliveryZoneOrThrow(businessId, zoneId);

    const [deleted] = await this.db
      .update(courierDeliveryZone)
      .set({
        deletedAt: new Date(),
        deletedBy: currentUser.id,
      })
      .where(eq(courierDeliveryZone.id, zoneId))
      .returning();

    return apiResponse(deleted, "Courier delivery zone deleted successfully");
  }

  async createDeliveryZoneArea(
    businessId: string,
    zoneId: string,
    dto: CreateCourierDeliveryZoneAreaDto,
  ) {
    await this.getDeliveryZoneOrThrow(businessId, zoneId);

    const [area] = await this.db
      .insert(courierDeliveryZoneArea)
      .values({
        deliveryZoneId: zoneId,
        areaName: dto.areaName.trim(),
        city: dto.city?.trim() || undefined,
      })
      .returning();

    return apiResponse(area, "Courier delivery zone area created successfully");
  }

  async addCatalogAreasToDeliveryZone(
    businessId: string,
    zoneId: string,
    dto: AddCourierAreaCatalogToZoneDto,
  ) {
    const zone = await this.getDeliveryZoneOrThrow(businessId, zoneId);
    const areaIds = [...new Set(dto.areaIds)];
    const catalogAreas = await this.db
      .select()
      .from(courierAreaCatalog)
      .where(inArray(courierAreaCatalog.id, areaIds));

    if (catalogAreas.length !== areaIds.length) {
      throw new BadRequestException(
        "One or more selected courier catalog areas were not found",
      );
    }

    await this.db
      .insert(courierDeliveryZoneArea)
      .values(
        catalogAreas.map((area) => ({
          deliveryZoneId: zoneId,
          catalogAreaId: area.id,
          areaName: area.name,
          city: (area.districtName ?? area.divisionName)?.slice(0, 100),
        })),
      )
      .onConflictDoNothing({
        target: [
          courierDeliveryZoneArea.deliveryZoneId,
          courierDeliveryZoneArea.catalogAreaId,
        ],
      });

    return apiResponse(
      await this.hydrateDeliveryZone(zone),
      "Courier catalog areas added to delivery zone successfully",
    );
  }

  async updateDeliveryZoneArea(
    businessId: string,
    zoneId: string,
    areaId: string,
    dto: UpdateCourierDeliveryZoneAreaDto,
  ) {
    await this.getDeliveryZoneAreaOrThrow(businessId, zoneId, areaId);

    const [area] = await this.db
      .update(courierDeliveryZoneArea)
      .set({
        ...(dto.areaName !== undefined && {
          areaName: dto.areaName.trim(),
        }),
        ...(dto.city !== undefined && { city: dto.city?.trim() || null }),
      })
      .where(eq(courierDeliveryZoneArea.id, areaId))
      .returning();

    return apiResponse(area, "Courier delivery zone area updated successfully");
  }

  async deleteDeliveryZoneArea(
    businessId: string,
    zoneId: string,
    areaId: string,
  ) {
    const area = await this.getDeliveryZoneAreaOrThrow(
      businessId,
      zoneId,
      areaId,
    );

    await this.db
      .delete(courierDeliveryZoneArea)
      .where(eq(courierDeliveryZoneArea.id, area.id));

    return apiResponse(area, "Courier delivery zone area deleted successfully");
  }

  async findShippingCharges(
    businessId: string,
    query: QueryCourierShippingChargeDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(courierShippingCharge.businessId, businessId),
      query.deliveryZoneId
        ? eq(courierShippingCharge.deliveryZoneId, query.deliveryZoneId)
        : undefined,
      query.courierId
        ? eq(courierShippingCharge.courierId, query.courierId)
        : undefined,
      query.status ? eq(courierShippingCharge.status, query.status) : undefined,
    );
    const [rows, total] = await Promise.all([
      this.db
        .select({
          charge: courierShippingCharge,
          deliveryZone: courierDeliveryZone,
          courier,
        })
        .from(courierShippingCharge)
        .innerJoin(
          courierDeliveryZone,
          eq(courierDeliveryZone.id, courierShippingCharge.deliveryZoneId),
        )
        .leftJoin(courier, eq(courier.id, courierShippingCharge.courierId))
        .where(where)
        .orderBy(desc(courierShippingCharge.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(courierShippingCharge)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      rows.map((row) => ({
        ...row.charge,
        deliveryZone: row.deliveryZone,
        courier: row.courier,
      })),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Courier shipping charges loaded successfully",
    );
  }

  async createShippingCharge(
    businessId: string,
    dto: CreateCourierShippingChargeDto,
  ) {
    await this.assertShippingChargeInput(businessId, dto);

    const [charge] = await this.db
      .insert(courierShippingCharge)
      .values({
        businessId,
        deliveryZoneId: dto.deliveryZoneId,
        courierId: dto.courierId,
        minWeight:
          dto.minWeight === undefined ? undefined : new Decimal(dto.minWeight),
        maxWeight:
          dto.maxWeight === undefined ? undefined : new Decimal(dto.maxWeight),
        shippingCharge: new Decimal(dto.shippingCharge),
        codCharge: new Decimal(dto.codCharge ?? 0),
        status: dto.status ?? CourierShippingChargeStatus.ACTIVE,
      })
      .returning();

    return apiResponse(charge, "Courier shipping charge created successfully");
  }

  async updateShippingCharge(
    businessId: string,
    chargeId: string,
    dto: UpdateCourierShippingChargeDto,
  ) {
    const existing = await this.getShippingChargeOrThrow(businessId, chargeId);
    await this.assertShippingChargeInput(businessId, {
      deliveryZoneId: dto.deliveryZoneId ?? existing.deliveryZoneId,
      courierId: dto.courierId ?? existing.courierId ?? undefined,
      minWeight:
        dto.minWeight ??
        (existing.minWeight === null
          ? undefined
          : existing.minWeight.toNumber()),
      maxWeight:
        dto.maxWeight ??
        (existing.maxWeight === null
          ? undefined
          : existing.maxWeight.toNumber()),
      shippingCharge:
        dto.shippingCharge ?? Number(existing.shippingCharge.toString()),
      codCharge: dto.codCharge ?? Number(existing.codCharge.toString()),
      status: dto.status ?? existing.status,
    });

    const [charge] = await this.db
      .update(courierShippingCharge)
      .set({
        ...(dto.deliveryZoneId !== undefined && {
          deliveryZoneId: dto.deliveryZoneId,
        }),
        ...(dto.courierId !== undefined && { courierId: dto.courierId }),
        ...(dto.minWeight !== undefined && {
          minWeight: new Decimal(dto.minWeight),
        }),
        ...(dto.maxWeight !== undefined && {
          maxWeight: new Decimal(dto.maxWeight),
        }),
        ...(dto.shippingCharge !== undefined && {
          shippingCharge: new Decimal(dto.shippingCharge),
        }),
        ...(dto.codCharge !== undefined && {
          codCharge: new Decimal(dto.codCharge),
        }),
        ...(dto.status !== undefined && { status: dto.status }),
      })
      .where(eq(courierShippingCharge.id, chargeId))
      .returning();

    return apiResponse(charge, "Courier shipping charge updated successfully");
  }

  async bulkUpdateConfig(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: BulkUpdateCourierConfigDto,
  ) {
    const configs = await this.db.transaction(async (tx) => {
      const updatedConfigs: unknown[] = [];

      for (const config of dto.configs) {
        const existing = await this.getConfigWithCourierOrThrow(
          businessId,
          config.id,
        );

        try {
          const normalizedConfigData =
            config.configData === undefined
              ? undefined
              : this.normalizeConfigData(
                  existing.courier.code,
                  config.configData,
                );
          const [updated] = await tx
            .update(courierConfig)
            .set({
              ...(config.mode !== undefined && { mode: config.mode }),
              ...(config.status !== undefined && { status: config.status }),
              ...(normalizedConfigData !== undefined && {
                configData: this.encryption.encrypt(normalizedConfigData),
              }),
              updatedBy: currentUser.id,
            })
            .where(eq(courierConfig.id, config.id))
            .returning();

          updatedConfigs.push(this.toConfigResponse(updated, existing.courier));
        } catch (error) {
          this.handleUniqueError(error);
        }
      }

      return updatedConfigs;
    });

    return apiResponse(configs, "Courier configurations updated successfully");
  }

  async updateConfig(
    currentUser: CurrentUserPayload,
    businessId: string,
    configId: string,
    dto: UpdateCourierConfigDto,
  ) {
    const existing = await this.getConfigWithCourierOrThrow(
      businessId,
      configId,
    );

    try {
      const normalizedConfigData =
        dto.configData === undefined
          ? undefined
          : this.normalizeConfigData(existing.courier.code, dto.configData);
      const [updated] = await this.db
        .update(courierConfig)
        .set({
          ...(dto.mode !== undefined && { mode: dto.mode }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(normalizedConfigData !== undefined && {
            configData: this.encryption.encrypt(normalizedConfigData),
          }),
          updatedBy: currentUser.id,
        })
        .where(eq(courierConfig.id, configId))
        .returning();

      return apiResponse(
        this.toConfigResponse(updated, existing.courier),
        "Courier configuration updated successfully",
      );
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async findStorefrontCouriers(host?: string) {
    const storefront = await this.websites.findPublishedByHostOrThrow(host);

    const rows = await this.db
      .select({ config: courierConfig, courier })
      .from(courierConfig)
      .innerJoin(courier, eq(courier.id, courierConfig.courierId))
      .where(
        and(
          eq(courierConfig.businessId, storefront.businessId),
          eq(courierConfig.status, CourierConfigStatus.ACTIVE),
          eq(courier.status, CourierStatus.ACTIVE),
          isNull(courierConfig.deletedAt),
        ),
      );

    return apiResponse(
      rows.map((row) => ({
        id: row.config.id,
        courierId: row.courier.id,
        code: row.courier.code,
        name: row.courier.name,
        description: row.courier.description,
        mode: row.config.mode,
        supportsConfiguredShippingCharge: true,
      })),
    );
  }

  async findStorefrontDeliveryZones(host?: string) {
    const storefront = await this.websites.findPublishedByHostOrThrow(host);
    const rows = await this.db
      .select({
        zone: courierDeliveryZone,
        area: courierDeliveryZoneArea,
      })
      .from(courierDeliveryZone)
      .leftJoin(
        courierDeliveryZoneArea,
        eq(courierDeliveryZoneArea.deliveryZoneId, courierDeliveryZone.id),
      )
      .where(
        and(
          eq(courierDeliveryZone.businessId, storefront.businessId),
          eq(courierDeliveryZone.status, CourierDeliveryZoneStatus.ACTIVE),
          isNull(courierDeliveryZone.deletedAt),
        ),
      )
      .orderBy(courierDeliveryZone.name, courierDeliveryZoneArea.areaName);
    const zonesById = new Map<
      string,
      typeof courierDeliveryZone.$inferSelect & {
        areas: (typeof courierDeliveryZoneArea.$inferSelect)[];
      }
    >();

    for (const row of rows) {
      let zone = zonesById.get(row.zone.id);

      if (!zone) {
        zone = {
          ...row.zone,
          areas: [],
        };
        zonesById.set(row.zone.id, zone);
      }

      if (row.area) {
        zone.areas.push(row.area);
      }
    }

    return apiResponse(Array.from(zonesById.values()));
  }

  async calculateStorefrontShippingCharge(
    host: string | undefined,
    configId: string,
    dto: StorefrontCourierQuoteDto,
  ) {
    const storefront = await this.websites.findPublishedByHostOrThrow(host);
    const quote = await this.resolveConfiguredShippingCharge(
      storefront.businessId,
      configId,
      dto,
      false,
    );

    return apiResponse(
      {
        courierId: quote.courier.id,
        courierConfigId: quote.config.id,
        deliveryZone: quote.deliveryZone,
        shippingCharge: quote.shippingCharge,
        codCharge: quote.codCharge,
        totalCharge: quote.totalCharge,
      },
      "Courier shipping charge calculated successfully",
    );
  }

  async prepareStorefrontOrderCourier(
    businessId: string,
    configId: string,
    dto: StorefrontCourierQuoteDto | undefined,
    isCod: boolean,
  ) {
    if (!dto) {
      throw new BadRequestException("Courier delivery zone is required");
    }

    const quote = await this.resolveConfiguredShippingCharge(
      businessId,
      configId,
      dto,
      isCod,
    );

    return {
      shippingCharge: quote.totalCharge,
      courier: {
        courierId: quote.courier.id,
        courierConfigId: quote.config.id,
        courierFee: quote.totalCharge,
        deliveryZoneId: quote.deliveryZone.id,
      },
      quote,
    };
  }

  async getPathaoStores(
    currentUser: CurrentUserPayload,
    businessId: string,
    configId: string,
  ) {
    const { config, runtime } = await this.getPathaoRuntimeConfig(
      currentUser,
      businessId,
      configId,
    );

    return apiResponse(
      await this.providers.getPathaoStores(config.mode, runtime),
      "Pathao stores loaded successfully",
    );
  }

  async createPathaoStore(
    currentUser: CurrentUserPayload,
    businessId: string,
    configId: string,
    dto: PathaoCreateStoreDto,
  ) {
    const { config, runtime } = await this.getPathaoRuntimeConfig(
      currentUser,
      businessId,
      configId,
    );

    return apiResponse(
      await this.providers.createPathaoStore(config.mode, runtime, dto),
      "Pathao store created successfully",
    );
  }

  async getPathaoCities(
    currentUser: CurrentUserPayload,
    businessId: string,
    configId: string,
  ) {
    const { config, runtime } = await this.getPathaoRuntimeConfig(
      currentUser,
      businessId,
      configId,
    );

    return apiResponse(
      await this.providers.getPathaoCities(config.mode, runtime),
      "Pathao cities loaded successfully",
    );
  }

  async getPathaoZones(
    currentUser: CurrentUserPayload,
    businessId: string,
    configId: string,
    cityId: number,
  ) {
    const { config, runtime } = await this.getPathaoRuntimeConfig(
      currentUser,
      businessId,
      configId,
    );

    return apiResponse(
      await this.providers.getPathaoZones(config.mode, runtime, cityId),
      "Pathao zones loaded successfully",
    );
  }

  async getPathaoAreas(
    currentUser: CurrentUserPayload,
    businessId: string,
    configId: string,
    zoneId: number,
  ) {
    const { config, runtime } = await this.getPathaoRuntimeConfig(
      currentUser,
      businessId,
      configId,
    );

    return apiResponse(
      await this.providers.getPathaoAreas(config.mode, runtime, zoneId),
      "Pathao areas loaded successfully",
    );
  }

  async calculatePathaoPrice(
    currentUser: CurrentUserPayload,
    businessId: string,
    configId: string,
    dto: PathaoPricePlanDto,
  ) {
    const { config, runtime } = await this.getPathaoRuntimeConfig(
      currentUser,
      businessId,
      configId,
    );

    return apiResponse(
      await this.providers.calculatePathaoPrice(config.mode, runtime, dto),
      "Pathao price plan calculated successfully",
    );
  }

  async getSteadfastBalance(businessId: string, configId: string) {
    const row = await this.getProviderConfigOrThrow(
      businessId,
      configId,
      CourierProvider.STEADFAST,
    );
    const config = this.providers.normalizeSteadfastConfig(
      this.encryption.decrypt(row.config.configData),
    );

    return apiResponse(
      await this.providers.getSteadfastBalance(config),
      "Steadfast balance loaded successfully",
    );
  }

  async getSteadfastPoliceStations(businessId: string, configId: string) {
    const row = await this.getProviderConfigOrThrow(
      businessId,
      configId,
      CourierProvider.STEADFAST,
    );
    const config = this.providers.normalizeSteadfastConfig(
      this.encryption.decrypt(row.config.configData),
    );

    return apiResponse(
      await this.providers.getSteadfastPoliceStations(config),
      "Steadfast police stations loaded successfully",
    );
  }

  async getRedxAreas(businessId: string, configId: string, postCode?: number) {
    const row = await this.getProviderConfigOrThrow(
      businessId,
      configId,
      CourierProvider.REDX,
    );
    const config = this.providers.normalizeRedxConfig(
      this.encryption.decrypt(row.config.configData),
    );

    return apiResponse(
      await this.providers.getRedxAreas(config, postCode),
      "REDX areas loaded successfully",
    );
  }

  async bookShipment(
    currentUser: CurrentUserPayload,
    businessId: string,
    shipmentId: string,
    dto: PathaoBookShipmentDto,
  ) {
    const shipment = await this.getShipmentWithOrderOrThrow(
      businessId,
      shipmentId,
    );

    if (shipment.shipment.consignmentId) {
      throw new BadRequestException(
        "This shipment already has a courier consignment or tracking ID",
      );
    }

    const runtimeSource = shipment.config
      ? {
          config: shipment.config,
          courier: shipment.courier,
        }
      : await this.getActiveCourierConfigOrThrow(
          businessId,
          shipment.courier.id,
        );
    const address = this.extractAddress(
      shipment.shipment.deliveryAddressSnapshot,
    );
    const recipientName = this.requiredValue(
      shipment.shipment.recipientName,
      "Shipment recipient name is required before booking with Pathao",
    );
    const recipientPhone = this.normalizeBdPhone(
      this.requiredValue(
        shipment.shipment.recipientPhone,
        "Shipment recipient phone is required before booking with Pathao",
      ),
    );
    const itemQuantity =
      dto.itemQuantity ?? (await this.getShipmentItemQuantity(shipmentId));
    const storedQuote = this.extractCourierQuote(
      shipment.shipment.deliveryAddressSnapshot,
    );
    const bookingParams = {
      shipmentNo: shipment.shipment.shipmentNo,
      orderNo: shipment.order.orderNo,
      recipientName,
      recipientPhone,
      recipientSecondaryPhone: dto.recipientSecondaryPhone,
      recipientAddress: address,
      codAmount: shipment.shipment.codAmount,
      itemQuantity,
      itemWeight: dto.itemWeight,
      itemDescription: dto.itemDescription,
      specialInstruction: dto.specialInstruction,
      pathao: {
        recipientCity: dto.recipientCity ?? storedQuote?.recipientCity,
        recipientZone: dto.recipientZone ?? storedQuote?.recipientZone,
        recipientArea: dto.recipientArea ?? storedQuote?.recipientArea,
        deliveryType: dto.deliveryType,
        itemType: dto.itemType,
      },
      steadfast: {
        deliveryType: dto.steadfastDeliveryType,
      },
      redx: {
        deliveryArea: dto.redxDeliveryArea,
        deliveryAreaId: dto.redxDeliveryAreaId,
        pickupStoreId: dto.redxPickupStoreId,
        parcelWeight: dto.redxParcelWeight,
        parcelValue: dto.redxParcelValue,
        isClosedBox: dto.redxIsClosedBox,
      },
    };
    const booking = await this.createProviderShipment(
      currentUser,
      runtimeSource.config,
      shipment.courier.code,
      bookingParams,
    );
    const consignmentId = booking.consignmentId;

    if (!consignmentId) {
      throw new BadRequestException(
        "Courier accepted the booking but did not return a consignment or tracking ID",
      );
    }

    const [updated] = await this.db
      .update(courierShipment)
      .set({
        courierConfigId: runtimeSource.config.id,
        consignmentId,
        trackingCode: consignmentId,
        status: booking.status,
        ...(booking.courierFee !== null && {
          courierFee: new Decimal(booking.courierFee),
        }),
      })
      .where(eq(courierShipment.id, shipmentId))
      .returning();

    return apiResponse(
      {
        shipment: updated,
        providerResponse: booking.providerResponse,
      },
      "Courier shipment booked successfully",
    );
  }

  async syncShipmentStatus(
    currentUser: CurrentUserPayload,
    businessId: string,
    shipmentId: string,
  ) {
    const shipment = await this.getShipmentWithOrderOrThrow(
      businessId,
      shipmentId,
    );

    if (!shipment.shipment.consignmentId) {
      throw new BadRequestException(
        "This shipment does not have a courier consignment or tracking ID yet",
      );
    }

    const runtimeSource = shipment.config
      ? {
          config: shipment.config,
          courier: shipment.courier,
        }
      : await this.getActiveCourierConfigOrThrow(
          businessId,
          shipment.courier.id,
        );
    const synced = await this.syncProviderShipmentStatus(
      currentUser,
      runtimeSource.config,
      shipment.courier.code,
      shipment.shipment.consignmentId,
      shipment.shipment.status,
    );
    const [updated] = await this.db
      .update(courierShipment)
      .set({
        status: synced.status,
        ...(synced.status === CourierShipmentStatus.DELIVERED && {
          deliveredAt: new Date(),
        }),
        ...(synced.status === CourierShipmentStatus.CANCELLED && {
          cancelledAt: new Date(),
        }),
      })
      .where(eq(courierShipment.id, shipmentId))
      .returning();

    return apiResponse(
      {
        shipment: updated,
        providerResponse: synced.providerResponse,
      },
      "Courier shipment status synced successfully",
    );
  }

  private async createProviderShipment(
    currentUser: CurrentUserPayload,
    config: CourierConfig,
    provider: CourierProvider,
    params: CourierBookingParams,
  ) {
    switch (provider) {
      case CourierProvider.PATHAO: {
        const runtime = await this.getPathaoRuntimeForConfig(
          currentUser,
          config,
        );
        const providerResponse = await this.providers.createPathaoOrder(
          config.mode,
          runtime,
          {
            shipmentNo: params.shipmentNo,
            merchantOrderId: params.orderNo,
            recipientName: params.recipientName,
            recipientPhone: params.recipientPhone,
            recipientSecondaryPhone: params.recipientSecondaryPhone,
            recipientAddress: params.recipientAddress,
            recipientCity: params.pathao?.recipientCity,
            recipientZone: params.pathao?.recipientZone,
            recipientArea: params.pathao?.recipientArea,
            deliveryType: params.pathao?.deliveryType,
            itemType: params.pathao?.itemType,
            specialInstruction: params.specialInstruction,
            itemQuantity: params.itemQuantity,
            itemWeight: params.itemWeight,
            itemDescription: params.itemDescription,
            amountToCollect: params.codAmount,
          },
        );
        const responseData = providerResponse.data ?? {};

        return {
          providerResponse,
          consignmentId: this.providers.stringValue(
            responseData.consignment_id,
          ),
          status: this.providers.mapPathaoStatus(
            responseData.order_status ?? responseData.order_status_slug,
            CourierShipmentStatus.BOOKED,
          ),
          courierFee: this.numberValue(responseData.delivery_fee),
        };
      }
      case CourierProvider.STEADFAST: {
        const steadfastConfig = this.providers.normalizeSteadfastConfig(
          this.encryption.decrypt(config.configData),
        );
        const providerResponse = await this.providers.createSteadfastOrder(
          steadfastConfig,
          params,
        );
        const responseData = this.objectValue(providerResponse.consignment);

        return {
          providerResponse,
          consignmentId:
            this.providers.stringValue(responseData?.consignment_id) ??
            this.providers.stringValue(responseData?.tracking_code),
          status: this.providers.mapSteadfastStatus(
            responseData?.status,
            CourierShipmentStatus.BOOKED,
          ),
          courierFee: null,
        };
      }
      case CourierProvider.REDX: {
        const redxConfig = this.providers.normalizeRedxConfig(
          this.encryption.decrypt(config.configData),
        );
        const providerResponse = await this.providers.createRedxParcel(
          redxConfig,
          params,
        );

        return {
          providerResponse,
          consignmentId: this.providers.stringValue(
            providerResponse.tracking_id,
          ),
          status: CourierShipmentStatus.BOOKED,
          courierFee: null,
        };
      }
    }
  }

  private async syncProviderShipmentStatus(
    currentUser: CurrentUserPayload,
    config: CourierConfig,
    provider: CourierProvider,
    consignmentId: string,
    currentStatus: CourierShipmentStatus,
  ) {
    switch (provider) {
      case CourierProvider.PATHAO: {
        const runtime = await this.getPathaoRuntimeForConfig(
          currentUser,
          config,
        );
        const providerResponse = await this.providers.getPathaoOrderInfo(
          config.mode,
          runtime,
          consignmentId,
        );
        const responseData = providerResponse.data ?? {};

        return {
          providerResponse,
          status: this.providers.mapPathaoStatus(
            responseData.order_status_slug ?? responseData.order_status,
            currentStatus,
          ),
        };
      }
      case CourierProvider.STEADFAST: {
        const steadfastConfig = this.providers.normalizeSteadfastConfig(
          this.encryption.decrypt(config.configData),
        );
        const providerResponse = await this.providers.getSteadfastStatus(
          steadfastConfig,
          consignmentId,
        );

        return {
          providerResponse,
          status: this.providers.mapSteadfastStatus(
            providerResponse.delivery_status,
            currentStatus,
          ),
        };
      }
      case CourierProvider.REDX: {
        const redxConfig = this.providers.normalizeRedxConfig(
          this.encryption.decrypt(config.configData),
        );
        const providerResponse = await this.providers.getRedxParcelDetails(
          redxConfig,
          consignmentId,
        );
        const parcel = this.objectValue(providerResponse.parcel);

        return {
          providerResponse,
          status: this.providers.mapRedxStatus(parcel?.status, currentStatus),
        };
      }
    }
  }

  private normalizeConfigData(
    provider: CourierProvider,
    configData: Record<string, unknown>,
  ) {
    return this.providers.normalizeConfig(provider, configData);
  }

  private async hydrateDeliveryZone(
    zone: typeof courierDeliveryZone.$inferSelect,
  ) {
    const areas = await this.db
      .select()
      .from(courierDeliveryZoneArea)
      .where(eq(courierDeliveryZoneArea.deliveryZoneId, zone.id))
      .orderBy(courierDeliveryZoneArea.areaName);

    return {
      ...zone,
      areas,
    };
  }

  private async getDeliveryZoneOrThrow(businessId: string, zoneId: string) {
    const [zone] = await this.db
      .select()
      .from(courierDeliveryZone)
      .where(
        and(
          eq(courierDeliveryZone.id, zoneId),
          eq(courierDeliveryZone.businessId, businessId),
          isNull(courierDeliveryZone.deletedAt),
        ),
      )
      .limit(1);

    if (!zone) {
      throw new NotFoundException("Courier delivery zone not found");
    }

    return zone;
  }

  private async getDeliveryZoneAreaOrThrow(
    businessId: string,
    zoneId: string,
    areaId: string,
  ) {
    const [row] = await this.db
      .select({ area: courierDeliveryZoneArea })
      .from(courierDeliveryZoneArea)
      .innerJoin(
        courierDeliveryZone,
        eq(courierDeliveryZone.id, courierDeliveryZoneArea.deliveryZoneId),
      )
      .where(
        and(
          eq(courierDeliveryZoneArea.id, areaId),
          eq(courierDeliveryZoneArea.deliveryZoneId, zoneId),
          eq(courierDeliveryZone.businessId, businessId),
          isNull(courierDeliveryZone.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException("Courier delivery zone area not found");
    }

    return row.area;
  }

  private async getShippingChargeOrThrow(businessId: string, chargeId: string) {
    const [charge] = await this.db
      .select()
      .from(courierShippingCharge)
      .where(
        and(
          eq(courierShippingCharge.id, chargeId),
          eq(courierShippingCharge.businessId, businessId),
        ),
      )
      .limit(1);

    if (!charge) {
      throw new NotFoundException("Courier shipping charge not found");
    }

    return charge;
  }

  private async assertShippingChargeInput(
    businessId: string,
    dto: Pick<
      CreateCourierShippingChargeDto,
      | "deliveryZoneId"
      | "courierId"
      | "minWeight"
      | "maxWeight"
      | "shippingCharge"
      | "codCharge"
      | "status"
    >,
  ) {
    await this.getDeliveryZoneOrThrow(businessId, dto.deliveryZoneId);

    if (dto.courierId) {
      await this.getCourierProviderOrThrow(dto.courierId);
    }

    if (
      dto.minWeight !== undefined &&
      dto.maxWeight !== undefined &&
      new Decimal(dto.minWeight).greaterThan(dto.maxWeight)
    ) {
      throw new BadRequestException(
        "minWeight cannot be greater than maxWeight",
      );
    }
  }

  private async getCourierProviderOrThrow(courierId: string) {
    const [provider] = await this.db
      .select()
      .from(courier)
      .where(eq(courier.id, courierId))
      .limit(1);

    if (!provider) {
      throw new NotFoundException("Courier provider not found");
    }

    return provider;
  }

  private async resolveConfiguredShippingCharge(
    businessId: string,
    configId: string,
    dto: StorefrontCourierQuoteDto,
    isCod: boolean,
  ) {
    const row = await this.getConfigWithCourierOrThrow(businessId, configId);

    if (row.config.status !== CourierConfigStatus.ACTIVE) {
      throw new BadRequestException(
        "Courier is not active for this storefront",
      );
    }

    const weight = new Decimal(dto.weight ?? 0);
    const charges = await this.db
      .select({
        charge: courierShippingCharge,
        deliveryZone: courierDeliveryZone,
      })
      .from(courierShippingCharge)
      .innerJoin(
        courierDeliveryZone,
        eq(courierDeliveryZone.id, courierShippingCharge.deliveryZoneId),
      )
      .where(
        and(
          eq(courierShippingCharge.businessId, businessId),
          eq(courierShippingCharge.deliveryZoneId, dto.deliveryZoneId),
          eq(courierShippingCharge.status, CourierShippingChargeStatus.ACTIVE),
          eq(courierDeliveryZone.status, CourierDeliveryZoneStatus.ACTIVE),
          isNull(courierDeliveryZone.deletedAt),
          or(
            eq(courierShippingCharge.courierId, row.courier.id),
            isNull(courierShippingCharge.courierId),
          ),
          or(
            isNull(courierShippingCharge.minWeight),
            lte(courierShippingCharge.minWeight, weight),
          ),
          or(
            isNull(courierShippingCharge.maxWeight),
            gte(courierShippingCharge.maxWeight, weight),
          ),
        ),
      );
    const match =
      charges.find((charge) => charge.charge.courierId === row.courier.id) ??
      charges[0];

    if (!match) {
      throw new BadRequestException(
        "No active shipping charge is configured for the selected courier and delivery zone",
      );
    }

    const shippingCharge = Number(
      new Decimal(match.charge.shippingCharge).toDecimalPlaces(2).toString(),
    );
    const codCharge = isCod
      ? Number(
          new Decimal(match.charge.codCharge).toDecimalPlaces(2).toString(),
        )
      : 0;

    return {
      config: row.config,
      courier: row.courier,
      deliveryZone: match.deliveryZone,
      charge: match.charge,
      shippingCharge,
      codCharge,
      totalCharge: Number(
        new Decimal(shippingCharge)
          .plus(codCharge)
          .toDecimalPlaces(2)
          .toString(),
      ),
    };
  }

  private async getPathaoRuntimeConfig(
    currentUser: CurrentUserPayload,
    businessId: string,
    configId: string,
    options?: { requireActive?: boolean; forceRefresh?: boolean },
  ) {
    const row = await this.getConfigWithCourierOrThrow(businessId, configId);

    if (row.courier.code !== CourierProvider.PATHAO) {
      throw new BadRequestException("This courier configuration is not Pathao");
    }

    if (
      options?.requireActive !== false &&
      row.config.status !== CourierConfigStatus.ACTIVE
    ) {
      throw new BadRequestException(
        "Pathao courier configuration must be active before calling Pathao",
      );
    }

    const runtime = await this.getPathaoRuntimeForConfig(
      currentUser,
      row.config,
      options?.forceRefresh,
    );

    return {
      ...row,
      runtime,
    };
  }

  private async getProviderConfigOrThrow(
    businessId: string,
    configId: string,
    provider: CourierProvider,
  ) {
    const row = await this.getConfigWithCourierOrThrow(businessId, configId);

    if (row.courier.code !== provider) {
      throw new BadRequestException(
        `This courier configuration is not for ${provider}`,
      );
    }

    if (row.config.status !== CourierConfigStatus.ACTIVE) {
      throw new BadRequestException(
        "Courier configuration must be active before calling the courier API",
      );
    }

    return row;
  }

  private async getPathaoRuntimeForConfig(
    currentUser: CurrentUserPayload | undefined,
    config: CourierConfig,
    forceRefresh = false,
  ) {
    const normalizedConfig = this.providers.normalizePathaoConfig(
      this.encryption.decrypt(config.configData),
    );
    const runtime = forceRefresh
      ? await this.providers.refreshPathaoToken(config.mode, normalizedConfig)
      : await this.providers.ensurePathaoToken(config.mode, normalizedConfig);

    if (runtime.config !== normalizedConfig) {
      await this.persistConfigData(
        currentUser,
        config.id,
        this.providers.toJsonConfig(runtime.config),
      );
    }

    return runtime;
  }

  private async persistConfigData(
    currentUser: CurrentUserPayload | undefined,
    configId: string,
    configData: Record<string, unknown>,
  ) {
    await this.db
      .update(courierConfig)
      .set({
        configData: this.encryption.encrypt(configData),
        ...(currentUser && { updatedBy: currentUser.id }),
      })
      .where(eq(courierConfig.id, configId));
  }

  private async getActiveCourierConfigOrThrow(
    businessId: string,
    courierId: string,
  ) {
    const [row] = await this.db
      .select({ config: courierConfig, courier })
      .from(courierConfig)
      .innerJoin(courier, eq(courier.id, courierConfig.courierId))
      .where(
        and(
          eq(courierConfig.businessId, businessId),
          eq(courierConfig.courierId, courierId),
          eq(courierConfig.status, CourierConfigStatus.ACTIVE),
          isNull(courierConfig.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new BadRequestException(
        "No active courier configuration was found for this shipment courier",
      );
    }

    return row;
  }

  private async getShipmentWithOrderOrThrow(
    businessId: string,
    shipmentId: string,
  ) {
    const [row] = await this.db
      .select({
        shipment: courierShipment,
        courier,
        config: courierConfig,
        order: orderTable,
      })
      .from(courierShipment)
      .innerJoin(courier, eq(courier.id, courierShipment.courierId))
      .innerJoin(orderTable, eq(orderTable.id, courierShipment.orderId))
      .leftJoin(
        courierConfig,
        eq(courierConfig.id, courierShipment.courierConfigId),
      )
      .where(
        and(
          eq(courierShipment.id, shipmentId),
          eq(courierShipment.businessId, businessId),
          isNull(courierShipment.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException("Courier shipment not found");
    }

    return row;
  }

  private async getShipmentItemQuantity(shipmentId: string) {
    const items = await this.db
      .select({ quantity: courierShipmentItem.quantity })
      .from(courierShipmentItem)
      .where(eq(courierShipmentItem.shipmentId, shipmentId));
    const quantity = items.reduce(
      (total, item) => total.plus(item.quantity),
      new Decimal(0),
    );

    return Math.max(1, Math.ceil(quantity.toNumber()));
  }

  private extractAddress(value: JsonValue | null | undefined) {
    if (typeof value === "string") {
      return this.validatePathaoAddress(value);
    }

    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new BadRequestException(
        "Shipment delivery address is required before booking with Pathao",
      );
    }

    const address =
      this.objectString(value, "address") ??
      [
        this.objectString(value, "line1"),
        this.objectString(value, "line2"),
        this.objectString(value, "street"),
        this.objectString(value, "area"),
        this.objectString(value, "city"),
      ]
        .filter(Boolean)
        .join(", ");

    return this.validatePathaoAddress(address);
  }

  private extractCourierQuote(value: JsonValue | null | undefined) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }

    const quote = value.courierQuote;

    if (typeof quote !== "object" || quote === null || Array.isArray(quote)) {
      return null;
    }

    const recipientCity = this.numberValue(quote.recipientCity);
    const recipientZone = this.numberValue(quote.recipientZone);
    const recipientArea = this.numberValue(quote.recipientArea);

    return {
      recipientCity:
        recipientCity !== null && Number.isInteger(recipientCity)
          ? recipientCity
          : undefined,
      recipientZone:
        recipientZone !== null && Number.isInteger(recipientZone)
          ? recipientZone
          : undefined,
      recipientArea:
        recipientArea !== null && Number.isInteger(recipientArea)
          ? recipientArea
          : undefined,
    };
  }

  private validatePathaoAddress(address: string) {
    const trimmed = address.trim();

    if (trimmed.length < 10 || trimmed.length > 220) {
      throw new BadRequestException(
        "Pathao recipient address must be between 10 and 220 characters",
      );
    }

    return trimmed;
  }

  private objectString(value: { [key: string]: JsonValue }, key: string) {
    const entry = value[key];

    return typeof entry === "string" ? entry.trim() || null : null;
  }

  private requiredValue(value: string | null, message: string) {
    const trimmed = value?.trim();

    if (!trimmed) {
      throw new BadRequestException(message);
    }

    return trimmed;
  }

  private normalizeBdPhone(value: string) {
    const digits = value.replace(/\D/g, "");
    const phone =
      digits.length === 13 && digits.startsWith("88")
        ? digits.slice(2)
        : digits;

    if (!/^01\d{9}$/.test(phone)) {
      throw new BadRequestException(
        "Pathao recipient phone must be a Bangladeshi 11-digit mobile number",
      );
    }

    return phone;
  }

  private numberValue(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }

    return null;
  }

  private objectValue(value: unknown) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private async getConfigWithCourierOrThrow(
    businessId: string,
    configId: string,
  ) {
    const [row] = await this.db
      .select({ config: courierConfig, courier })
      .from(courierConfig)
      .innerJoin(courier, eq(courier.id, courierConfig.courierId))
      .where(
        and(
          eq(courierConfig.id, configId),
          eq(courierConfig.businessId, businessId),
          isNull(courierConfig.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException("Courier configuration not found");
    }

    return row;
  }

  private toConfigResponse(config: CourierConfig, provider: Courier) {
    return {
      ...config,
      configData: this.encryption.decrypt(config.configData),
      courier: provider,
    };
  }

  private handleUniqueError(error: unknown): never {
    if (isUniqueConstraintError(error)) {
      throw new ConflictException(
        "A courier configuration already exists for this courier",
      );
    }

    throw error;
  }
}
