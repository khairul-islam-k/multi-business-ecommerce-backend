import Decimal from "decimal.js";

import {
  PackageBillingCycle,
  PackagePaymentStatus,
  PackagePaymentType,
  PaymentGatewayMode,
  PaymentGatewayProvider,
  PaymentWebhookStatus,
} from "@/database/schema";
import { describe, expect, it, jest } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";

import { TenantPackageService } from "./tenant-package.service";

const targetPlanSnapshot = {
  planId: "plan-growth",
  name: "Growth",
  description: null,
  price: 100,
  billingCycle: PackageBillingCycle.MONTHLY,
  currencyCode: "BDT",
  freeTrialDays: 0,
  limits: [],
  features: [],
  capturedAt: "2026-01-01T00:00:00.000Z",
};

function createDb() {
  const insertResults: unknown[][] = [];
  const updateResults: unknown[][] = [];
  const selectResults: unknown[][] = [];
  const insertValues: unknown[] = [];
  const updateValues: unknown[] = [];

  const db = {
    insert: jest.fn(() => ({
      values: jest.fn((values: unknown) => {
        insertValues.push(values);

        return {
          returning: jest.fn(async () => insertResults.shift() ?? []),
        };
      }),
    })),
    update: jest.fn(() => ({
      set: jest.fn((values: unknown) => {
        updateValues.push(values);

        return {
          where: jest.fn(() => ({
            returning: jest.fn(async () => updateResults.shift() ?? []),
          })),
        };
      }),
    })),
    select: jest.fn(() => {
      const builder = {
        from: jest.fn(() => builder),
        innerJoin: jest.fn(() => builder),
        where: jest.fn(() => builder),
        orderBy: jest.fn(() => builder),
        limit: jest.fn(async () => selectResults.shift() ?? []),
        then: (
          resolve: (value: unknown[]) => unknown,
          reject?: (error: unknown) => unknown,
        ) => Promise.resolve(selectResults.shift() ?? []).then(resolve, reject),
      };

      return builder;
    }),
    transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback(db),
    ),
  };

  return {
    db,
    insertResults,
    updateResults,
    selectResults,
    insertValues,
    updateValues,
  };
}

function createService() {
  const database = createDb();
  const subscriptions = {
    calculatePlanChangeCharge: jest.fn(),
    replaceCurrentSubscription: jest.fn(),
    findCurrentSubscription: jest.fn(),
  };
  const limits = {
    assertUsageFitsLimits: jest.fn(async () => undefined),
    getUsageSummary: jest.fn(),
  };
  const encryption = {
    decrypt: jest.fn(() => ({ storeId: "store", storePassword: "secret" })),
  };
  const providers = {
    initiate: jest.fn(),
    verify: jest.fn(),
  };
  const appConfig = {
    publicApiUrl: "https://api.example.com/api/v1",
    packagePaymentProvider: PaymentGatewayProvider.SSLCOMMERZ,
  };
  const service = new TenantPackageService(
    { db: database.db } as never,
    appConfig as never,
    limits as never,
    subscriptions as never,
    encryption as never,
    providers as never,
  );

  jest
    .spyOn(service as any, "generatePackagePaymentNo")
    .mockResolvedValue("PKG-001");
  jest
    .spyOn(service as any, "withPaymentPlan")
    .mockImplementation(async (payment: unknown) => ({
      ...(payment as Record<string, unknown>),
      plan: null,
    }));

  return {
    service,
    database,
    subscriptions,
    limits,
    encryption,
    providers,
  };
}

describe("TenantPackageService real payment checkout", () => {
  it("creates a pending package payment and initiates the configured gateway for paid plan changes", async () => {
    const { service, database, subscriptions, providers } = createService();
    const payment = {
      id: "payment-1",
      tenantId: "tenant-1",
      planId: "plan-growth",
      type: PackagePaymentType.PLAN_CHANGE,
      status: PackagePaymentStatus.PENDING,
      paymentNo: "PKG-001",
      amount: new Decimal(100),
      currencyCode: "BDT",
      gatewayConfigId: "package-config-1",
      gatewaySessionId: null,
      gatewayTransactionId: null,
      metadata: {},
      expiresAt: new Date("2026-01-01T00:15:00.000Z"),
    };

    (subscriptions.calculatePlanChangeCharge as any).mockResolvedValue({
      charge: {
        amountDue: 100,
        currencyCode: "BDT",
      },
      targetPlan: { id: "plan-growth", name: "Growth" },
      targetPlanSnapshot,
    });
    jest
      .spyOn(service as any, "getActivePackagePaymentConfigOrThrow")
      .mockResolvedValue({
        config: {
          id: "package-config-1",
          mode: PaymentGatewayMode.SANDBOX,
          configData: {},
        },
        gateway: {
          id: "gateway-1",
          code: PaymentGatewayProvider.SSLCOMMERZ,
        },
      } as never);
    jest
      .spyOn(service as any, "getTenantPaymentCustomer")
      .mockResolvedValue({ name: "Tenant", email: "tenant@example.com" });
    (providers.initiate as any).mockResolvedValue({
      redirectUrl: "https://pay.example.com/session",
      sessionId: "session-1",
      transactionId: null,
      rawResponse: { status: "SUCCESS" },
    });
    database.insertResults.push([payment]);
    database.updateResults.push([
      {
        ...payment,
        gatewaySessionId: "session-1",
        gatewayPayload: { initiation: { status: "SUCCESS" } },
      },
    ]);

    const response = await service.checkoutPlan("tenant-1", "plan-growth");

    expect(database.insertValues[0]).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        planId: "plan-growth",
        status: PackagePaymentStatus.PENDING,
        paymentNo: "PKG-001",
        gatewayConfigId: "package-config-1",
      }),
    );
    expect(providers.initiate).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentNo: "PKG-001",
        amount: payment.amount,
        callbackUrls: expect.objectContaining({
          successUrl:
            "https://api.example.com/api/v1/payment-gateways/callbacks/SSLCOMMERZ/payment-1/success",
          ipnUrl:
            "https://api.example.com/api/v1/payment-gateways/callbacks/SSLCOMMERZ/payment-1/ipn",
        }),
      }),
    );
    expect(response.data).toEqual(
      expect.objectContaining({
        redirectUrl: "https://pay.example.com/session",
        gatewaySessionId: "session-1",
      }),
    );
  });

  it("creates a credit-only package payment without initiating a gateway", async () => {
    const { service, database, subscriptions, providers } = createService();

    (subscriptions.calculatePlanChangeCharge as any).mockResolvedValue({
      charge: {
        amountDue: 0,
        currencyCode: "BDT",
      },
      targetPlan: { id: "plan-basic", name: "Basic" },
      targetPlanSnapshot,
    });
    database.insertResults.push([
      {
        id: "payment-1",
        tenantId: "tenant-1",
        planId: "plan-basic",
        type: PackagePaymentType.CREDIT_ONLY_PLAN_CHANGE,
        status: PackagePaymentStatus.PENDING,
        amount: new Decimal(0),
        currencyCode: "BDT",
        expiresAt: new Date("2026-01-01T00:15:00.000Z"),
      },
    ]);

    const response = await service.checkoutPlan("tenant-1", "plan-basic");

    expect(providers.initiate).not.toHaveBeenCalled();
    expect(response.data).toEqual(
      expect.objectContaining({
        redirectUrl: null,
        gatewaySessionId: null,
        gatewayTransactionId: null,
      }),
    );
  });
});

