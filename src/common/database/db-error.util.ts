import { ConflictException, HttpStatus } from "@nestjs/common";

type PostgresError = {
  code?: string;
  cause?: unknown;
  column?: string;
  constraint?: string;
  detail?: string;
  schema?: string;
  table?: string;
};

export type DatabaseErrorMetadata = {
  statusCode: number;
  error: string;
  message: string;
  errors: {
    code: string;
    column?: string;
    constraint?: string;
    schema?: string;
    table?: string;
  };
};

export function isUniqueConstraintError(error: unknown) {
  return getPostgresErrorCode(error) === "23505";
}

export function throwConflictOnUnique(error: unknown, message: string): never {
  if (isUniqueConstraintError(error)) {
    throw new ConflictException(message);
  }

  throw error;
}

export function getDatabaseErrorMetadata(
  error: unknown,
): DatabaseErrorMetadata | null {
  const code = getPostgresErrorCode(error);

  if (!code) {
    return null;
  }

  const fields = getPostgresErrorFields(error);
  const errors = {
    code,
    ...(fields.column && { column: fields.column }),
    ...(fields.constraint && { constraint: fields.constraint }),
    ...(fields.schema && { schema: fields.schema }),
    ...(fields.table && { table: fields.table }),
  };

  if (code === "23505") {
    return {
      statusCode: HttpStatus.CONFLICT,
      error: "Database unique constraint violation",
      message:
        "The database rejected this request because it would create a duplicate record. One of the submitted values must be unique, but another active record already uses it. Please change the duplicate value and try again.",
      errors,
    };
  }

  if (code === "23503") {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      error: "Database foreign key constraint violation",
      message:
        "The database rejected this request because it references another record that does not exist, has been deleted, or is not available in this context. Please verify the related IDs and try again.",
      errors,
    };
  }

  if (code === "23502") {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      error: "Database required field violation",
      message:
        "The database rejected this request because a required field was missing or was saved as null. Please check the request body and provide all required values before trying again.",
      errors,
    };
  }

  if (code === "23514") {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      error: "Database check constraint violation",
      message:
        "The database rejected this request because one or more submitted values do not satisfy the allowed business rules for this table. Please review the values and try again.",
      errors,
    };
  }

  if (code === "22P02") {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      error: "Database invalid value format",
      message:
        "The database rejected this request because one of the submitted values has an invalid format. Please check IDs, numbers, dates, enum values, and other typed fields before trying again.",
      errors,
    };
  }

  if (code === "22001") {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      error: "Database value too long",
      message:
        "The database rejected this request because one of the submitted text values is longer than the column allows. Please shorten the value and try again.",
      errors,
    };
  }

  if (code === "40001" || code === "40P01") {
    return {
      statusCode: HttpStatus.CONFLICT,
      error: "Database transaction conflict",
      message:
        "The database could not complete this request because another transaction changed or locked the same data at the same time. Please retry the request.",
      errors,
    };
  }

  if (
    code.startsWith("08") ||
    code.startsWith("53") ||
    code === "57014" ||
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03"
  ) {
    return {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: "Database service unavailable",
      message:
        "The application could not complete this request because the database is temporarily unavailable, overloaded, restarting, or the query was cancelled. Please try again shortly.",
      errors,
    };
  }

  return {
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    error: "Database operation failed",
    message:
      "The database rejected or failed this request before it could be completed. The response includes the database error code so the issue can be diagnosed without exposing raw SQL or sensitive database details.",
    errors,
  };
}

export function getPostgresErrorCode(error: unknown): string | undefined {
  return getPostgresErrorField(error, "code");
}

function getPostgresErrorFields(error: unknown) {
  return {
    column: getPostgresErrorField(error, "column"),
    constraint: getPostgresErrorField(error, "constraint"),
    schema: getPostgresErrorField(error, "schema"),
    table: getPostgresErrorField(error, "table"),
  };
}

function getPostgresErrorField(
  error: unknown,
  field: keyof PostgresError,
  seen = new Set<unknown>(),
): string | undefined {
  if (typeof error !== "object" || error === null || seen.has(error)) {
    return undefined;
  }

  seen.add(error);

  const record = error as PostgresError;
  const direct = record[field];

  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  return getPostgresErrorField(record.cause, field, seen);
}
