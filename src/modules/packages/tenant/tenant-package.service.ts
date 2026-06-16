import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type JsonValue,
  type PackagePlan,
  type PackagePlanFeature,
  type PackagePlanLimit,
  PackageCreditEntryType,
  PackagePaymentStatus,
  PackagePaymentType,
  PackageStatus,
  PackagePayment,
  packagePlan,
  packagePlanFeature,
  packagePlanLimit,
  packageSubscription,
  packageTenantCreditLedger,
  packagePayment,
} from "@/database/schema";
import Decimal from "decimal.js";
import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

import { QueryPackageDto } from "../dto/query-package.dto";
import {
  type DatabaseTransaction,
  DatabaseService,
} from "../../../database/database.service";
import { PackageLimitService } from "../package-limit.service";
import { PackageSubscriptionService } from "../package-subscription.service";
import type {
  PackagePlanSnapshot,
  PlanChangeCharge,
} from "../package-subscription.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";

const MOCK_PAYMENT_EXPIRY_MINUTES = 15;

type PackagePlanWithDetails = PackagePlan & {
  limits: PackagePlanLimit[];
  features: PackagePlanFeature[];
};

type PaymentWithPlan = PackagePayment & {
  plan: PackagePlanWithDetails | null;
};

@Injectable()
export class TenantPackageService {
  constructor(
    private readonly database: DatabaseService,
    private readonly limits: PackageLimitService,
    private readonly subscriptions: PackageSubscriptionService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async findAvailablePlans(query: QueryPackageDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      isNull(packagePlan.deletedAt),
      eq(packagePlan.status, PackageStatus.ACTIVE),
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
        .orderBy(asc(packagePlan.sortOrder), desc(packagePlan.createdAt))
        .limit(limit)
        .offset(skip)
        .then((rows) => this.withPlansDetails(rows)),
      this.db
        .select({ value: count() })
        .from(packagePlan)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(plans, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async getCurrentSubscription(tenantId: string) {
    const subscription =
      await this.subscriptions.findCurrentSubscription(tenantId);

    if (!subscription) {
      throw new NotFoundException("Current subscription not found");
    }

    return apiResponse(subscription);
  }

  async getSubscriptionHistory(tenantId: string, query: QueryPackageDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      this.db
        .select()
        .from(packageSubscription)
        .where(eq(packageSubscription.tenantId, tenantId))
        .orderBy(desc(packageSubscription.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(packageSubscription)
        .where(eq(packageSubscription.tenantId, tenantId))
        .then(([row]) => row?.value ?? 0),
    ]);

    const items = await Promise.all(
      subscriptions.map(async (subscription) => ({
        ...subscription,
        package: await this.getPlanWithDetails(subscription.packageId),
      })),
    );

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async getUsage(tenantId: string) {
    const usage = await this.limits.getUsageSummary(tenantId);

    return apiResponse(usage);
  }

  async checkoutPlan(tenantId: string, planId: string) {
    const { charge, targetPlan, targetPlanSnapshot } =
      await this.subscriptions.calculatePlanChangeCharge(tenantId, planId);

    await this.limits.assertUsageFitsLimits(
      tenantId,
      targetPlanSnapshot.limits,
    );

    const [payment] = await this.db
      .insert(packagePayment)
      .values({
        tenantId,
        planId: targetPlan.id,
        type:
          charge.amountDue === 0
            ? PackagePaymentType.CREDIT_ONLY_PLAN_CHANGE
            : PackagePaymentType.PLAN_CHANGE,
        status: PackagePaymentStatus.PENDING,
        amount: new Decimal(charge.amountDue),
        currencyCode: charge.currencyCode,
        metadata: {
          calculation: "target_plan_price_minus_current_unused_balance",
          charge,
          targetPlanSnapshot,
        } as JsonValue,
        expiresAt: this.getPaymentExpiry(),
      })
      .returning();

    return apiResponse(
      await this.withPaymentPlan(payment),
      "Package checkout created successfully",
    );
  }

  async confirmMockPayment(tenantId: string, paymentId: string) {
    const [payment] = await this.db
      .select()
      .from(packagePayment)
      .where(
        and(
          eq(packagePayment.id, paymentId),
          eq(packagePayment.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!payment) {
      throw new NotFoundException("Package mock payment not found");
    }

    if (payment.status !== PackagePaymentStatus.PENDING) {
      throw new ForbiddenException("Package mock payment is not pending");
    }

    if (payment.expiresAt <= new Date()) {
      await this.db
        .update(packagePayment)
        .set({ status: PackagePaymentStatus.EXPIRED })
        .where(eq(packagePayment.id, payment.id));

      throw new ForbiddenException("Package mock payment has expired");
    }

    const result = await this.db.transaction(async (tx) => {
      if (!payment.planId) {
        throw new ForbiddenException("Payment plan is missing");
      }

      const targetPlanSnapshot = this.getPlanSnapshotFromPayment(
        payment.metadata,
      );

      if (targetPlanSnapshot) {
        await this.limits.assertUsageFitsLimits(
          tenantId,
          targetPlanSnapshot.limits,
        );
      }

      const charge = this.getChargeFromPayment(payment.metadata);
      const subscription = await this.subscriptions.replaceCurrentSubscription(
        tenantId,
        payment.planId,
        tx,
        targetPlanSnapshot,
      );

      const [confirmedPayment] = await tx
        .update(packagePayment)
        .set({
          subscriptionId: subscription.id,
          status: PackagePaymentStatus.CONFIRMED,
          confirmedAt: new Date(),
        })
        .where(eq(packagePayment.id, payment.id))
        .returning();

      if (charge) {
        await this.recordPlanChangeCredits(tx, {
          tenantId,
          subscriptionId: subscription.id,
          paymentId: payment.id,
          charge,
        });
      }

      return {
        payment: confirmedPayment,
        subscription,
      };
    });

    return apiResponse(result, "Package mock payment confirmed successfully");
  }

  private getPlanSnapshotFromPayment(
    metadata: JsonValue | null,
  ): PackagePlanSnapshot | undefined {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return undefined;
    }

    const snapshot = metadata.targetPlanSnapshot;

    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return undefined;
    }

    return snapshot as PackagePlanSnapshot;
  }

  private getChargeFromPayment(
    metadata: JsonValue | null,
  ): PlanChangeCharge | undefined {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return undefined;
    }

    const charge = metadata.charge;

    if (!charge || typeof charge !== "object" || Array.isArray(charge)) {
      return undefined;
    }

    return charge as PlanChangeCharge;
  }

  private async recordPlanChangeCredits(
    tx: DatabaseTransaction,
    params: {
      tenantId: string;
      subscriptionId: string;
      paymentId: string;
      charge: PlanChangeCharge;
    },
  ) {
    if (params.charge.creditApplied > 0) {
      await tx.insert(packageTenantCreditLedger).values({
        tenantId: params.tenantId,
        subscriptionId: params.subscriptionId,
        paymentId: params.paymentId,
        type: PackageCreditEntryType.CREDIT_APPLIED,
        amount: new Decimal(params.charge.creditApplied).negated(),
        currencyCode: params.charge.currencyCode,
        note: "Credit applied to package plan change",
        metadata: { charge: params.charge } as JsonValue,
      });
    }

    if (params.charge.creditToAdd > 0) {
      await tx.insert(packageTenantCreditLedger).values({
        tenantId: params.tenantId,
        subscriptionId: params.subscriptionId,
        paymentId: params.paymentId,
        type: PackageCreditEntryType.DOWNGRADE_CREDIT,
        amount: new Decimal(params.charge.creditToAdd),
        currencyCode: params.charge.currencyCode,
        note: "Unused package balance carried as tenant credit",
        metadata: { charge: params.charge } as JsonValue,
      });
    }
  }

  private async withPlansDetails(plans: PackagePlan[]) {
    return Promise.all(plans.map((plan) => this.withPlanDetails(plan)));
  }

  private async getPlanWithDetails(planId: string) {
    const [plan] = await this.db
      .select()
      .from(packagePlan)
      .where(eq(packagePlan.id, planId))
      .limit(1);

    if (!plan) {
      throw new NotFoundException("Package plan not found");
    }

    return this.withPlanDetails(plan);
  }

  private async withPlanDetails(
    plan: PackagePlan,
  ): Promise<PackagePlanWithDetails> {
    const [limits, features] = await Promise.all([
      this.db
        .select()
        .from(packagePlanLimit)
        .where(eq(packagePlanLimit.packageId, plan.id)),
      this.db
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

  private async withPaymentPlan(
    payment: PackagePayment,
  ): Promise<PaymentWithPlan> {
    return {
      ...payment,
      plan: payment.planId
        ? await this.getPlanWithDetails(payment.planId)
        : null,
    };
  }

  private getPaymentExpiry() {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + MOCK_PAYMENT_EXPIRY_MINUTES);
    return expiresAt;
  }
}
