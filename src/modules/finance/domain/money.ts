import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export function toMoney(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value);
}

export function isZeroMoney(value: Prisma.Decimal.Value) {
  return toMoney(value).isZero();
}

export function isPositiveMoney(value: Prisma.Decimal.Value) {
  return toMoney(value).greaterThan(0);
}

export function assertPositiveMoney(
  value: Prisma.Decimal.Value,
  message: string,
) {
  if (!isPositiveMoney(value)) {
    throw new BadRequestException(message);
  }
}
