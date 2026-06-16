import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../../src/database/schema";

export function getTestDatabaseUrl() {
  const databaseUrl = process.env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("TEST_DATABASE_URL is required for integration tests");
  }

  return databaseUrl;
}

export function createTestDatabaseClient() {
  const pool = new Pool({
    connectionString: getTestDatabaseUrl(),
  });

  return {
    db: drizzle({
      client: pool,
      schema,
    }),
    close: () => pool.end(),
  };
}
