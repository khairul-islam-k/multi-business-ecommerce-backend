import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PackagePaymentStatus,
  PackagePaymentType,
  PackageStatus,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import { QueryPackageDto } from "../dto/query-package.dto";
import { PackageLimitService } from "../package-limit.service";
import { PackageSubscriptionService } from "../package-subscription.service";
import type { PackagePlanSnapshot } from "../package-subscription.service";
import { CancelTenantSubscriptionDto } from "./dto/tenant-package.dto";

const MOCK_PAYMENT_EXPIRY_MINUTES = 15;

@Injectable()
export class TenantPackageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: PackageLimitService,
    private readonly subscriptions: PackageSubscriptionService,
  ) {}

  async findAvailablePlans(query: QueryPackageDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.PackagePlanWhereInput = {
      deletedAt: null,
      status: PackageStatus.ACTIVE,
      ...(query.search
        ? {
            OR: [
              {
                name: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const items = await this.prisma.packagePlan.findMany({
      where,
      skip,
      take: limit,
      include: {
        limits: true,
        features: {
          where: {
            isActive: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    const total = await this.prisma.packagePlan.count({ where });

    return paginatedResponse(items, {
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

    const where: Prisma.PackageSubscriptionWhereInput = {
      tenantId,
    };

    const [items, total] = await Promise.all([
      this.prisma.packageSubscription.findMany({
        where,
        skip,
        take: limit,
        include: {
          package: {
            include: {
              limits: true,
              features: {
                where: {
                  isActive: true,
                },
                orderBy: {
                  sortOrder: "asc",
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      this.prisma.packageSubscription.count({ where }),
    ]);

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

    const payment = await this.prisma.packageMockPayment.create({
      data: {
        tenantId,
        planId: targetPlan.id,
        type: PackagePaymentType.PLAN_CHANGE,
        status: PackagePaymentStatus.PENDING,
        amount: charge.amountDue,
        currencyCode: charge.currencyCode,
        metadata: {
          calculation: "target_plan_price_minus_current_unused_balance",
          charge,
          targetPlanSnapshot,
        },
        expiresAt: this.getPaymentExpiry(),
      },
      include: {
        plan: {
          include: {
            limits: true,
            features: {
              where: {
                isActive: true,
              },
              orderBy: {
                sortOrder: "asc",
              },
            },
          },
        },
      },
    });

    return apiResponse(payment, "Package checkout created successfully");
  }

  async confirmMockPayment(tenantId: string, paymentId: string) {
    const payment = await this.prisma.packageMockPayment.findFirst({
      where: {
        id: paymentId,
        tenantId,
      },
    });

    if (!payment) {
      throw new NotFoundException("Package mock payment not found");
    }

    if (payment.status !== PackagePaymentStatus.PENDING) {
      throw new ForbiddenException("Package mock payment is not pending");
    }

    if (payment.expiresAt <= new Date()) {
      await this.prisma.packageMockPayment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: PackagePaymentStatus.EXPIRED,
        },
      });

      throw new ForbiddenException("Package mock payment has expired");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (!payment.planId) {
        throw new ForbiddenException("Payment plan is missing");
      }

      const subscription = await this.subscriptions.replaceCurrentSubscription(
        tenantId,
        payment.planId,
        tx,
        this.getPlanSnapshotFromPayment(payment.metadata),
      );

      const confirmedPayment = await tx.packageMockPayment.update({
        where: {
          id: payment.id,
        },
        data: {
          subscriptionId: subscription.id,
          status: PackagePaymentStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      return {
        payment: confirmedPayment,
        subscription,
      };
    });

    return apiResponse(result, "Package mock payment confirmed successfully");
  }

  async cancelSubscription(tenantId: string, dto: CancelTenantSubscriptionDto) {
    const subscription = await this.subscriptions.cancelCurrentSubscription(
      tenantId,
      dto.reason,
    );

    return apiResponse(subscription, "Subscription cancelled successfully");
  }

  private getPlanSnapshotFromPayment(
    metadata: Prisma.JsonValue,
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

  private getPaymentExpiry() {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + MOCK_PAYMENT_EXPIRY_MINUTES);
    return expiresAt;
  }
}
