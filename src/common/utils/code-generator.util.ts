import { randomBytes } from "node:crypto";

const DEFAULT_RANDOM_LENGTH = 8;

export const generateRandomCode = (
  prefix: string,
  randomLength = DEFAULT_RANDOM_LENGTH,
) => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = randomBytes(Math.ceil(randomLength / 2))
    .toString("hex")
    .slice(0, randomLength)
    .toUpperCase();

  return `${prefix}-${datePart}-${randomPart}`;
};
