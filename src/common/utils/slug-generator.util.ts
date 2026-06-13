import { randomBytes } from "node:crypto";

type GenerateRandomSlugOptions = {
  fallback?: string;
  maxLength?: number;
  randomLength?: number;
  separator?: string;
};

const DEFAULT_FALLBACK = "item";
const DEFAULT_MAX_LENGTH = 180;
const DEFAULT_RANDOM_LENGTH = 8;
const DEFAULT_SEPARATOR = "-";

export const slugify = (
  value: string,
  options: Pick<GenerateRandomSlugOptions, "fallback" | "maxLength"> = {},
) => {
  const fallback = options.fallback ?? DEFAULT_FALLBACK;
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;

  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return (slug || fallback).slice(0, maxLength).replace(/-+$/g, "");
};

export const generateRandomSlug = (
  value: string,
  options: GenerateRandomSlugOptions = {},
) => {
  const separator = options.separator ?? DEFAULT_SEPARATOR;
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  const randomLength = options.randomLength ?? DEFAULT_RANDOM_LENGTH;
  const suffix = randomBytes(Math.ceil(randomLength / 2))
    .toString("hex")
    .slice(0, randomLength);

  const baseMaxLength = Math.max(
    1,
    maxLength - separator.length - suffix.length,
  );
  const base = slugify(value, {
    fallback: options.fallback,
    maxLength: baseMaxLength,
  });

  return `${base}${separator}${suffix}`;
};
