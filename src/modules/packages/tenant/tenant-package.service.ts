import { randomBytes } from "crypto";
import Decimal from "decimal.js";
import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

import {
  JsonValue,
  PackageCreditEntryType,
  PackagePayment,
  packagePayment,
  packagePaymentGatewayConfig,
  PackagePaymentStatus,
  PackagePaymentType,
  packagePaymentWebhookEvent,
  PackagePlan,
  packagePlan,
  PackagePlanFeature,
  packagePlanFeature,
  PackagePlanLimit,
  packagePlanLimit,
  PackageStatus,
  packageSubscription,
  packageTenantCreditLedger,
  PaymentGateway,
  paymentGateway,
  PaymentGatewayConfigStatus,
  PaymentGatewayProvider,
  PaymentGatewayStatus,
  PaymentWebhookStatus,
  systemUser,
} from "@/database/schema";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { AppConfigService } from "../../../common/config/app-config.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import {
  DatabaseService,
  DatabaseTransaction,
} from "../../../database/database.service";
import { PaymentConfigEncryptionService } from "../../payment-gateways/payment-config-encryption.service";
import { PaymentGatewayProviderService } from "../../payment-gateways/payment-gateway-provider.service";
import { QueryPackageDto } from "../dto/query-package.dto";
import { PackageLimitService } from "../package-limit.service";
import { PackageSubscriptionService } from "../package-subscription.service";
import { CheckoutPackagePlanDto } from "./dto/tenant-package.dto";

import type {
  PackagePlanSnapshot,
  PlanChangeCharge,
} from "../package-subscription.service";

const PACKAGE_PAYMENT_EXPIRY_MINUTES = 15;

type PackagePlanWithDetails = PackagePlan & {
  limits: PackagePlanLimit[];
  features: PackagePlanFeature[];
};

type PaymentWithPlan = PackagePayment & {
  plan: PackagePlanWithDetails | null;
};

type PackagePaymentConfigWithGateway = {
  config: typeof packagePaymentGatewayConfig.$inferSelect;
  gateway: PaymentGateway;
};

type PackagePaymentRedirects = {
  successRedirectUrl: string | null;
  failRedirectUrl: string | null;
  cancelRedirectUrl: string | null;
};

