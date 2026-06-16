import "dotenv/config";

import { Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";

import { createDrizzleScriptClient } from "./database-script-client";

type TableRecord = {
  table_schema: string;
  table_name: string;
};

const database = createDrizzleScriptClient();
const logger = new Logger("DBResetResetScript");

const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`;

const main = async () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset production database.");
  }

  const result = await database.db.execute<TableRecord>(sql`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '__drizzle_migrations__'
    ORDER BY table_name
  `);
  const tables = result.rows;

  if (tables.length === 0) {
    logger.log("No database tables found to reset.");
    return;
  }

  const tableList = tables
    .map(
      (table) =>
        `${quoteIdentifier(table.table_schema)}.${quoteIdentifier(
          table.table_name,
        )}`,
    )
    .join(", ");

  await database.db.execute(
    sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`),
  );

  logger.log(`Reset database data from ${tables.length} tables.`);
};

main()
  .catch((error) => {
    logger.error(
      "Failed to reset database data.",
      error instanceof Error ? error.stack : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.close();
  });
