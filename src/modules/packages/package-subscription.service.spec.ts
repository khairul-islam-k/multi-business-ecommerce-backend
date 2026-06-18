import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";

import {
  PackageBillingCycle,
  packagePlan,
  packagePlanFeature,
  packagePlanLimit,
  packageSubscription,
  packageTenantCreditLedger,
} from "@/database/schema";

import { PackageSubscriptionService } from "./package-subscription.service";

function createPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "target-plan",
    name: "Growth",
    description: null,
    price: new Decimal(200),
    billingCycle: PackageBillingCycle.MONTHLY,
    currencyCode: "BDT",
    freeTrialDays: 0,
    ...overrides,
  };
}

function createDb(params: {
  targetPlan: Record<string, unknown>;
  currentSubscription?: Record<string, unknown> | null;
  creditBalance?: number;
}) {
  const rowsFor = (table: unknown) => {
    if (table === packageTenantCreditLedger) {
      return [{ amount: String(params.creditBalance ?? 0) }];
    }

    if (table === packagePlan) {
      return [params.targetPlan];
    }

    if (table === packagePlanLimit) {
      return [];
    }

    if (table === packagePlanFeature) {
      return [];
    }

    if (table === packageSubscription) {
      return params.currentSubscription ? [params.currentSubscription] : [];
    }

    return [];
  };

  return {
    select: () => {
      let selectedTable: unknown;
      const builder = {
        from(table: unknown) {
          selectedTable = table;
          return builder;
        },
        where: () => builder,
        orderBy: () => builder,
        limit: () => builder,
        then(
          resolve: (value: unknown[]) => unknown,
          reject?: (error: unknown) => unknown,
        ) {
          return Promise.resolve(rowsFor(selectedTable)).then(resolve, reject);
        },
      };

      return builder;
    },
  };
}

describe("PackageSubscriptionService charge calculation", () => {
  it("charges the target plan price minus existing tenant credit when there is no current subscription", async () => {
    const service = new PackageSubscriptionService({
      db: createDb({
        targetPlan: createPlan({ price: new Decimal(100) }),
        currentSubscription: null,
        creditBalance: 25,
      }),
    } as never);

    const { charge } = await service.calculatePlanChangeCharge(
      "tenant-1",
      "target-plan",
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(charge.targetPlanPrice).toBe(100);
    expect(charge.existingCreditBalance).toBe(25);
    expect(charge.creditApplied).toBe(25);
    expect(charge.amountDue).toBe(75);
    expect(charge.creditToAdd).toBe(0);
  });

  it("prorates unused current plan value and applies tenant credit to upgrades", async () => {
    const service = new PackageSubscriptionService({
      db: createDb({
        targetPlan: createPlan({ price: new Decimal(200) }),
        currentSubscription: {
          id: "subscription-1",
          packageId: "current-plan",
          price: new Decimal(100),
          billingCycle: PackageBillingCycle.MONTHLY,
          currencyCode: "BDT",
          currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-01-31T00:00:00.000Z"),
        },
        creditBalance: 30,
      }),
    } as never);

    const { charge } = await service.calculatePlanChangeCharge(
      "tenant-1",
      "target-plan",
      new Date("2026-01-16T00:00:00.000Z"),
    );

    expect(charge.unusedCurrentBalance).toBe(50);
    expect(charge.usedCurrentPlanValue).toBe(50);
    expect(charge.creditApplied).toBe(30);
    expect(charge.amountDue).toBe(120);
    expect(charge.creditToAdd).toBe(0);
  });

  it("creates downgrade credit when unused balance exceeds the target plan price", async () => {
    const service = new PackageSubscriptionService({
      db: createDb({
        targetPlan: createPlan({ price: new Decimal(50) }),
        currentSubscription: {
          id: "subscription-1",
          packageId: "current-plan",
          price: new Decimal(200),
          billingCycle: PackageBillingCycle.MONTHLY,
          currencyCode: "BDT",
          currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-01-31T00:00:00.000Z"),
        },
      }),
    } as never);

    const { charge } = await service.calculatePlanChangeCharge(
      "tenant-1",
      "target-plan",
      new Date("2026-01-16T00:00:00.000Z"),
    );

    expect(charge.unusedCurrentBalance).toBe(100);
    expect(charge.amountDue).toBe(0);
    expect(charge.creditToAdd).toBe(50);
  });
});