@Injectable()
export class TenantPackageService {
  constructor(
    private readonly database: DatabaseService,
    private readonly appConfig: AppConfigService,
    private readonly limits: PackageLimitService,
    private readonly subscriptions: PackageSubscriptionService,
    private readonly encryption: PaymentConfigEncryptionService,
    private readonly providers: PaymentGatewayProviderService,
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
      "Available package plans were loaded successfully. The response includes the requested page of active plans and pagination metadata for browsing more results.",
    );
  }

  async getCurrentSubscription(tenantId: string) {
    const subscription =
      await this.subscriptions.findCurrentSubscription(tenantId);

    if (!subscription) {
      throw new NotFoundException(
        "Current subscription could not be found for this tenant. Make sure the tenant has an active package subscription before retrying.",
      );
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

    return paginatedResponse(
      items,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Package payments were loaded successfully. The response includes the requested page of tenant package payments and pagination metadata for browsing more results.",
    );
  }

  async getUsage(tenantId: string) {
    const usage = await this.limits.getUsageSummary(tenantId);

    return apiResponse(usage);
  }

  async checkoutPlan(
    tenantId: string,
    planId: string,
    dto: CheckoutPackagePlanDto = {},
  ) {
    const { charge, targetPlan, targetPlanSnapshot } =
      await this.subscriptions.calculatePlanChangeCharge(tenantId, planId);

    await this.limits.assertUsageFitsLimits(
      tenantId,
      targetPlanSnapshot.limits,
    );

    console.log(dto);
    const paymentNo = await this.generatePackagePaymentNo();
    const isGatewayPayment = charge.amountDue > 0;
    const gatewayConfig = isGatewayPayment
      ? await this.getActivePackagePaymentConfigOrThrow()
      : null;
    const requestedRedirects = this.buildRequestedRedirects(dto);

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
        paymentNo,
        amount: new Decimal(charge.amountDue),
        currencyCode: charge.currencyCode,
        gatewayConfigId: gatewayConfig?.config.id ?? null,
        gatewayPayload: {
          requestedRedirects,
        } as JsonValue,
        metadata: {
          calculation: "target_plan_price_minus_current_unused_balance",
          charge,
          targetPlanSnapshot,
        } as JsonValue,
        expiresAt: this.getPaymentExpiry(),
      })
      .returning();
    const callbacks = gatewayConfig
      ? this.buildCallbackUrls(gatewayConfig.gateway.code, payment.id)
      : null;

    if (!isGatewayPayment || !gatewayConfig || !callbacks) {
      return apiResponse(
        {
          ...(await this.withPaymentPlan(payment)),
          redirectUrl: null,
          gatewaySessionId: null,
          gatewayTransactionId: null,
        },
        "Package checkout created successfully",
      );
    }

    const customer = await this.getTenantPaymentCustomer(tenantId);
    let initiated: Awaited<
      ReturnType<PaymentGatewayProviderService["initiate"]>
    >;

    try {
      initiated = await this.providers.initiate({
        provider: gatewayConfig.gateway.code,
        mode: gatewayConfig.config.mode,
        config: this.encryption.decrypt(gatewayConfig.config.configData),
        paymentNo,
        amount: payment.amount,
        currency: payment.currencyCode,
        orderNo: `${targetPlan.name} package`,
        customer,
        callbackUrls: callbacks,
      });
    } catch (error) {
      await this.db
        .update(packagePayment)
        .set({
          status: PackagePaymentStatus.FAILED,
          failedAt: new Date(),
          failureReason:
            error instanceof Error
              ? error.message
              : "Payment gateway initiation failed",
        })
        .where(eq(packagePayment.id, payment.id));

      throw error;
    }

    const [updatedPayment] = await this.db
      .update(packagePayment)
      .set({
        gatewaySessionId: initiated.sessionId ?? null,
        gatewayTransactionId: initiated.transactionId ?? null,
        gatewayPayload: {
          requestedCallbacks: callbacks,
          requestedRedirects,
          initiation: initiated.rawResponse,
        } as JsonValue,
      })
      .where(eq(packagePayment.id, payment.id))
      .returning();

    return apiResponse(
      {
        ...(await this.withPaymentPlan(updatedPayment)),
        redirectUrl: initiated.redirectUrl,
        gatewaySessionId: updatedPayment.gatewaySessionId,
        gatewayTransactionId: updatedPayment.gatewayTransactionId,
      },
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
      throw new NotFoundException("Package payment not found");
    }

    if (payment.status === PackagePaymentStatus.CONFIRMED) {
      return apiResponse(
        await this.getConfirmedPaymentResult(payment),
        "Package payment was already confirmed successfully",
      );
    }

    if (payment.status !== PackagePaymentStatus.PENDING) {
      throw new ForbiddenException("Package payment is not pending");
    }

    if (payment.expiresAt <= new Date()) {
      await this.db
        .update(packagePayment)
        .set({ status: PackagePaymentStatus.EXPIRED })
        .where(eq(packagePayment.id, payment.id));

      throw new ForbiddenException("Package payment has expired");
    }

    if (new Decimal(payment.amount).greaterThan(0)) {
      throw new BadRequestException(
        "This package payment requires gateway confirmation. Complete the gateway payment first.",
      );
    }

    const result = await this.db.transaction((tx) =>
      this.confirmPendingPackagePayment(tx, payment),
    );

    return apiResponse(result, "Package payment confirmed successfully");
  }

  async handleGatewayCallback(
    provider: PaymentGatewayProvider,
    paymentId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const payment = await this.getPackageGatewayPaymentOrThrow(
      provider,
      paymentId,
    );

    if (payment.status === PackagePaymentStatus.CONFIRMED) {
      const result = await this.getConfirmedPaymentResult(payment);

      return apiResponse(
        {
          ...result,
          redirectUrl: this.getCallbackRedirectUrl(payment, eventType, "PAID"),
        },
        "Package payment already processed",
      );
    }

    if (!payment.paymentNo) {
      throw new BadRequestException("Package payment number is missing");
    }

    const config = await this.getPackagePaymentConfigWithGatewayOrThrow(
      provider,
      payment.gatewayConfigId ?? "",
    );
    const [event] = await this.db
      .insert(packagePaymentWebhookEvent)
      .values({
        gatewayId: config.gateway.id,
        packagePaymentId: payment.id,
        eventType,
        eventId: this.extractEventId(provider, payload),
        payload: payload as JsonValue,
        status: PaymentWebhookStatus.PENDING,
      })
      .returning();
    const verification = await this.providers.verify({
      provider,
      mode: config.config.mode,
      config: this.encryption.decrypt(config.config.configData),
      paymentNo: payment.paymentNo,
      amount: payment.amount,
      payload,
    });

    const result = await this.db.transaction(async (tx) => {
      if (verification.status === "PAID") {
        const confirmed = await this.confirmPendingPackagePayment(
          tx,
          payment,
          verification,
        );

        await this.markPackageWebhookEvent(
          tx,
          event.id,
          PaymentWebhookStatus.PROCESSED,
        );

        return {
          ...confirmed,
          redirectUrl: this.getCallbackRedirectUrl(
            confirmed.payment,
            eventType,
            "PAID",
          ),
        };
      }

      if (verification.status === "FAILED") {
        const [updatedPayment] = await tx
          .update(packagePayment)
          .set({
            status: PackagePaymentStatus.FAILED,
            gatewayEventId: verification.eventId ?? event.id,
            gatewayPayload: this.mergeGatewayPayload(payment, {
              verification: verification.rawResponse,
            }),
            failedAt: new Date(),
            failureReason: `Gateway callback ${eventType} failed verification`,
          })
          .where(
            and(
              eq(packagePayment.id, payment.id),
              eq(packagePayment.status, PackagePaymentStatus.PENDING),
            ),
          )
          .returning();

        await this.markPackageWebhookEvent(
          tx,
          event.id,
          PaymentWebhookStatus.PROCESSED,
        );

        if (updatedPayment) {
          return {
            payment: updatedPayment,
            subscription: null,
            redirectUrl: this.getCallbackRedirectUrl(
              updatedPayment,
              eventType,
              "FAILED",
            ),
          };
        }

        const [existingPayment] = await tx
          .select()
          .from(packagePayment)
          .where(eq(packagePayment.id, payment.id))
          .limit(1);

        if (existingPayment?.status === PackagePaymentStatus.CONFIRMED) {
          const confirmed =
            await this.getConfirmedPaymentResult(existingPayment);

          return {
            ...confirmed,
            redirectUrl: this.getCallbackRedirectUrl(
              existingPayment,
              eventType,
              "PAID",
            ),
          };
        }

        return {
          payment: existingPayment ?? payment,
          subscription: null,
          redirectUrl: this.getCallbackRedirectUrl(
            existingPayment ?? payment,
            eventType,
            "FAILED",
          ),
        };
      }

      await this.markPackageWebhookEvent(
        tx,
        event.id,
        PaymentWebhookStatus.IGNORED,
      );

      return {
        payment,
        subscription: null,
        redirectUrl: null,
      };
    });

    return apiResponse(result, "Package payment callback processed");
  }

  private async confirmPendingPackagePayment(
    tx: DatabaseTransaction,
    payment: PackagePayment,
    verification?: Awaited<ReturnType<PaymentGatewayProviderService["verify"]>>,
  ) {
    const [claimedPayment] = await tx
      .update(packagePayment)
      .set({
        gatewayTransactionId:
          verification?.transactionId ?? payment.gatewayTransactionId,
        gatewayEventId: verification?.eventId ?? payment.gatewayEventId,
        gatewayPayload: verification
          ? this.mergeGatewayPayload(payment, {
              verification: verification.rawResponse,
            })
          : payment.gatewayPayload,
        failedAt: null,
        failureReason: null,
      })
      .where(
        and(
          eq(packagePayment.id, payment.id),
          eq(packagePayment.status, PackagePaymentStatus.PENDING),
        ),
      )
      .returning();

    if (!claimedPayment) {
      const [existingPayment] = await tx
        .select()
        .from(packagePayment)
        .where(eq(packagePayment.id, payment.id))
        .limit(1);

      if (existingPayment?.status === PackagePaymentStatus.CONFIRMED) {
        return this.getConfirmedPaymentResult(existingPayment);
      }

      throw new ForbiddenException("Package payment is not pending");
    }

    if (!claimedPayment.planId) {
      throw new ForbiddenException("Payment plan is missing");
    }

    const targetPlanSnapshot = this.getPlanSnapshotFromPayment(
      claimedPayment.metadata,
    );

    if (targetPlanSnapshot) {
      await this.limits.assertUsageFitsLimits(
        claimedPayment.tenantId,
        targetPlanSnapshot.limits,
      );
    }

    const charge = this.getChargeFromPayment(claimedPayment.metadata);
    const subscription = await this.subscriptions.replaceCurrentSubscription(
      claimedPayment.tenantId,
      claimedPayment.planId,
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
      .where(eq(packagePayment.id, claimedPayment.id))
      .returning();

    if (charge) {
      await this.recordPlanChangeCredits(tx, {
        tenantId: claimedPayment.tenantId,
        subscriptionId: subscription.id,
        paymentId: claimedPayment.id,
        charge,
      });
    }

    return {
      payment: confirmedPayment,
      subscription,
    };
  }

  private markPackageWebhookEvent(
    tx: DatabaseTransaction,
    eventId: string,
    status: PaymentWebhookStatus,
  ) {
    return tx
      .update(packagePaymentWebhookEvent)
      .set({
        status,
        processedAt: new Date(),
      })
      .where(eq(packagePaymentWebhookEvent.id, eventId));
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
      throw new NotFoundException(
        "Package plan could not be found. It may not exist, may have been archived, or may not be available for the requested package operation.",
      );
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
        ),
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

  private async getConfirmedPaymentResult(payment: PackagePayment) {
    const subscription = payment.subscriptionId
      ? await this.getSubscriptionWithPlan(payment.subscriptionId)
      : await this.subscriptions.findCurrentSubscription(payment.tenantId);

    return {
      payment: await this.withPaymentPlan(payment),
      subscription,
    };
  }

  private buildRequestedRedirects(
    dto: CheckoutPackagePlanDto,
  ): PackagePaymentRedirects {
    return {
      successRedirectUrl: this.normalizeRedirectUrl(
        dto.successRedirectUrl,
        "successRedirectUrl",
      ),
      failRedirectUrl: this.normalizeRedirectUrl(
        dto.failRedirectUrl,
        "failRedirectUrl",
      ),
      cancelRedirectUrl: this.normalizeRedirectUrl(
        dto.cancelRedirectUrl,
        "cancelRedirectUrl",
      ),
    };
  }

  private normalizeRedirectUrl(value: string | undefined, field: string) {
    const trimmed = value?.trim();

    if (!trimmed) {
      return null;
    }

    try {
      // const url = new URL(trimmed);

      // if (url.protocol !== "http:" && url.protocol !== "https:") {
      //   throw new Error("Unsupported protocol");
      // }

      // return url.toString();
      return trimmed;
    } catch {
      throw new BadRequestException(`${field} must be a valid HTTP(S) URL`);
    }
  }

  private getCallbackRedirectUrl(
    payment: Pick<PackagePayment, "gatewayPayload">,
    eventType: string,
    status: "PAID" | "FAILED" | "PENDING",
  ) {
    const redirects = this.getRequestedRedirects(payment.gatewayPayload);

    if (status === "PAID") {
      return redirects.successRedirectUrl;
    }

    if (status === "FAILED") {
      return eventType.toLowerCase() === "cancel"
        ? redirects.cancelRedirectUrl
        : redirects.failRedirectUrl;
    }

    return null;
  }

  private getRequestedRedirects(
    value: JsonValue | null,
  ): PackagePaymentRedirects {
    const payload = this.asJsonObject(value);
    const redirects = this.asJsonObject(payload.requestedRedirects);

    return {
      successRedirectUrl: this.stringValue(redirects.successRedirectUrl),
      failRedirectUrl: this.stringValue(redirects.failRedirectUrl),
      cancelRedirectUrl: this.stringValue(redirects.cancelRedirectUrl),
    };
  }

  private mergeGatewayPayload(
    payment: Pick<PackagePayment, "gatewayPayload">,
    extra: Record<string, JsonValue>,
  ): JsonValue {
    return {
      ...this.asJsonObject(payment.gatewayPayload),
      ...extra,
    };
  }

  private asJsonObject(value: unknown): Record<string, JsonValue> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, JsonValue>;
  }

  private async getSubscriptionWithPlan(subscriptionId: string) {
    const [subscription] = await this.db
      .select()
      .from(packageSubscription)
      .where(eq(packageSubscription.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      return null;
    }

    return {
      ...subscription,
      package: await this.getPlanWithDetails(subscription.packageId),
    };
  }

  private async getActivePackagePaymentConfigOrThrow() {
    const provider = this.getConfiguredPackagePaymentProvider();
    const rows = await this.db
      .select({
        config: packagePaymentGatewayConfig,
        gateway: paymentGateway,
      })
      .from(packagePaymentGatewayConfig)
      .innerJoin(
        paymentGateway,
        eq(paymentGateway.id, packagePaymentGatewayConfig.gatewayId),
      )
      .where(
        and(
          eq(
            packagePaymentGatewayConfig.status,
            PaymentGatewayConfigStatus.ACTIVE,
          ),
          eq(paymentGateway.status, PaymentGatewayStatus.ACTIVE),
          provider ? eq(paymentGateway.code, provider) : undefined,
          isNull(packagePaymentGatewayConfig.deletedAt),
        ),
      )
      .orderBy(asc(paymentGateway.name))
      .limit(2);

    if (rows.length === 0) {
      throw new BadRequestException(
        "Package payment gateway is not configured. Seed an active platform package payment gateway before checkout.",
      );
    }

    if (!provider && rows.length > 1) {
      throw new BadRequestException(
        "Multiple package payment gateways are active. Set PACKAGE_PAYMENT_PROVIDER to choose one.",
      );
    }

    return rows[0];
  }

  private getConfiguredPackagePaymentProvider() {
    const provider = this.appConfig.packagePaymentProvider;

    if (!provider) {
      return null;
    }

    if (Object.values(PaymentGatewayProvider).includes(provider as never)) {
      return provider as PaymentGatewayProvider;
    }

    throw new BadRequestException(
      `Configured package payment provider is invalid: ${provider}`,
    );
  }

  private async getPackagePaymentConfigWithGatewayOrThrow(
    provider: PaymentGatewayProvider,
    configId: string,
  ): Promise<PackagePaymentConfigWithGateway> {
    const [row] = await this.db
      .select({
        config: packagePaymentGatewayConfig,
        gateway: paymentGateway,
      })
      .from(packagePaymentGatewayConfig)
      .innerJoin(
        paymentGateway,
        eq(paymentGateway.id, packagePaymentGatewayConfig.gatewayId),
      )
      .where(
        and(
          eq(packagePaymentGatewayConfig.id, configId),
          eq(paymentGateway.code, provider),
          isNull(packagePaymentGatewayConfig.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(
        "Package payment gateway configuration not found",
      );
    }

    return row;
  }

  private async getPackageGatewayPaymentOrThrow(
    provider: PaymentGatewayProvider,
    paymentId: string,
  ) {
    const [row] = await this.db
      .select({ payment: packagePayment })
      .from(packagePayment)
      .innerJoin(
        packagePaymentGatewayConfig,
        eq(packagePaymentGatewayConfig.id, packagePayment.gatewayConfigId),
      )
      .innerJoin(
        paymentGateway,
        eq(paymentGateway.id, packagePaymentGatewayConfig.gatewayId),
      )
      .where(
        and(
          eq(packagePayment.id, paymentId),
          eq(paymentGateway.code, provider),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException("Package gateway payment not found");
    }

    return row.payment;
  }

  private async getTenantPaymentCustomer(tenantId: string) {
    const [tenant] = await this.db
      .select({
        name: systemUser.name,
        email: systemUser.email,
        phone: systemUser.phone,
      })
      .from(systemUser)
      .where(eq(systemUser.id, tenantId))
      .limit(1);

    return {
      name: tenant?.name,
      email: tenant?.email,
      phone: tenant?.phone,
      country: "Bangladesh",
    };
  }

  private buildCallbackUrls(
    provider: PaymentGatewayProvider,
    paymentId: string,
  ) {
    const baseUrl = `${this.appConfig.publicApiUrl}/payment-gateways/callbacks/${provider}/${paymentId}`;

    return {
      successUrl: `${baseUrl}/success`,
      failUrl: `${baseUrl}/fail`,
      cancelUrl: `${baseUrl}/cancel`,
      ipnUrl: `${baseUrl}/ipn`,
    };
  }

  private async generatePackagePaymentNo() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `PKG-${Date.now()}-${randomBytes(4)
        .toString("hex")
        .toUpperCase()}`;
      const [existing] = await this.db
        .select({ id: packagePayment.id })
        .from(packagePayment)
        .where(eq(packagePayment.paymentNo, candidate))
        .limit(1);

      if (!existing) {
        return candidate;
      }
    }

    throw new BadRequestException("Could not generate package payment number");
  }

  private getPaymentExpiry() {
    const expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + PACKAGE_PAYMENT_EXPIRY_MINUTES,
    );
    return expiresAt;
  }

  private extractEventId(
    provider: PaymentGatewayProvider,
    payload: Record<string, unknown>,
  ) {
    switch (provider) {
      case PaymentGatewayProvider.SSLCOMMERZ:
        return (
          this.stringValue(payload.val_id) ??
          this.stringValue(payload.bank_tran_id)
        );
      case PaymentGatewayProvider.AAMARPAY:
        return (
          this.stringValue(payload.pg_txnid) ??
          this.stringValue(payload.bank_txn)
        );
      case PaymentGatewayProvider.SHURJOPAY:
        return (
          this.stringValue(payload.sp_order_id) ??
          this.stringValue(payload.order_id)
        );
      case PaymentGatewayProvider.BKASH:
        return (
          this.stringValue(payload.paymentID) ??
          this.stringValue(payload.paymentId) ??
          this.stringValue(payload.trxID)
        );
    }
  }

  private stringValue(value: unknown) {
    if (typeof value === "string") {
      return value.trim() || null;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return null;
  }
}
