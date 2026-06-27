import "dotenv/config";

import { Logger } from "@nestjs/common";

import { createDrizzleScriptClient } from "./database-script-client";
import {
  PaymentGateway,
  paymentGateway,
  PaymentGatewayProvider,
  PaymentGatewayStatus,
} from "../src/database/schema";

const database = createDrizzleScriptClient();
const logger = new Logger("PaymentGatewaySeedScript");

const gateways = [
  {
    code: PaymentGatewayProvider.SSLCOMMERZ,
    name: "SSLCOMMERZ",
    description: "Hosted payment gateway by SSLCOMMERZ.",
    sortOrder: 10,
  },
  {
    code: PaymentGatewayProvider.AAMARPAY,
    name: "aamarPay",
    description: "Hosted payment gateway by aamarPay.",
    sortOrder: 20,
  },
  {
    code: PaymentGatewayProvider.SURJOPAY,
    name: "surjoPay",
    description: "Hosted payment gateway by shurjoMukhi Limited.",
    sortOrder: 30,
  },
] as const;

const main = async () => {
  const rows = await database.db.transaction(async (tx) => {
    const seeded: PaymentGateway[] = [];

    for (const gateway of gateways) {
      const [row] = await tx
        .insert(paymentGateway)
        .values({
          ...gateway,
          status: PaymentGatewayStatus.ACTIVE,
        })
        .onConflictDoUpdate({
          target: paymentGateway.code,
          set: {
            name: gateway.name,
            description: gateway.description,
            sortOrder: gateway.sortOrder,
            status: PaymentGatewayStatus.ACTIVE,
          },
        })
        .returning();

      seeded.push(row);
    }

    return seeded;
  });

  logger.log(
    `Seeded payment gateways: ${rows.map((row) => row.code).join(", ")}`,
  );
};

main()
  .catch((error) => {
    logger.error(
      "Failed to seed payment gateways.",
      error instanceof Error ? error.stack : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.close();
  });
