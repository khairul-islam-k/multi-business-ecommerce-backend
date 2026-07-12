import "dotenv/config";

import { and, eq, isNull } from "drizzle-orm";

import { Logger } from "@nestjs/common";

import {
  packagePaymentGatewayConfig,
  paymentGateway,
  PaymentGatewayConfigStatus,
  PaymentGatewayMode,
  PaymentGatewayProvider,
} from "../src/database/schema";
import { PaymentConfigEncryptionService } from "../src/modules/payment-gateways/payment-config-encryption.service";
import { PaymentGatewayProviderService } from "../src/modules/payment-gateways/payment-gateway-provider.service";
import { createDrizzleScriptClient } from "./database-script-client";

const database = createDrizzleScriptClient();
const logger = new Logger("PackagePaymentGatewayConfigSeedScript");
const providers = new PaymentGatewayProviderService();

const getRequiredValue = (key: string) => {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
};

const parseProvider = (value: string): PaymentGatewayProvider => {
  if (Object.values(PaymentGatewayProvider).includes(value as never)) {
    return value as PaymentGatewayProvider;
  }

  throw new Error(`PACKAGE_PAYMENT_PROVIDER is invalid: ${value}`);
};

const parseMode = (value: string): PaymentGatewayMode => {
  if (Object.values(PaymentGatewayMode).includes(value as never)) {
    return value as PaymentGatewayMode;
  }

  throw new Error(`PACKAGE_PAYMENT_MODE is invalid: ${value}`);
};

const parseConfig = () => {
  const raw = getRequiredValue("PACKAGE_PAYMENT_CONFIG_JSON");

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON value must be an object");
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `PACKAGE_PAYMENT_CONFIG_JSON must be valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const main = async () => {
  const provider = parseProvider(getRequiredValue("PACKAGE_PAYMENT_PROVIDER"));
  const mode = parseMode(getRequiredValue("PACKAGE_PAYMENT_MODE"));
  const configData = providers.normalizeConfig(provider, parseConfig());
  const encryption = new PaymentConfigEncryptionService({
    paymentConfigEncryptionKey: getRequiredValue(
      "PAYMENT_CONFIG_ENCRYPTION_KEY",
    ),
  } as never);

  const [gateway] = await database.db
    .select()
    .from(paymentGateway)
    .where(eq(paymentGateway.code, provider))
    .limit(1);

  if (!gateway) {
    throw new Error(
      `Payment gateway ${provider} is not seeded. Run db:seed:payment-gateways first.`,
    );
  }

  const saved = await database.db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(packagePaymentGatewayConfig)
      .where(
        and(
          eq(packagePaymentGatewayConfig.gatewayId, gateway.id),
          isNull(packagePaymentGatewayConfig.deletedAt),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await tx
        .update(packagePaymentGatewayConfig)
        .set({
          configData: encryption.encrypt(configData),
          mode,
          status: PaymentGatewayConfigStatus.ACTIVE,
          deletedAt: null,
          deletedBy: null,
        })
        .where(eq(packagePaymentGatewayConfig.id, existing.id))
        .returning();

      return updated;
    }

    const [created] = await tx
      .insert(packagePaymentGatewayConfig)
      .values({
        gatewayId: gateway.id,
        configData: encryption.encrypt(configData),
        mode,
        status: PaymentGatewayConfigStatus.ACTIVE,
      })
      .returning();

    return created;
  });

  logger.log(
    `Seeded package payment gateway config: ${provider} ${mode} (${saved.id})`,
  );
};

main()
  .catch((error) => {
    logger.error(
      "Failed to seed package payment gateway config.",
      error instanceof Error ? error.stack : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.close();
  });
