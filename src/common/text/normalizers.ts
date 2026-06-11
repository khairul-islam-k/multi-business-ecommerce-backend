import { BadRequestException } from "@nestjs/common";

export function normalizeRequiredText(
  value: string,
  message = "Value cannot be empty",
) {
  const normalized = value.trim();

  if (!normalized) {
    throw new BadRequestException(message);
  }

  return normalized;
}

export function normalizeOptionalText(value?: string | null) {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value?.trim();

  return normalized || null;
}

export function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();

  return normalized || null;
}
