import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "@jest/globals";
import { Prisma } from "@prisma/client";

import {
  assertPositiveMoney,
  isPositiveMoney,
  isZeroMoney,
  toMoney,
} from "./money";

describe("money helpers", () => {
  it("creates Prisma decimals without changing precision", () => {
    expect(toMoney("12.34")).toBeInstanceOf(Prisma.Decimal);
    expect(toMoney("12.34").toString()).toBe("12.34");
  });

  it("checks zero and positive values", () => {
    expect(isZeroMoney(0)).toBe(true);
    expect(isPositiveMoney("0.01")).toBe(true);
    expect(isPositiveMoney(0)).toBe(false);
  });

  it("throws for non-positive money", () => {
    expect(() => assertPositiveMoney(0, "Amount is required")).toThrow(
      BadRequestException,
    );
  });
});
