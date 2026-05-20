import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PermissionAction, RbacFeature } from "@prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { Public } from "../../auth/decorators/public.decorator";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { QueryPackageDto } from "../dto/query-package.dto";
import { SubscriptionGuard } from "../guards/subscription.guard";
import { PackageSubscriptionService } from "../package-subscription.service";
import { TenantPackageService } from "./tenant-package.service";
import { CancelTenantSubscriptionDto } from "./dto/tenant-package.dto";

@ApiTags("Tenant Packages")
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller("tenant/packages")
export class TenantPackageController {
  constructor(
    private readonly packages: TenantPackageService,
    private readonly subscriptions: PackageSubscriptionService,
  ) {}

  @Public()
  @Get("plans")
  @ApiOperation({ summary: "Get available package plans" })
  findPlans(@Query() query: QueryPackageDto) {
    return this.packages.findAvailablePlans(query);
  }

  @ApiBearerAuth()
  @UseGuards(SubscriptionGuard)
  @RequirePermission(RbacFeature.PACKAGE_MANAGEMENT, PermissionAction.READ)
  @Get("subscription/current")
  @ApiOperation({ summary: "Get current subscription" })
  getCurrentSubscription(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.packages.getCurrentSubscription(this.getTenantId(currentUser));
  }

  @ApiBearerAuth()
  @RequirePermission(RbacFeature.PACKAGE_MANAGEMENT, PermissionAction.READ)
  @Get("subscription/history")
  @ApiOperation({ summary: "Get subscription history" })
  getSubscriptionHistory(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query() query: QueryPackageDto,
  ) {
    return this.packages.getSubscriptionHistory(
      this.getTenantId(currentUser),
      query,
    );
  }

  @ApiBearerAuth()
  @UseGuards(SubscriptionGuard)
  @RequirePermission(RbacFeature.PACKAGE_MANAGEMENT, PermissionAction.READ)
  @Get("subscription/usage")
  @ApiOperation({ summary: "Get subscription usage and limits" })
  getUsage(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.packages.getUsage(this.getTenantId(currentUser));
  }

  @ApiBearerAuth()
  @RequirePermission(RbacFeature.PACKAGE_MANAGEMENT, PermissionAction.CREATE)
  @Post("plans/:planId/checkout")
  @ApiOperation({ summary: "Create package plan checkout" })
  checkoutPlan(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param("planId", ParseUUIDPipe) planId: string,
  ) {
    return this.packages.checkoutPlan(this.getTenantId(currentUser), planId);
  }

  @ApiBearerAuth()
  @RequirePermission(RbacFeature.PACKAGE_MANAGEMENT, PermissionAction.CREATE)
  @Post("mock-payments/:paymentId/confirm")
  @ApiOperation({ summary: "Confirm mock payment" })
  confirmMockPayment(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param("paymentId", ParseUUIDPipe) paymentId: string,
  ) {
    return this.packages.confirmMockPayment(
      this.getTenantId(currentUser),
      paymentId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(SubscriptionGuard)
  @RequirePermission(RbacFeature.PACKAGE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("subscription/cancel")
  @ApiOperation({ summary: "Cancel current subscription" })
  cancelSubscription(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: CancelTenantSubscriptionDto,
  ) {
    return this.packages.cancelSubscription(this.getTenantId(currentUser), dto);
  }

  private getTenantId(currentUser: CurrentUserPayload) {
    const tenantId = this.subscriptions.resolveTenantId(currentUser);

    if (!tenantId) {
      throw new ForbiddenException("Tenant context is missing");
    }

    return tenantId;
  }
}
