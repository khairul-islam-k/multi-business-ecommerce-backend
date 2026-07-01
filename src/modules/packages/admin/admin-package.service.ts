import Decimal from "decimal.js";
import { and, count, desc, eq, ilike, isNull, lte, ne, or } from "drizzle-orm";

import {
  PackagePayment,
  packagePayment,
  PackagePaymentStatus,
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
  PackageUsageCounter,
  packageUsageCounter,
  systemUser,
} from "@/database/schema";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { isUniqueConstraintError } from "../../../common/database/db-error.util";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import {
  DatabaseService,
  DatabaseTransaction,
} from "../../../database/database.service";
import { QueryPackageDto } from "../dto/query-package.dto";
import { PackageSubscriptionService } from "../package-subscription.service";
import {
  CreatePackagePlanDto,
  UpdatePackagePlanDto,
} from "./dto/package-plan.dto";
import {
  CancelPackageSubscriptionDto,
  ChangeTenantSubscriptionPlanDto,
  CreateTenantSubscriptionDto,
  QueryPackageSubscriptionDto,
} from "./dto/package-subscription.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

type PackagePlanWithAdminDetails = PackagePlan & {
  limits: PackagePlanLimit[];
  features: PackagePlanFeature[];
  _count: {
    subscriptions: number;
  };
};

type SubscriptionTenant = {
  id: string;
  name: string;
  email: string;
  status: string;
};

type SubscriptionWithDetails = PackageSubscription & {
  tenant: SubscriptionTenant | null;
  package: PackagePlanWithAdminDetails;
};

type SubscriptionWithFullDetails = SubscriptionWithDetails & {
  usageCounters: PackageUsageCounter[];
  mockPayments: PackagePayment[];
};

