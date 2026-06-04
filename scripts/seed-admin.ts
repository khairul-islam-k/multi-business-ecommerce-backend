import "dotenv/config";

import * as argon2 from "argon2";

import { Logger } from "@nestjs/common";
import { SystemUserStatus, SystemUserType } from "@prisma/client";

import { createPrismaScriptClient } from "./prisma-script-client";

const prisma = createPrismaScriptClient();
const logger = new Logger("AdminSeedScript");

const getRequiredValue = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
};

const main = async () => {
  const name = getRequiredValue("SEED_ADMIN_NAME");
  const email = getRequiredValue("SEED_ADMIN_EMAIL").trim().toLowerCase();
  const password = getRequiredValue("SEED_ADMIN_PASSWORD");
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  const admin = await prisma.systemUser.upsert({
    where: {
      email,
    },
    create: {
      name,
      email,
      passwordHash,
      type: SystemUserType.ADMIN,
      status: SystemUserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      profile: {
        create: {},
      },
    },
    update: {
      name,
      passwordHash,
      type: SystemUserType.ADMIN,
      status: SystemUserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      deletedAt: null,
      deletedById: null,
      profile: {
        upsert: {
          create: {},
          update: {
            deletedAt: null,
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      type: true,
      status: true,
    },
  });

  logger.log(`Seeded admin user: ${admin.email} (${admin.id})`);
};

main()
  .catch((error) => {
    logger.error(
      "Failed to seed admin user.",
      error instanceof Error ? error.stack : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
