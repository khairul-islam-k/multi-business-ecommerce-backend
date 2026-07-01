import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

import {
  Courier,
  courier,
  courierConfig,
  CourierConfig,
  CourierConfigStatus,
  CourierStatus,
} from "@/database/schema";
import {
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
import {
  BulkUpdateCourierConfigDto,
  QueryCourierConfigDto,
  QueryCourierDto,
  SeedCourierDto,
  UpdateCourierConfigDto,
} from "./dto/courier.dto";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

@Injectable()
export class CourierService {
  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: CourierConfigEncryptionService,
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
          const [updated] = await tx
            .update(courierConfig)
            .set({
              ...(config.mode !== undefined && { mode: config.mode }),
              ...(config.status !== undefined && { status: config.status }),
              ...(config.configData !== undefined && {
                configData: this.encryption.encrypt(config.configData),
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
      const [updated] = await this.db
        .update(courierConfig)
        .set({
          ...(dto.mode !== undefined && { mode: dto.mode }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.configData !== undefined && {
            configData: this.encryption.encrypt(dto.configData),
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
      })),
    );
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
