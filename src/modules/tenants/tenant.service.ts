import { Injectable, NotFoundException } from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import {
  business,
  BusinessStatus,
  systemUser,
  systemUserProfile,
  SystemUserType,
} from "@/database/schema";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { QueryTenantDto } from "./dto/query-tenant.dto";
import { UpdateTenantStatusDto } from "./dto/update-tenant-status.dto";
import { DatabaseService } from "../../database/database.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";

@Injectable()
export class TenantService {
  constructor(private readonly database: DatabaseService) {}

  async fineOne(id: string) {
    const [tenant] = await this.database.db
      .select()
      .from(systemUser)
      .where(eq(systemUser.id, id))
      .limit(1);

    if (!tenant) {
      throw new NotFoundException();
    }

    const [profile, ownedBusinesses] = await Promise.all([
      this.database.db
        .select()
        .from(systemUserProfile)
        .where(eq(systemUserProfile.userId, tenant.id))
        .limit(1)
        .then((items) => items[0] ?? null),
      this.database.db
        .select()
        .from(business)
        .where(eq(business.ownerUserId, tenant.id)),
    ]);

    return apiResponse({
      ...tenant,
      profile,
      ownedBusinesses,
    });
  }

  async findAll(query: QueryTenantDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder ?? "desc";

    const conditions = [
      eq(systemUser.type, SystemUserType.TENANT),
      isNull(systemUser.deletedAt),
      query.status ? eq(systemUser.status, query.status) : undefined,
      query.search
        ? or(
            ilike(systemUser.name, `%${query.search}%`),
            ilike(systemUser.email, `%${query.search}%`),
            ilike(systemUser.phone, `%${query.search}%`),
            sql`exists (
              select 1
              from ${business}
              where ${business.ownerUserId} = ${systemUser.id}
                and ${business.name} ilike ${`%${query.search}%`}
            )`,
          )
        : undefined,
    ].filter(Boolean);

    const where = and(...conditions);
    const orderColumn = systemUser[sortBy];
    const orderBy = sortOrder === "asc" ? asc(orderColumn) : desc(orderColumn);

    const items = await this.database.db
      .select({
        id: systemUser.id,
        name: systemUser.name,
        email: systemUser.email,
        phone: systemUser.phone,
        type: systemUser.type,
        status: systemUser.status,
        createdAt: systemUser.createdAt,
        updatedAt: systemUser.updatedAt,
        _count: {
          ownedBusinesses: sql<number>`(
            select count(*)::int
            from ${business}
            where ${business.ownerUserId} = ${systemUser.id}
          )`,
          tenantUsers: sql<number>`(
            select count(*)::int
            from ${systemUser} tenant_users
            where tenant_users.tenant_id = ${systemUser.id}
          )`,
        },
      })
      .from(systemUser)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(skip);

    const [totalRow] = await this.database.db
      .select({ value: count() })
      .from(systemUser)
      .where(where);
    const total = totalRow?.value ?? 0;

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async updateStatus(
    currentUser: CurrentUserPayload,
    tenantId: string,
    dto: UpdateTenantStatusDto,
  ) {
    const [tenant] = await this.database.db
      .select({ id: systemUser.id })
      .from(systemUser)
      .where(
        and(
          eq(systemUser.id, tenantId),
          eq(systemUser.type, SystemUserType.TENANT),
          isNull(systemUser.deletedAt),
        ),
      )
      .limit(1);

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    return this.database.db.transaction(async (tx) => {
      const [updatedTenant] = await tx
        .update(systemUser)
        .set({
          status: dto.status,
          updatedById: currentUser.id,
        })
        .where(eq(systemUser.id, tenantId))
        .returning();

      await tx
        .update(systemUser)
        .set({
          status: dto.status,
        })
        .where(eq(systemUser.tenantId, updatedTenant.id));

      return apiResponse(updatedTenant, "Tenant status updated successfully");
    });
  }
}
