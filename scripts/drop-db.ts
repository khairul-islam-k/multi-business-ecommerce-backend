import "dotenv/config";

import { Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";

import { createDrizzleScriptClient } from "./database-script-client";

const database = createDrizzleScriptClient();
const logger = new Logger("DBDropSchemaScript");

const main = async () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to drop production database.");
  }

  await database.db.execute(sql.raw(`DROP SCHEMA IF EXISTS public CASCADE`));
  await database.db.execute(sql.raw(`CREATE SCHEMA public`));

  // Optional, useful for local dev defaults.
  await database.db.execute(
    sql.raw(`GRANT USAGE, CREATE ON SCHEMA public TO PUBLIC`),
  );

  logger.log("Dropped and recreated public schema.");
};

main()
  .catch((error) => {
    logger.error(
      "Failed to drop database schema.",
      error instanceof Error ? error.stack : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.close();
  });
