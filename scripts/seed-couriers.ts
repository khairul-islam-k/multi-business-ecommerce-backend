import "dotenv/config";

import { Logger } from "@nestjs/common";

import {
  Courier,
  courier,
  CourierProvider,
  CourierStatus,
} from "../src/database/schema";
import { createDrizzleScriptClient } from "./database-script-client";

const database = createDrizzleScriptClient();
const logger = new Logger("CourierSeedScript");

const couriers = [
  {
    code: CourierProvider.PATHAO,
    name: "Pathao",
    description: "Courier delivery provider by Pathao.",
  },
  {
    code: CourierProvider.REDX,
    name: "REDX",
    description: "Courier delivery provider by REDX.",
  },
  {
    code: CourierProvider.STEADFAST,
    name: "Steadfast",
    description: "Courier delivery provider by Steadfast.",
  },
] as const;

const main = async () => {
  const rows = await database.db.transaction(async (tx) => {
    const seeded: Courier[] = [];

    for (const item of couriers) {
      const [row] = await tx
        .insert(courier)
        .values({
          ...item,
          status: CourierStatus.ACTIVE,
        })
        .onConflictDoUpdate({
          target: courier.code,
          set: {
            name: item.name,
            description: item.description,
            status: CourierStatus.ACTIVE,
          },
        })
        .returning();

      seeded.push(row);
    }

    return seeded;
  });

  logger.log(`Seeded couriers: ${rows.map((row) => row.code).join(", ")}`);
};

main()
  .catch((error) => {
    logger.error(
      "Failed to seed couriers.",
      error instanceof Error ? error.stack : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.close();
  });
