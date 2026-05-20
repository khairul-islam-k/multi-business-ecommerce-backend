import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PackagePaymentStatus,
  PackageStatus,
  PackageSubscriptionStatus,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { QueryPackageDto } from "../dto/query-package.dto";
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
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import { PackageSubscriptionService } from "../package-subscription.service";

const PACKAGE_PLAN_INCLUDE = {
  limits: true,
  features: {
    orderBy: {
      sortOrder: "asc",
    },
  },
  _count: {
    select: {
      subscriptions: true,
    },
  },
} satisfies Prisma.PackagePlanInclude;

@Injectable()
export class AdminPackageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: PackageSubscriptionService,
  ) {}

  async createPlan(dto: CreatePackagePlanDto) {
    try {
      const plan = await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) {
          await this.clearDefaultPlan(tx);
        }

        return tx.packagePlan.create({
          data: {
            name: dto.name.trim(),
            description: dto.description?.trim() || null,
            price: dto.price,
            billingCycle: dto.billingCycle,
            currencyCode: this.normalizeCurrency(dto.currencyCode),
            freeTrialDays: dto.freeTrialDays ?? 0,
            isDefault: dto.isDefault ?? false,
            status: dto.status ?? PackageStatus.ACTIVE,
            sortOrder: dto.sortOrder ?? 0,
            limits: this.buildLimitCreate(dto.limits),
            features: this.buildFeatureCreate(dto.features),
          },
          include: PACKAGE_PLAN_INCLUDE,
        });
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

    const where: Prisma.PackagePlanWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
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

    const [items, total] = await Promise.all([
      this.prisma.packagePlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: PACKAGE_PLAN_INCLUDE,
      }),
      this.prisma.packagePlan.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findPlan(planId: string) {
    const plan = await this.prisma.packagePlan.findFirst({
      where: {
        id: planId,
        deletedAt: null,
      },
      include: PACKAGE_PLAN_INCLUDE,
    });

    if (!plan) {
      throw new NotFoundException("Package plan not found");
    }

    return apiResponse(plan);
  }

  async updatePlan(planId: string, dto: UpdatePackagePlanDto) {
    await this.assertPlanExists(planId);

    try {
      const plan = await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) {
          await this.clearDefaultPlan(tx, planId);
        }

        if (dto.limits !== undefined) {
          await tx.packagePlanLimit.deleteMany({
            where: {
              packageId: planId,
            },
          });
        }

        if (dto.features !== undefined) {
          await tx.packagePlanFeature.deleteMany({
            where: {
              packageId: planId,
            },
          });
        }

        return tx.packagePlan.update({
          where: {
            id: planId,
          },
          data: {
            ...(dto.name !== undefined && { name: dto.name.trim() }),
            ...(dto.description !== undefined && {
              description: dto.description?.trim() || null,
            }),
            ...(dto.price !== undefined && { price: dto.price }),
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
            ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
            ...(dto.limits !== undefined && {
              limits: this.buildLimitCreate(dto.limits),
            }),
            ...(dto.features !== undefined && {
              features: this.buildFeatureCreate(dto.features),
            }),
          },
          include: PACKAGE_PLAN_INCLUDE,
        });
      });

      return apiResponse(plan, "Package plan updated successfully");
    } catch (error) {
      this.handleUniqueError(error, "Package plan name already exists");
    }
  }

  async deletePlan(planId: string) {
    await this.assertPlanExists(planId);

    await this.prisma.packagePlan.update({
      where: {
        id: planId,
      },
      data: {
        status: PackageStatus.ARCHIVED,
        isDefault: false,
        deletedAt: new Date(),
      },
    });

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

    const where: Prisma.PackageSubscriptionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.packageSubscription.findMany({
        where,
        skip,
        take: limit,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
            },
          },
          package: {
            include: {
              features: {
                orderBy: {
                  sortOrder: "asc",
                },
              },
              limits: true,
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

  async findSubscription(subscriptionId: string) {
    const subscription = await this.prisma.packageSubscription.findUnique({
      where: {
        id: subscriptionId,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
        package: {
          include: {
            limits: true,
            features: {
              orderBy: {
                sortOrder: "asc",
              },
            },
          },
        },
        usageCounters: true,
        mockPayments: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }

    return apiResponse(subscription);
  }

  async changeTenantSubscriptionPlan(
    subscriptionId: string,
    dto: ChangeTenantSubscriptionPlanDto,
  ) {
    const subscription = await this.prisma.packageSubscription.findUnique({
      where: {
        id: subscriptionId,
      },
      select: {
        tenantId: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException("Subscription not found");
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
    const subscription = await this.prisma.packageSubscription.findUnique({
      where: {
        id: subscriptionId,
      },
    });

    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }

    const updatedSubscription = await this.prisma.packageSubscription.update({
      where: {
        id: subscriptionId,
      },
      data: {
        status: PackageSubscriptionStatus.CANCELLED,
        endedAt: new Date(),
        endReason: dto.reason?.trim() || "Cancelled by admin",
      },
    });

    return apiResponse(
      updatedSubscription,
      "Subscription cancelled successfully",
    );
  }

  async expirePendingMockPayments() {
    const result = await this.prisma.packageMockPayment.updateMany({
      where: {
        status: PackagePaymentStatus.PENDING,
        expiresAt: {
          lte: new Date(),
        },
      },
      data: {
        status: PackagePaymentStatus.EXPIRED,
      },
    });

    return apiResponse(result, "Expired pending package mock payments");
  }

  private async assertPlanExists(planId: string) {
    const plan = await this.prisma.packagePlan.findFirst({
      where: {
        id: planId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!plan) {
      throw new NotFoundException("Package plan not found");
    }
  }

  private clearDefaultPlan(
    tx: Prisma.TransactionClient,
    exceptPlanId?: string,
  ) {
    return tx.packagePlan.updateMany({
      where: {
        isDefault: true,
        ...(exceptPlanId ? { id: { not: exceptPlanId } } : {}),
      },
      data: {
        isDefault: false,
      },
    });
  }

  private buildLimitCreate(limits?: CreatePackagePlanDto["limits"]) {
    return limits?.length
      ? {
          create: limits.map((limit) => ({
            limitKey: limit.limitKey,
            limitValue: limit.limitValue,
            resetCycle: limit.resetCycle,
            description: limit.description?.trim() || null,
          })),
        }
      : undefined;
  }

  private buildFeatureCreate(features?: CreatePackagePlanDto["features"]) {
    return features?.length
      ? {
          create: features.map((feature, index) => ({
            title: feature.title.trim(),
            description: feature.description?.trim() || null,
            sortOrder: feature.sortOrder ?? index,
            isActive: feature.isActive ?? true,
          })),
        }
      : undefined;
  }

  private normalizeCurrency(currencyCode?: string) {
    return currencyCode?.trim().toUpperCase() || "BDT";
  }

  private handleUniqueError(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(message);
    }

    throw error;
  }
}
