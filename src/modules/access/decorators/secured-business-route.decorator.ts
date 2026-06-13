import { applyDecorators, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
import { PermissionGuard } from "../../permissions/guards/permission.guard";

export function SecuredBusinessRoute() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard),
  );
}
