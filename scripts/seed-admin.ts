import "dotenv/config";

import * as argon2 from "argon2";

import { Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { createDrizzleScriptClient } from "./database-script-client";
import {
  SystemUserStatus,
  SystemUserType,
  systemUser,
  systemUserProfile,
} from "../src/database/schema";

const database = createDrizzleScriptClient();
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

  const admin = await database.db.transaction(async (tx) => {
    const [existingAdmin] = await tx
      .select({ id: systemUser.id })
      .from(systemUser)
      .where(eq(systemUser.email, email))
      .limit(1);

    const now = new Date();

    const [savedAdmin] = existingAdmin
      ? await tx
          .update(systemUser)
          .set({
            name,
            passwordHash,
            type: SystemUserType.ADMIN,
            status: SystemUserStatus.ACTIVE,
            emailVerifiedAt: now,
            deletedAt: null,
            deletedById: null,
          })
          .where(eq(systemUser.id, existingAdmin.id))
          .returning({
            id: systemUser.id,
            name: systemUser.name,
            email: systemUser.email,
            type: systemUser.type,
            status: systemUser.status,
          })
      : await tx
          .insert(systemUser)
          .values({
            name,
            email,
            passwordHash,
            type: SystemUserType.ADMIN,
            status: SystemUserStatus.ACTIVE,
            emailVerifiedAt: now,
          })
          .returning({
            id: systemUser.id,
            name: systemUser.name,
            email: systemUser.email,
            type: systemUser.type,
            status: systemUser.status,
          });

    const [existingProfile] = await tx
      .select({ id: systemUserProfile.id })
      .from(systemUserProfile)
      .where(eq(systemUserProfile.userId, savedAdmin.id))
      .limit(1);

    if (existingProfile) {
      await tx
        .update(systemUserProfile)
        .set({ deletedAt: null })
        .where(eq(systemUserProfile.id, existingProfile.id));
    } else {
      await tx.insert(systemUserProfile).values({
        userId: savedAdmin.id,
      });
    }

    return savedAdmin;
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
    await database.close();
  });
