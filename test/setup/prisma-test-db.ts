import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export function getTestDatabaseUrl() {
  const databaseUrl = process.env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("TEST_DATABASE_URL is required for integration tests");
  }

  return databaseUrl;
}

export function createTestPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: getTestDatabaseUrl(),
  });

  return new PrismaClient({
    adapter,
  });
}
