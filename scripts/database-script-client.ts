import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../src/database/schema";

export const createDrizzleScriptClient = () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  const db = drizzle({
    client: pool,
    schema,
  });

  return {
    db,
    pool,
    close: () => pool.end(),
  };
};