describe("TenantPackageService package payment confirmation", () => {
  it("does not fake-confirm paid pending gateway payments", async () => {
    const { service, database } = createService();

    database.selectResults.push([
      {
        id: "payment-1",
        tenantId: "tenant-1",
        status: PackagePaymentStatus.PENDING,
        amount: new Decimal(100),
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);

    await expect(
      service.confirmMockPayment("tenant-1", "payment-1"),
    ).rejects.toThrow(BadRequestException);
    expect(database.db.transaction).not.toHaveBeenCalled();
  });

  it("finalizes zero-due package payments through the compatibility confirm route", async () => {
    const { service, database } = createService();
    const payment = {
      id: "payment-1",
      tenantId: "tenant-1",
      status: PackagePaymentStatus.PENDING,
      amount: new Decimal(0),
      expiresAt: new Date(Date.now() + 60_000),
    };
    const finalized = {
      payment: { ...payment, status: PackagePaymentStatus.CONFIRMED },
      subscription: { id: "subscription-1" },
    };

    database.selectResults.push([payment]);
    jest
      .spyOn(service as any, "confirmPendingPackagePayment")
      .mockResolvedValue(finalized);

    const response = await service.confirmMockPayment("tenant-1", "payment-1");

    expect(database.db.transaction).toHaveBeenCalled();
    expect(response.data).toEqual(finalized);
  });
});

describe("TenantPackageService package gateway callbacks", () => {
  it("confirms a pending package payment on a paid gateway callback", async () => {
    const { service, database, providers } = createService();
    const payment = {
      id: "payment-1",
      tenantId: "tenant-1",
      status: PackagePaymentStatus.PENDING,
      paymentNo: "PKG-001",
      amount: new Decimal(100),
      gatewayConfigId: "package-config-1",
    };
    const verification = {
      status: "PAID" as const,
      transactionId: "txn-1",
      eventId: "event-1",
      rawResponse: { status: "VALID" },
    };
    const finalized = {
      payment: {
        ...payment,
        status: PackagePaymentStatus.CONFIRMED,
        gatewayPayload: {
          requestedRedirects: {
            successRedirectUrl: "https://app.example.com/billing/success",
            failRedirectUrl: "https://app.example.com/billing/failed",
            cancelRedirectUrl: "https://app.example.com/billing/cancelled",
          },
        },
      },
      subscription: { id: "subscription-1" },
    };

    jest
      .spyOn(service as any, "getPackageGatewayPaymentOrThrow")
      .mockResolvedValue(payment);
    jest
      .spyOn(service as any, "getPackagePaymentConfigWithGatewayOrThrow")
      .mockResolvedValue({
        config: {
          id: "package-config-1",
          mode: PaymentGatewayMode.SANDBOX,
          configData: {},
        },
        gateway: {
          id: "gateway-1",
          code: PaymentGatewayProvider.SSLCOMMERZ,
        },
      } as never);
    jest
      .spyOn(service as any, "confirmPendingPackagePayment")
      .mockResolvedValue(finalized);
    (providers.verify as any).mockResolvedValue(verification);
    database.insertResults.push([
      {
        id: "webhook-1",
      },
    ]);

    const response = await service.handleGatewayCallback(
      PaymentGatewayProvider.SSLCOMMERZ,
      "payment-1",
      "ipn",
      { val_id: "event-1" },
    );

    expect(providers.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentNo: "PKG-001",
        amount: payment.amount,
      }),
    );
    expect(
      (service as any)["confirmPendingPackagePayment"],
    ).toHaveBeenCalledWith(database.db, payment, verification);
    expect(database.updateValues).toContainEqual(
      expect.objectContaining({ status: PaymentWebhookStatus.PROCESSED }),
    );
    expect(response.data).toEqual({
      ...finalized,
      redirectUrl: "https://app.example.com/billing/success",
    });
  });
});
