import Decimal from "decimal.js";
import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";

import {
  JsonValue,
  PackageBillingCycle,
  PackageLimitKey,
  PackagePlan,
  packagePlan,
  PackagePlanFeature,
  packagePlanFeature,
  PackagePlanLimit,
  packagePlanLimit,
  PackageResetCycle,
  PackageStatus,
  PackageSubscription,
  packageSubscription,
  PackageSubscriptionStatus,
  packageTenantCreditLedger,
  SystemUserType,
} from "@/database/schema";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";

import {
  DatabaseService,
  DatabaseTransaction,
} from "../../database/database.service";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

const ACTIVE_SUBSCRIPTION_STATUSES = [
  PackageSubscriptionStatus.TRIALING,
  PackageSubscriptionStatus.ACTIVE,
  PackageSubscriptionStatus.PAST_DUE,
] satisfies PackageSubscriptionStatus[];

const MIN_BILLABLE_AMOUNT = 0.01;

type PackageClient = DatabaseService["db"] | DatabaseTransaction;

export type PackagePlanWithDetails = PackagePlan & {
  limits: PackagePlanLimit[];
  features: PackagePlanFeature[];
};

export type PackageSubscriptionWithPlan = PackageSubscription & {
  package: PackagePlanWithDetails;
};

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
  usedCurrentPlanValue: number;
  unusedCurrentBalance: number;
  existingCreditBalance: number;
  creditApplied: number;
  amountDue: number;
  creditToAdd: number;
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
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

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
      await this.db
        .update(packageSubscription)
        .set({
          status: PackageSubscriptionStatus.EXPIRED,
          endedAt: now,
          endReason: "Subscription period expired",
        })
        .where(
          and(
            eq(packageSubscription.id, subscription.id),
            inArray(packageSubscription.status, ACTIVE_SUBSCRIPTION_STATUSES),
          ),
        );

      throw new ForbiddenException("Tenant subscription has expired");
    }

    return subscription;
  }

  async findCurrentSubscription(tenantId: string) {
    const [subscription] = await this.db
      .select()
      .from(packageSubscription)
      .where(
        and(
          eq(packageSubscription.tenantId, tenantId),
          inArray(packageSubscription.status, ACTIVE_SUBSCRIPTION_STATUSES),
        ),
      )
      .orderBy(desc(packageSubscription.currentPeriodEnd))
      .limit(1);

    return subscription
      ? this.withSubscriptionPlan(this.db, subscription)
      : null;
  }

  async assignDefaultTrial(tenantId: string, tx?: DatabaseTransaction) {
    const client = tx ?? this.db;
    const existingSubscription = await this.findCurrentSubscriptionRow(
      client,
      tenantId,
    );

    if (existingSubscription) {
      return existingSubscription;
    }

    const plan = await this.findDefaultActivePlan(client);

    if (!plan) {
      throw new InternalServerErrorException(
        "Unable to continue because no default package plan is configured.",
      );
    }

    const now = new Date();
    const trialEndsAt = this.addDays(now, plan.freeTrialDays);
    const [subscription] = await client
      .insert(packageSubscription)
      .values({
        tenantId,
        packageId: plan.id,
        planSnapshot: this.buildPlanSnapshot(plan, now) as JsonValue,
        status: PackageSubscriptionStatus.TRIALING,
        billingCycle: plan.billingCycle,
        price: plan.price,
        currencyCode: plan.currencyCode,
        startedAt: now,
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        autoRenew: false,
      })
      .returning();

    return subscription;
  }

  async replaceCurrentSubscription(
    tenantId: string,
    planId: string,
    tx?: DatabaseTransaction,
    planSnapshot?: PackagePlanSnapshot,
  ) {
    const client = tx ?? this.db;
    const plan = await this.findActivePlanById(client, planId);

    if (!plan) {
      throw new NotFoundException(
        "Package plan could not be found. It may not exist, may have been archived, or may not be available for the requested package operation.",
      );
    }

    const now = new Date();
    const snapshot = planSnapshot ?? this.buildPlanSnapshot(plan, now);
    const currentPeriodEnd = this.getPeriodEnd(now, snapshot.billingCycle);

    await client
      .update(packageSubscription)
      .set({
        status: PackageSubscriptionStatus.SUPERSEDED,
        endedAt: now,
        endReason: "Changed package plan",
      })
      .where(
        and(
          eq(packageSubscription.tenantId, tenantId),
          inArray(packageSubscription.status, ACTIVE_SUBSCRIPTION_STATUSES),
        ),
      );

    const [subscription] = await client
      .insert(packageSubscription)
      .values({
        tenantId,
        packageId: plan.id,
        planSnapshot: snapshot as JsonValue,
        status: PackageSubscriptionStatus.ACTIVE,
        billingCycle: snapshot.billingCycle,
        price: new Decimal(snapshot.price),
        currencyCode: snapshot.currencyCode,
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd,
        autoRenew: false,
      })
      .returning();

    return this.withSubscriptionPlan(client, subscription);
  }

  async calculatePlanChangeCharge(
    tenantId: string,
    targetPlanId: string,
    now = new Date(),
    tx?: DatabaseTransaction,
  ) {
    const client = tx ?? this.db;
    const existingCreditBalance = await this.getTenantCreditBalance(
      tenantId,
      tx,
    );
    const targetPlan = await this.findActivePlanById(client, targetPlanId);

    if (!targetPlan) {
      throw new NotFoundException(
        "Package plan could not be found. It may not exist, may have been archived, or may not be available for the requested package operation.",
      );
    }

    const currentSubscription = await this.findCurrentSubscriptionRow(
      client,
      tenantId,
    );

    if (!currentSubscription) {
      return {
        charge: {
          targetPlanId: targetPlan.id,
          targetPlanPrice: Number(targetPlan.price),
          usedCurrentPlanValue: 0,
          unusedCurrentBalance: 0,
          existingCreditBalance,
          creditApplied: this.normalizeMoney(
            Math.min(Number(targetPlan.price), existingCreditBalance),
          ),
          amountDue: this.normalizeBillableAmount(
            Number(targetPlan.price) - existingCreditBalance,
          ),
          creditToAdd: 0,
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

    const unusedCurrentBalance = this.calculateUnusedSubscriptionBalance({
      price: Number(currentSubscription.price),
      billingCycle: currentSubscription.billingCycle,
      currentPeriodStart: currentSubscription.currentPeriodStart,
      currentPeriodEnd: currentSubscription.currentPeriodEnd,
      now,
    });
    const usedCurrentPlanValue = this.roundMoney(
      Math.max(Number(currentSubscription.price) - unusedCurrentBalance, 0),
    );
    const rawDue = this.normalizeMoney(
      Number(targetPlan.price) - unusedCurrentBalance,
    );
    const creditApplied =
      rawDue > 0
        ? this.normalizeMoney(Math.min(rawDue, existingCreditBalance))
        : 0;
    const amountDue = this.normalizeBillableAmount(rawDue - creditApplied);
    const creditToAdd = this.normalizeMoney(
      Math.max(unusedCurrentBalance - Number(targetPlan.price), 0),
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
        usedCurrentPlanValue,
        unusedCurrentBalance,
        existingCreditBalance,
        creditApplied,
        amountDue,
        creditToAdd,
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

  async getTenantCreditBalance(tenantId: string, tx?: DatabaseTransaction) {
    const client = tx ?? this.db;
    const [aggregate] = await client
      .select({
        amount: sql<string>`coalesce(sum(${packageTenantCreditLedger.amount}), 0)`,
      })
      .from(packageTenantCreditLedger)
      .where(eq(packageTenantCreditLedger.tenantId, tenantId));

    return this.roundMoney(Number(aggregate?.amount ?? 0));
  }

  private findCurrentSubscriptionRow(client: PackageClient, tenantId: string) {
    return client
      .select()
      .from(packageSubscription)
      .where(
        and(
          eq(packageSubscription.tenantId, tenantId),
          inArray(packageSubscription.status, ACTIVE_SUBSCRIPTION_STATUSES),
        ),
      )
      .orderBy(desc(packageSubscription.currentPeriodEnd))
      .limit(1)
      .then(([subscription]) => subscription ?? null);
  }

  private async findDefaultActivePlan(client: PackageClient) {
    const [plan] = await client
      .select()
      .from(packagePlan)
      .where(
        and(
          eq(packagePlan.isDefault, true),
          eq(packagePlan.status, PackageStatus.ACTIVE),
          isNull(packagePlan.deletedAt),
        ),
      )
      .orderBy(asc(packagePlan.sortOrder))
      .limit(1);

    return plan ? this.withPlanDetails(client, plan) : null;
  }

  private async findActivePlanById(client: PackageClient, planId: string) {
    const [plan] = await client
      .select()
      .from(packagePlan)
      .where(
        and(
          eq(packagePlan.id, planId),
          eq(packagePlan.status, PackageStatus.ACTIVE),
          isNull(packagePlan.deletedAt),
        ),
      )
      .limit(1);

    return plan ? this.withPlanDetails(client, plan) : null;
  }

  private async withSubscriptionPlan(
    client: PackageClient,
    subscription: PackageSubscription,
  ): Promise<PackageSubscriptionWithPlan> {
    const [plan] = await client
      .select()
      .from(packagePlan)
      .where(eq(packagePlan.id, subscription.packageId))
      .limit(1);

    if (!plan) {
      throw new InternalServerErrorException(
        "Subscription package plan could not be loaded.",
      );
    }

    return {
      ...subscription,
      package: await this.withPlanDetails(client, plan),
    };
  }

  private async withPlanDetails(
    client: PackageClient,
    plan: PackagePlan,
  ): Promise<PackagePlanWithDetails> {
    const [limits, features] = await Promise.all([
      client
        .select()
        .from(packagePlanLimit)
        .where(eq(packagePlanLimit.packageId, plan.id)),
      client
        .select()
        .from(packagePlanFeature)
        .where(
          and(
            eq(packagePlanFeature.packageId, plan.id),
            eq(packagePlanFeature.isActive, true),
          ),
        )
        .orderBy(asc(packagePlanFeature.sortOrder)),
    ]);

    return {
      ...plan,
      limits,
      features,
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
    plan: PackagePlanWithDetails,
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

  private normalizeMoney(amount: number) {
    return this.roundMoney(Math.max(amount, 0));
  }

  private normalizeBillableAmount(amount: number) {
    const normalizedAmount = this.normalizeMoney(amount);

    return normalizedAmount <= MIN_BILLABLE_AMOUNT ? 0 : normalizedAmount;
  }
}
