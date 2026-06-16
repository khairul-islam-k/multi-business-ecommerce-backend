import { ConflictException } from "@nestjs/common";

type PostgresError = {
  code?: string;
};

export function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as PostgresError).code === "23505"
  );
}

export function throwConflictOnUnique(error: unknown, message: string): never {
  if (isUniqueConstraintError(error)) {
    throw new ConflictException(message);
  }

  throw error;
}
