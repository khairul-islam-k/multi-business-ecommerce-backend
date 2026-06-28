import { describe, expect, it } from "@jest/globals";
import { HttpStatus } from "@nestjs/common";

import {
  getDatabaseErrorMetadata,
  isUniqueConstraintError,
} from "./db-error.util";

describe("database error utilities", () => {
  it("detects unique constraint errors from direct postgres errors", () => {
    expect(isUniqueConstraintError({ code: "23505" })).toBe(true);
  });

  it("detects unique constraint errors from wrapped postgres errors", () => {
    expect(isUniqueConstraintError({ cause: { code: "23505" } })).toBe(true);
  });

  it("maps database connection failures to a verbose service-unavailable response", () => {
    const metadata = getDatabaseErrorMetadata({
      code: "08006",
      table: "businesses",
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: "Database service unavailable",
        message: expect.stringContaining(
          "the database is temporarily unavailable",
        ),
        errors: {
          code: "08006",
          table: "businesses",
        },
      }),
    );
  });
});
