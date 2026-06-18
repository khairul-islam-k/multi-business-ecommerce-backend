import { PackageLimitKey } from "@/database/schema";
import { SetMetadata } from "@nestjs/common";

export const PACKAGE_LIMIT_METADATA_KEY = "package_limit";

export type PackageLimitRequirement = {
  limitKey: PackageLimitKey;
  amount?: number;
  filesField?: string;
  bodyField?: string;
};

export const RequirePackageLimit = (
  limitKey: PackageLimitKey,
  options: Omit<PackageLimitRequirement, "limitKey"> = {},
) =>
  SetMetadata(PACKAGE_LIMIT_METADATA_KEY, {
    limitKey,
    ...options,
  } satisfies PackageLimitRequirement);
