import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  BusinessStatus,
  CommonStatus,
  MediaAssetStatus,
  MediaFileType,
  PackageLimitKey,
  Prisma,
  SystemUserStatus,
  SystemUserType,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { PackageSubscriptionService } from "./package-subscription.service";

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
    private readonly prisma: PrismaService,
    private readonly subscriptions: PackageSubscriptionService,
  ) {}

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
    const subscription = await this.prisma.packageSubscription.findUnique({
      where: {
        id: subscriptionId,
      },
      select: {
        planSnapshot: true,
      },
    });

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

    const counter = await this.prisma.packageUsageCounter.findFirst({
      where: {
        subscriptionId,
        limitKey,
        periodStart: {
          lte: now,
        },
        periodEnd: {
          gte: now,
        },
      },
      orderBy: {
        periodStart: "desc",
      },
    });

    return counter?.usedValue ?? 0;
  }

  private getLiveUsage(tenantId: string, limitKey: PackageLimitKey) {
    const activeBusinessWhere: Prisma.BusinessWhereInput = {
      ownerUserId: tenantId,
      deletedAt: null,
      status: {
        in: [BusinessStatus.TRIAL, BusinessStatus.ACTIVE],
      },
    };

    if (limitKey === PackageLimitKey.MAX_BUSINESSES) {
      return this.prisma.business.count({
        where: activeBusinessWhere,
      });
    }

    if (limitKey === PackageLimitKey.MAX_EMPLOYEES) {
      return this.prisma.systemUser.count({
        where: {
          tenantId,
          type: SystemUserType.EMPLOYEE,
          status: SystemUserStatus.ACTIVE,
          deletedAt: null,
        },
      });
    }

    if (limitKey === PackageLimitKey.MAX_ROLES) {
      return this.prisma.rbacRole.count({
        where: {
          deletedAt: null,
          status: CommonStatus.ACTIVE,
          business: activeBusinessWhere,
        },
      });
    }

    if (limitKey === PackageLimitKey.MAX_MEDIAS) {
      return this.prisma.mediaAsset.count({
        where: {
          deletedAt: null,
          status: MediaAssetStatus.ACTIVE,
          fileType: MediaFileType.IMAGE,
          business: activeBusinessWhere,
        },
      });
    }

    return Promise.resolve(0);
  }

  private getPlanSnapshotLimits(snapshot: Prisma.JsonValue) {
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
