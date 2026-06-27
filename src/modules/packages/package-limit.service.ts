import {
  and,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  lte,
  sql,
} from "drizzle-orm";

import {
  business,
  BusinessStatus,
  JsonValue,
  mediaAsset,
  MediaAssetStatus,
  MediaFileType,
  PackageLimitKey,
  packageSubscription,
  packageUsageCounter,
  product,
  systemUser,
  SystemUserStatus,
  SystemUserType,
  website,
} from "@/database/schema";
import { ForbiddenException, Injectable } from "@nestjs/common";

import { DatabaseService } from "../../database/database.service";
import { PackageSubscriptionService } from "./package-subscription.service";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

type LimitUsage = {
  limitKey: PackageLimitKey;
  allowed: number;
  liveUsed: number;
  consumed: number;
  used: number;
  remaining: number;
};

type PlanSnapshotLimit = {
  limitKey: PackageLimitKey;
  limitValue: number;
};

@Injectable()
export class PackageLimitService {
  constructor(
    private readonly database: DatabaseService,
    private readonly subscriptions: PackageSubscriptionService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async assertWithinLimit(
    user: Pick<CurrentUserPayload, "id" | "type" | "tenantId">,
    limitKey: PackageLimitKey,
    amount = 1,
  ) {
    if (user.type === SystemUserType.ADMIN) {
      return;
    }

    const tenantId = this.subscriptions.resolveTenantId(user);

    if (!tenantId) {
      throw new ForbiddenException("Tenant package context is missing");
    }

    const usage = await this.getUsageForLimit(tenantId, limitKey);

    if (usage.used + amount > usage.allowed) {
      throw new ForbiddenException(
        `Package limit exceeded for ${limitKey}. Allowed: ${usage.allowed}, used: ${usage.used}`,
      );
    }
  }

  async getUsageSummary(tenantId: string) {
    const subscription =
      await this.subscriptions.assertTenantCanAccess(tenantId);
    const limitKeys = new Set<PackageLimitKey>();

    for (const limit of this.getPlanSnapshotLimits(subscription.planSnapshot)) {
      limitKeys.add(limit.limitKey);
    }

    const items: LimitUsage[] = [];

    for (const limitKey of limitKeys) {
      items.push(await this.buildUsage(tenantId, subscription.id, limitKey));
    }

    return items.sort((a, b) => a.limitKey.localeCompare(b.limitKey));
  }

  async assertUsageFitsLimits(tenantId: string, limits: PlanSnapshotLimit[]) {
    const violations: string[] = [];

    for (const limit of limits) {
      const liveUsed = await this.getLiveUsage(tenantId, limit.limitKey);

      if (liveUsed > limit.limitValue) {
        violations.push(
          `${limit.limitKey}: allowed ${limit.limitValue}, currently used ${liveUsed}`,
        );
      }
    }

    if (violations.length > 0) {
      throw new ForbiddenException(
        `Current usage exceeds target package limits. ${violations.join("; ")}`,
      );
    }
  }

  private async getUsageForLimit(tenantId: string, limitKey: PackageLimitKey) {
    const subscription =
      await this.subscriptions.assertTenantCanAccess(tenantId);

    return this.buildUsage(tenantId, subscription.id, limitKey);
  }

  private async buildUsage(
    tenantId: string,
    subscriptionId: string,
    limitKey: PackageLimitKey,
  ): Promise<LimitUsage> {
    const [allowed, liveUsed, consumed] = await Promise.all([
      this.getAllowedLimit(subscriptionId, limitKey),
      this.getLiveUsage(tenantId, limitKey),
      this.getConsumedUsage(subscriptionId, limitKey),
    ]);

    const used = Math.max(liveUsed, consumed);

    return {
      limitKey,
      allowed,
      liveUsed,
      consumed,
      used,
      remaining: Math.max(allowed - used, 0),
    };
  }

  private async getAllowedLimit(
    subscriptionId: string,
    limitKey: PackageLimitKey,
  ) {
    const [subscription] = await this.db
      .select({ planSnapshot: packageSubscription.planSnapshot })
      .from(packageSubscription)
      .where(eq(packageSubscription.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      return 0;
    }

    return (
      this.getPlanSnapshotLimits(subscription.planSnapshot).find(
        (limit) => limit.limitKey === limitKey,
      )?.limitValue ?? 0
    );
  }

  private async getConsumedUsage(
    subscriptionId: string,
    limitKey: PackageLimitKey,
  ) {
    const now = new Date();
    const [counter] = await this.db
      .select()
      .from(packageUsageCounter)
      .where(
        and(
          eq(packageUsageCounter.subscriptionId, subscriptionId),
          eq(packageUsageCounter.limitKey, limitKey),
          lte(packageUsageCounter.periodStart, now),
          gte(packageUsageCounter.periodEnd, now),
        ),
      )
      .orderBy(desc(packageUsageCounter.periodStart))
      .limit(1);

    return counter?.usedValue ?? 0;
  }

  private getLiveUsage(tenantId: string, limitKey: PackageLimitKey) {
    if (limitKey === PackageLimitKey.MAX_BUSINESSES) {
      return this.db
        .select({ value: count() })
        .from(business)
        .where(
          and(
            eq(business.ownerUserId, tenantId),
            isNull(business.deletedAt),
            inArray(business.status, [BusinessStatus.ACTIVE]),
          ),
        )
        .then(([row]) => row?.value ?? 0);
    }

    if (limitKey === PackageLimitKey.MAX_EMPLOYEES) {
      return this.db
        .select({ value: count() })
        .from(systemUser)
        .where(
          and(
            eq(systemUser.tenantId, tenantId),
            eq(systemUser.type, SystemUserType.EMPLOYEE),
            eq(systemUser.status, SystemUserStatus.ACTIVE),
            isNull(systemUser.deletedAt),
          ),
        )
        .then(([row]) => row?.value ?? 0);
    }

    if (limitKey === PackageLimitKey.MAX_MEDIAS) {
      return this.db
        .select({
          value: sql<string>`coalesce(ceil(sum(coalesce(${mediaAsset.fileSize}, 0)) / 1048576.0), 0)`,
        })
        .from(mediaAsset)
        .where(
          and(
            isNull(mediaAsset.deletedAt),
            eq(mediaAsset.status, MediaAssetStatus.ACTIVE),
            eq(mediaAsset.fileType, MediaFileType.IMAGE),
            exists(
              this.db
                .select({ id: business.id })
                .from(business)
                .where(
                  and(
                    eq(business.id, mediaAsset.businessId),
                    eq(business.ownerUserId, tenantId),
                    isNull(business.deletedAt),
                    eq(business.status, BusinessStatus.ACTIVE),
                  ),
                ),
            ),
          ),
        )
        .then(([row]) => Number(row?.value ?? 0));
    }

    if (limitKey === PackageLimitKey.MAX_PRODUCTS) {
      return this.db
        .select({ value: count() })
        .from(product)
        .where(
          and(
            isNull(product.deletedAt),
            exists(
              this.db
                .select({ id: business.id })
                .from(business)
                .where(
                  and(
                    eq(business.id, product.businessId),
                    eq(business.ownerUserId, tenantId),
                    isNull(business.deletedAt),
                    eq(business.status, BusinessStatus.ACTIVE),
                  ),
                ),
            ),
          ),
        )
        .then(([row]) => row?.value ?? 0);
    }

    if (limitKey === PackageLimitKey.MAX_WEBSITES) {
      return this.db
        .select({ value: count() })
        .from(website)
        .where(
          and(
            isNull(website.deletedAt),
            exists(
              this.db
                .select({ id: business.id })
                .from(business)
                .where(
                  and(
                    eq(business.id, website.businessId),
                    eq(business.ownerUserId, tenantId),
                    isNull(business.deletedAt),
                    eq(business.status, BusinessStatus.ACTIVE),
                  ),
                ),
            ),
          ),
        )
        .then(([row]) => row?.value ?? 0);
    }

    return Promise.resolve(0);
  }

  private getPlanSnapshotLimits(snapshot: JsonValue | null) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return [];
    }

    const limits = snapshot.limits;

    if (!Array.isArray(limits)) {
      return [];
    }

    return limits.filter(this.isPlanSnapshotLimit);
  }

  private isPlanSnapshotLimit(value: unknown): value is PlanSnapshotLimit {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const candidate = value as Record<string, unknown>;

    return (
      typeof candidate.limitKey === "string" &&
      Object.values(PackageLimitKey).includes(
        candidate.limitKey as PackageLimitKey,
      ) &&
      typeof candidate.limitValue === "number"
    );
  }
}
