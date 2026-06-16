import { BadRequestException } from "@nestjs/common";
import Decimal from "decimal.js";

export function toMoney(value: Decimal.Value) {
  return new Decimal(value);
}

export function isZeroMoney(value: Decimal.Value) {
  return toMoney(value).isZero();
}

export function isPositiveMoney(value: Decimal.Value) {
  return toMoney(value).greaterThan(0);
}

export function assertPositiveMoney(
  value: Decimal.Value,
  message: string,
) {
  if (!isPositiveMoney(value)) {
    throw new BadRequestException(message);
  }
}

