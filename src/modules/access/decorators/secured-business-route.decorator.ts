import { applyDecorators, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";

export function SecuredBusinessRoute() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard),
  );
}
