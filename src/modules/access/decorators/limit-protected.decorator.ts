import { applyDecorators, UseGuards } from "@nestjs/common";
import { PackageLimitKey } from "@prisma/client";

import { RequirePackageLimit } from "../../packages/decorators/require-package-limit.decorator";
import { PackageLimitGuard } from "../../packages/guards/package-limit.guard";

export function LimitProtected(limitKey: PackageLimitKey, amount = 1) {
  return applyDecorators(
    RequirePackageLimit(limitKey, { amount }),
    UseGuards(PackageLimitGuard),
  );
}
