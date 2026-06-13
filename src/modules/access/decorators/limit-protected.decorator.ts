import { PackageLimitKey } from "@prisma/client";
import { applyDecorators, UseGuards } from "@nestjs/common";

import { PackageLimitGuard } from "../../packages/guards/package-limit.guard";
import { RequirePackageLimit } from "../../packages/decorators/require-package-limit.decorator";

export function LimitProtected(limitKey: PackageLimitKey, amount = 1) {
  return applyDecorators(
    RequirePackageLimit(limitKey, { amount }),
    UseGuards(PackageLimitGuard),
  );
}
