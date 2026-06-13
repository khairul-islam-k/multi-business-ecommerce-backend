import { Prisma } from "@prisma/client";
import { ConflictException } from "@nestjs/common";

export function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function throwConflictOnUnique(error: unknown, message: string): never {
  if (isUniqueConstraintError(error)) {
    throw new ConflictException(message);
  }

  throw error;
}
