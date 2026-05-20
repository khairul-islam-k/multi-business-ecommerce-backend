import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  PackageBillingCycle,
  PackageLimitKey,
  PackageResetCycle,
  PackageSubscriptionStatus,
  PackageStatus,
  Prisma,
  SystemUserType,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

const ACTIVE_SUBSCRIPTION_STATUSES = [
  PackageSubscriptionStatus.TRIALING,
  PackageSubscriptionStatus.ACTIVE,
  PackageSubscriptionStatus.PAST_DUE,
] satisfies PackageSubscriptionStatus[];

const DEFAULT_TRIAL_DAYS = 7;

const PLAN_SNAPSHOT_INCLUDE = {
  limits: true,
  features: {
    where: {
      isActive: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
  },
} satisfies Prisma.PackagePlanInclude;

export const PACKAGE_SUBSCRIPTION_INCLUDE = {
  package: {
    include: PLAN_SNAPSHOT_INCLUDE,
  },
} satisfies Prisma.PackageSubscriptionInclude;

export type PackagePlanSnapshot = {
  planId: string;
  name: string;
  description: string | null;
  price: number;
  billingCycle: PackageBillingCycle;
  currencyCode: string;
  freeTrialDays: number;
  limits: {
    limitKey: PackageLimitKey;
    limitValue: number;
    resetCycle: PackageResetCycle;
    description: string | null;
  }[];
  features: {
    title: string;
    description: string | null;
    sortOrder: number;
  }[];
  capturedAt: string;
};

export type PlanChangeCharge = {
  targetPlanId: string;
  targetPlanPrice: number;
  currentUnusedBalance: number;
  amountDue: number;
  currencyCode: string;
  currentSubscriptionId: string | null;
  currentPlanId: string | null;
  currentPlanPrice: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  totalPeriodMs: number;
  remainingPeriodMs: number;
  calculatedAt: string;
};

@Injectable()
export class PackageSubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  resolveTenantId(
    user: Pick<CurrentUserPayload, "id" | "type" | "tenantId">,
  ): string | null {
    if (user.type === SystemUserType.ADMIN) {
      return null;
    }

    if (user.type === SystemUserType.TENANT) {
      return user.id;
    }

    return user.tenantId;
  }

  async assertTenantSubscriptionActive(
    user: Pick<CurrentUserPayload, "id" | "type" | "tenantId">,
  ) {
    if (user.type === SystemUserType.ADMIN) {
      return null;
    }

    const tenantId = this.resolveTenantId(user);

    if (!tenantId) {
      throw new ForbiddenException("Tenant subscription context is missing");
    }

    return this.assertTenantCanAccess(tenantId);
  }

  async assertTenantCanAccess(tenantId: string) {
    const subscription = await this.findCurrentSubscription(tenantId);

    if (!subscription) {
      throw new ForbiddenException(
        "Tenant does not have an active subscription",
      );
    }

    const now = new Date();

    if (subscription.currentPeriodEnd <= now) {
      await this.prisma.packageSubscription.updateMany({
        where: {
          id: subscription.id,
          status: {
            in: ACTIVE_SUBSCRIPTION_STATUSES,
          },
        },
        data: {
          status: PackageSubscriptionStatus.EXPIRED,
          endedAt: now,
          endReason: "Subscription period expired",
        },
      });

      throw new ForbiddenException("Tenant subscription has expired");
    }

    return subscription;
  }

  async findCurrentSubscription(tenantId: string) {
    return this.prisma.packageSubscription.findFirst({
      where: {
        tenantId,
        status: {
          in: ACTIVE_SUBSCRIPTION_STATUSES,
        },
      },
      include: PACKAGE_SUBSCRIPTION_INCLUDE,
      orderBy: {
        currentPeriodEnd: "desc",
      },
    });
  }

  async assignDefaultTrial(tenantId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;

    const existingSubscription = await client.packageSubscription.findFirst({
      where: {
        tenantId,
        status: {
          in: ACTIVE_SUBSCRIPTION_STATUSES,
        },
      },
      orderBy: {
        currentPeriodEnd: "desc",
      },
    });

    if (existingSubscription) {
      return existingSubscription;
    }

    const plan = await client.packagePlan.findFirst({
      where: {
        isDefault: true,
        status: PackageStatus.ACTIVE,
        deletedAt: null,
      },
      include: PLAN_SNAPSHOT_INCLUDE,
      orderBy: {
        sortOrder: "asc",
      },
    });

    if (!plan) {
      throw new InternalServerErrorException(
        "Unable to continue because no default package plan is configured.",
      );
    }
    const now = new Date();
    const trialDays =
      plan.freeTrialDays > 0 ? plan.freeTrialDays : DEFAULT_TRIAL_DAYS;
    const trialEndsAt = this.addDays(now, trialDays);

    return client.packageSubscription.create({
      data: {
        tenantId,
        packageId: plan.id,
        planSnapshot: this.buildPlanSnapshot(plan, now),
        status: PackageSubscriptionStatus.TRIALING,
        billingCycle: plan.billingCycle,
        price: plan.price,
        currencyCode: plan.currencyCode,
        startedAt: now,
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
      },
    });
  }

  async replaceCurrentSubscription(
    tenantId: string,
    planId: string,
    tx?: Prisma.TransactionClient,
    planSnapshot?: PackagePlanSnapshot,
  ) {
    const client = tx ?? this.prisma;

    const plan = await client.packagePlan.findFirst({
      where: {
        id: planId,
        status: PackageStatus.ACTIVE,
        deletedAt: null,
      },
      include: PLAN_SNAPSHOT_INCLUDE,
    });

    if (!plan) {
      throw new NotFoundException("Package plan not found");
    }

    const now = new Date();
    const snapshot = planSnapshot ?? this.buildPlanSnapshot(plan, now);
    const currentPeriodEnd = this.getPeriodEnd(now, snapshot.billingCycle);

    await client.packageSubscription.updateMany({
      where: {
        tenantId,
        status: {
          in: ACTIVE_SUBSCRIPTION_STATUSES,
        },
      },
      data: {
        status: PackageSubscriptionStatus.CANCELLED,
        endedAt: now,
        endReason: "Changed package plan",
      },
    });

    return client.packageSubscription.create({
      data: {
        tenantId,
        packageId: plan.id,
        planSnapshot: snapshot,
        status: PackageSubscriptionStatus.ACTIVE,
        billingCycle: snapshot.billingCycle,
        price: snapshot.price,
        currencyCode: snapshot.currencyCode,
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd,
      },
      include: PACKAGE_SUBSCRIPTION_INCLUDE,
    });
  }

  async cancelCurrentSubscription(tenantId: string, reason?: string) {
    const subscription = await this.findCurrentSubscription(tenantId);

    if (!subscription) {
      throw new NotFoundException("Active subscription not found");
    }

    return this.prisma.packageSubscription.update({
      where: {
        id: subscription.id,
      },
      data: {
        status: PackageSubscriptionStatus.CANCELLED,
        endedAt: new Date(),
        endReason: reason?.trim() || "Cancelled by tenant",
      },
    });
  }

  async calculatePlanChangeCharge(
    tenantId: string,
    targetPlanId: string,
    now = new Date(),
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const targetPlan = await client.packagePlan.findFirst({
      where: {
        id: targetPlanId,
        status: PackageStatus.ACTIVE,
        deletedAt: null,
      },
      include: PLAN_SNAPSHOT_INCLUDE,
    });

    if (!targetPlan) {
      throw new NotFoundException("Package plan not found");
    }

    const currentSubscription = await client.packageSubscription.findFirst({
      where: {
        tenantId,
        status: {
          in: ACTIVE_SUBSCRIPTION_STATUSES,
        },
      },
      orderBy: {
        currentPeriodEnd: "desc",
      },
    });

    if (!currentSubscription) {
      return {
        charge: {
          targetPlanId: targetPlan.id,
          targetPlanPrice: Number(targetPlan.price),
          currentUnusedBalance: 0,
          amountDue: Number(targetPlan.price),
          currencyCode: targetPlan.currencyCode,
          currentSubscriptionId: null,
          currentPlanId: null,
          currentPlanPrice: 0,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          totalPeriodMs: 0,
          remainingPeriodMs: 0,
          calculatedAt: now.toISOString(),
        } satisfies PlanChangeCharge,
        targetPlan,
        targetPlanSnapshot: this.buildPlanSnapshot(targetPlan, now),
      };
    }

    if (currentSubscription.packageId === targetPlan.id) {
      throw new BadRequestException(
        "Tenant is already subscribed to this plan",
      );
    }

    if (currentSubscription.currencyCode !== targetPlan.currencyCode) {
      throw new BadRequestException(
        "Cannot calculate plan change across different currencies",
      );
    }

    const currentUnusedBalance = this.calculateUnusedSubscriptionBalance({
      price: Number(currentSubscription.price),
      billingCycle: currentSubscription.billingCycle,
      currentPeriodStart: currentSubscription.currentPeriodStart,
      currentPeriodEnd: currentSubscription.currentPeriodEnd,
      now,
    });
    const amountDue = Math.max(
      Number(targetPlan.price) - currentUnusedBalance,
      0,
    );
    const totalPeriodMs = Math.max(
      currentSubscription.currentPeriodEnd.getTime() -
        currentSubscription.currentPeriodStart.getTime(),
      0,
    );
    const remainingPeriodMs = Math.max(
      currentSubscription.currentPeriodEnd.getTime() - now.getTime(),
      0,
    );

    return {
      charge: {
        targetPlanId: targetPlan.id,
        targetPlanPrice: Number(targetPlan.price),
        currentUnusedBalance,
        amountDue,
        currencyCode: targetPlan.currencyCode,
        currentSubscriptionId: currentSubscription.id,
        currentPlanId: currentSubscription.packageId,
        currentPlanPrice: Number(currentSubscription.price),
        currentPeriodStart:
          currentSubscription.currentPeriodStart.toISOString(),
        currentPeriodEnd: currentSubscription.currentPeriodEnd.toISOString(),
        totalPeriodMs,
        remainingPeriodMs,
        calculatedAt: now.toISOString(),
      } satisfies PlanChangeCharge,
      targetPlan,
      targetPlanSnapshot: this.buildPlanSnapshot(targetPlan, now),
    };
  }

  private getPeriodEnd(start: Date, billingCycle: PackageBillingCycle) {
    if (
      billingCycle === PackageBillingCycle.FREE ||
      billingCycle === PackageBillingCycle.LIFETIME
    ) {
      return new Date("9999-12-31T23:59:59.999Z");
    }

    if (billingCycle === PackageBillingCycle.YEARLY) {
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      return end;
    }

    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return end;
  }

  private addDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }

  private buildPlanSnapshot(
    plan: Prisma.PackagePlanGetPayload<{
      include: typeof PLAN_SNAPSHOT_INCLUDE;
    }>,
    capturedAt: Date,
  ): PackagePlanSnapshot {
    return {
      planId: plan.id,
      name: plan.name,
      description: plan.description,
      price: Number(plan.price),
      billingCycle: plan.billingCycle,
      currencyCode: plan.currencyCode,
      freeTrialDays: plan.freeTrialDays,
      limits: plan.limits.map((limit) => ({
        limitKey: limit.limitKey,
        limitValue: limit.limitValue,
        resetCycle: limit.resetCycle,
        description: limit.description,
      })),
      features: plan.features.map((feature) => ({
        title: feature.title,
        description: feature.description,
        sortOrder: feature.sortOrder,
      })),
      capturedAt: capturedAt.toISOString(),
    };
  }

  /**
   * Calculates how much unused value remains on the tenant's current plan.
   *
   * Formula for recurring plans:
   *   unused balance = current plan price * (remaining period ms / total period ms)
   *
   * Checkout then charges:
   *   amount due = max(target plan full price - unused balance, 0)
   *
   * Example: a tenant bought Starter for 30/month, used 5 days of a 30-day
   * period, then upgrades to Business for 60/month. The unused Starter balance
   * is 30 * 25/30 = 25, so the upgrade checkout amount is 60 - 25 = 35.
   *
   * FREE plans produce no credit. LIFETIME plans do not have a meaningful
   * period to prorate, so the paid price is treated as the available balance
   * while the subscription is still active.
   */
  private calculateUnusedSubscriptionBalance(params: {
    price: number;
    billingCycle: PackageBillingCycle;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    now: Date;
  }) {
    if (params.price <= 0 || params.billingCycle === PackageBillingCycle.FREE) {
      return 0;
    }

    if (params.billingCycle === PackageBillingCycle.LIFETIME) {
      return this.roundMoney(params.price);
    }

    const totalPeriodMs = Math.max(
      params.currentPeriodEnd.getTime() - params.currentPeriodStart.getTime(),
      0,
    );

    if (totalPeriodMs === 0) {
      return 0;
    }

    const remainingPeriodMs = Math.max(
      params.currentPeriodEnd.getTime() - params.now.getTime(),
      0,
    );

    return this.roundMoney(params.price * (remainingPeriodMs / totalPeriodMs));
  }

  private roundMoney(amount: number) {
    return Math.round(amount * 100) / 100;
  }
}