@Injectable()
export class AdminPackageService {
  constructor(
    private readonly database: DatabaseService,
    private readonly subscriptions: PackageSubscriptionService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async createPlan(dto: CreatePackagePlanDto) {
    try {
      const plan = await this.db.transaction(async (tx) => {
        if (dto.isDefault) {
          await this.clearDefaultPlan(tx);
        }

        const [created] = await tx
          .insert(packagePlan)
          .values({
            name: dto.name.trim(),
            description: dto.description?.trim() || null,
            price: new Decimal(dto.price),
            billingCycle: dto.billingCycle,
            currencyCode: this.normalizeCurrency(dto.currencyCode),
            freeTrialDays: dto.freeTrialDays ?? 0,
            isDefault: dto.isDefault ?? false,
            status: dto.status ?? PackageStatus.ACTIVE,
          })
          .returning();

        await this.insertPlanChildren(tx, created.id, dto);

        return this.withPlanDetails(created);
      });

      return apiResponse(plan, "Package plan created successfully");
    } catch (error) {
      this.handleUniqueError(error, "Package plan name already exists");
    }
  }

  async findPlans(query: QueryPackageDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      isNull(packagePlan.deletedAt),
      query.status ? eq(packagePlan.status, query.status) : undefined,
      query.search
        ? or(
            ilike(packagePlan.name, `%${query.search}%`),
            ilike(packagePlan.description, `%${query.search}%`),
          )
        : undefined,
    );

    const [plans, total] = await Promise.all([
      this.db
        .select()
        .from(packagePlan)
        .where(where)
        .orderBy(desc(packagePlan.createdAt))
        .limit(limit)
        .offset(skip)
        .then((rows) => this.withPlansDetails(rows)),
      this.db
        .select({ value: count() })
        .from(packagePlan)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      plans,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Package plans were loaded successfully. The response includes the requested page of package plans and pagination metadata for browsing more results.",
    );
  }

  async findPlan(planId: string) {
    const plan = await this.findPlanRow(planId);

    if (!plan) {
      throw new NotFoundException(
        "Package plan could not be found. It may not exist, may have been archived, or may not be available for the requested package operation.",
      );
    }

    return apiResponse(await this.withPlanDetails(plan));
  }

  async updatePlan(planId: string, dto: UpdatePackagePlanDto) {
    await this.assertPlanExists(planId);

    try {
      const plan = await this.db.transaction(async (tx) => {
        if (dto.isDefault) {
          await this.clearDefaultPlan(tx, planId);
        }

        if (dto.limits !== undefined) {
          await tx
            .delete(packagePlanLimit)
            .where(eq(packagePlanLimit.packageId, planId));
        }

        if (dto.features !== undefined) {
          await tx
            .delete(packagePlanFeature)
            .where(eq(packagePlanFeature.packageId, planId));
        }

        const [updated] = await tx
          .update(packagePlan)
          .set({
            ...(dto.name !== undefined && { name: dto.name.trim() }),
            ...(dto.description !== undefined && {
              description: dto.description?.trim() || null,
            }),
            ...(dto.price !== undefined && { price: new Decimal(dto.price) }),
            ...(dto.billingCycle !== undefined && {
              billingCycle: dto.billingCycle,
            }),
            ...(dto.currencyCode !== undefined && {
              currencyCode: this.normalizeCurrency(dto.currencyCode),
            }),
            ...(dto.freeTrialDays !== undefined && {
              freeTrialDays: dto.freeTrialDays,
            }),
            ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
            ...(dto.status !== undefined && { status: dto.status }),
          })
          .where(eq(packagePlan.id, planId))
          .returning();

        await this.insertPlanChildren(tx, planId, dto);

        return this.withPlanDetails(updated);
      });

      return apiResponse(plan, "Package plan updated successfully");
    } catch (error) {
      this.handleUniqueError(error, "Package plan name already exists");
    }
  }

  async deletePlan(currentUser: CurrentUserPayload, planId: string) {
    await this.assertPlanExists(planId);

    await this.db
      .update(packagePlan)
      .set({
        status: PackageStatus.ARCHIVED,
        isDefault: false,
        deletedAt: new Date(),
        deletedBy: currentUser.id,
      })
      .where(eq(packagePlan.id, planId));

    return apiResponse(null, "Package plan deleted successfully");
  }

  async createTenantSubscription(dto: CreateTenantSubscriptionDto) {
    const subscription = await this.subscriptions.replaceCurrentSubscription(
      dto.tenantId,
      dto.planId,
    );

    return apiResponse(
      subscription,
      "Tenant subscription created successfully",
    );
  }

  async findSubscriptions(query: QueryPackageSubscriptionDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      query.status ? eq(packageSubscription.status, query.status) : undefined,
      query.tenantId
        ? eq(packageSubscription.tenantId, query.tenantId)
        : undefined,
    );

    const [subscriptions, total] = await Promise.all([
      this.db
        .select()
        .from(packageSubscription)
        .where(where)
        .orderBy(desc(packageSubscription.createdAt))
        .limit(limit)
        .offset(skip)
        .then((rows) => this.withSubscriptionsDetails(rows)),
      this.db
        .select({ value: count() })
        .from(packageSubscription)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      subscriptions,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Package subscriptions were loaded successfully. The response includes the requested page of tenant subscriptions and pagination metadata for browsing more results.",
    );
  }

  async findSubscription(subscriptionId: string) {
    const [subscription] = await this.db
      .select()
      .from(packageSubscription)
      .where(eq(packageSubscription.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      throw new NotFoundException(
        "Subscription could not be found. It may not exist, may have been cancelled, or may not belong to the requested tenant.",
      );
    }

    return apiResponse(await this.withSubscriptionFullDetails(subscription));
  }

  async changeTenantSubscriptionPlan(
    subscriptionId: string,
    dto: ChangeTenantSubscriptionPlanDto,
  ) {
    const [subscription] = await this.db
      .select({ tenantId: packageSubscription.tenantId })
      .from(packageSubscription)
      .where(eq(packageSubscription.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      throw new NotFoundException(
        "Subscription could not be found. It may not exist, may have been cancelled, or may not belong to the requested tenant.",
      );
    }

    const updatedSubscription =
      await this.subscriptions.replaceCurrentSubscription(
        subscription.tenantId,
        dto.planId,
      );

    return apiResponse(
      updatedSubscription,
      "Subscription plan changed successfully",
    );
  }

  async cancelSubscription(
    subscriptionId: string,
    dto: CancelPackageSubscriptionDto,
  ) {
    const [subscription] = await this.db
      .select()
      .from(packageSubscription)
      .where(eq(packageSubscription.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      throw new NotFoundException(
        "Subscription could not be found. It may not exist, may have been cancelled, or may not belong to the requested tenant.",
      );
    }

    const [updatedSubscription] = await this.db
      .update(packageSubscription)
      .set({
        status: PackageSubscriptionStatus.CANCELLED,
        endedAt: new Date(),
        endReason: dto.reason?.trim() || "Cancelled by admin",
      })
      .where(eq(packageSubscription.id, subscriptionId))
      .returning();

    return apiResponse(
      updatedSubscription,
      "Subscription cancelled successfully",
    );
  }

  async expirePendingMockPayments() {
    const expired = await this.db
      .update(packagePayment)
      .set({ status: PackagePaymentStatus.EXPIRED })
      .where(
        and(
          eq(packagePayment.status, PackagePaymentStatus.PENDING),
          lte(packagePayment.expiresAt, new Date()),
        ),
      )
      .returning({ id: packagePayment.id });

    return apiResponse(
      { count: expired.length },
      "Expired pending package mock payments",
    );
  }

  private async assertPlanExists(planId: string) {
    const plan = await this.findPlanRow(planId);

    if (!plan) {
      throw new NotFoundException(
        "Package plan could not be found. It may not exist, may have been archived, or may not be available for the requested package operation.",
      );
    }
  }

  private findPlanRow(planId: string) {
    return this.db
      .select()
      .from(packagePlan)
      .where(and(eq(packagePlan.id, planId), isNull(packagePlan.deletedAt)))
      .limit(1)
      .then(([plan]) => plan ?? null);
  }

  private clearDefaultPlan(tx: DatabaseTransaction, exceptPlanId?: string) {
    return tx
      .update(packagePlan)
      .set({ isDefault: false })
      .where(
        and(
          eq(packagePlan.isDefault, true),
          exceptPlanId ? ne(packagePlan.id, exceptPlanId) : undefined,
        ),
      );
  }

  private async insertPlanChildren(
    tx: DatabaseTransaction,
    planId: string,
    dto: Pick<CreatePackagePlanDto, "limits" | "features">,
  ) {
    if (dto.limits?.length) {
      await tx.insert(packagePlanLimit).values(
        dto.limits.map((limit) => ({
          packageId: planId,
          limitKey: limit.limitKey,
          limitValue: limit.limitValue,
          resetCycle: limit.resetCycle ?? PackageResetCycle.LIFETIME,
          description: limit.description?.trim() || null,
        })),
      );
    }

    if (dto.features?.length) {
      await tx.insert(packagePlanFeature).values(
        dto.features.map((feature) => ({
          packageId: planId,
          title: feature.title.trim(),
          description: feature.description?.trim() || null,
          isActive: feature.isActive ?? true,
        })),
      );
    }
  }

  private async withPlansDetails(plans: PackagePlan[]) {
    return Promise.all(plans.map((plan) => this.withPlanDetails(plan)));
  }

  private async withPlanDetails(
    plan: PackagePlan,
  ): Promise<PackagePlanWithAdminDetails> {
    const [limits, features, subscriptionCount] = await Promise.all([
      this.db
        .select()
        .from(packagePlanLimit)
        .where(eq(packagePlanLimit.packageId, plan.id)),
      this.db
        .select()
        .from(packagePlanFeature)
        .where(eq(packagePlanFeature.packageId, plan.id)),
      this.db
        .select({ value: count() })
        .from(packageSubscription)
        .where(eq(packageSubscription.packageId, plan.id))
        .then(([row]) => row?.value ?? 0),
    ]);

    return {
      ...plan,
      limits,
      features,
      _count: {
        subscriptions: subscriptionCount,
      },
    };
  }

  private async withSubscriptionsDetails(
    subscriptions: PackageSubscription[],
  ): Promise<SubscriptionWithDetails[]> {
    return Promise.all(
      subscriptions.map((subscription) =>
        this.withSubscriptionDetails(subscription),
      ),
    );
  }

  private async withSubscriptionDetails(
    subscription: PackageSubscription,
  ): Promise<SubscriptionWithDetails> {
    const [tenant, plan] = await Promise.all([
      this.findTenant(subscription.tenantId),
      this.findPackagePlanOrThrow(subscription.packageId),
    ]);

    return {
      ...subscription,
      tenant,
      package: await this.withPlanDetails(plan),
    };
  }

  private async withSubscriptionFullDetails(
    subscription: PackageSubscription,
  ): Promise<SubscriptionWithFullDetails> {
    const [details, usageCounters, mockPayments] = await Promise.all([
      this.withSubscriptionDetails(subscription),
      this.db
        .select()
        .from(packageUsageCounter)
        .where(eq(packageUsageCounter.subscriptionId, subscription.id)),
      this.db
        .select()
        .from(packagePayment)
        .where(eq(packagePayment.subscriptionId, subscription.id))
        .orderBy(desc(packagePayment.createdAt)),
    ]);

    return {
      ...details,
      usageCounters,
      mockPayments,
    };
  }

  private findTenant(tenantId: string) {
    return this.db
      .select({
        id: systemUser.id,
        name: systemUser.name,
        email: systemUser.email,
        status: systemUser.status,
      })
      .from(systemUser)
      .where(eq(systemUser.id, tenantId))
      .limit(1)
      .then(([tenant]) => tenant ?? null);
  }

  private async findPackagePlanOrThrow(planId: string) {
    const [plan] = await this.db
      .select()
      .from(packagePlan)
      .where(eq(packagePlan.id, planId))
      .limit(1);

    if (!plan) {
      throw new NotFoundException(
        "Package plan could not be found. It may not exist, may have been archived, or may not be available for the requested package operation.",
      );
    }

    return plan;
  }

  private normalizeCurrency(currencyCode?: string) {
    return currencyCode?.trim().toUpperCase() || "BDT";
  }

  private handleUniqueError(error: unknown, message: string): never {
    if (isUniqueConstraintError(error)) {
      throw new ConflictException(message);
    }

    throw error;
  }
}
