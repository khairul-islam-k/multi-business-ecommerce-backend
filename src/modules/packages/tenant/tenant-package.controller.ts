import { PermissionAction, RbacFeature } from "@/database/schema";
import {
  Controller,
  ForbiddenException,
  Body,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Public } from "../../auth/decorators/public.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import { QueryPackageDto } from "../dto/query-package.dto";
import { SubscriptionGuard } from "../guards/subscription.guard";
import { PackageSubscriptionService } from "../package-subscription.service";
import { CheckoutPackagePlanDto } from "./dto/tenant-package.dto";
import { TenantPackageService } from "./tenant-package.service";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

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
  @ApiOperation({
    summary: "Get available package plans",
    description:
      "Shows available package plans that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findPlans(@Query() query: QueryPackageDto) {
    return this.packages.findAvailablePlans(query);
  }

  @ApiBearerAuth()
  @UseGuards(SubscriptionGuard)
  @RequirePermission(RbacFeature.PACKAGE_MANAGEMENT, PermissionAction.READ)
  @Get("subscription/current")
  @ApiOperation({
    summary: "Get current subscription",
    description:
      "Shows current subscription that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  getCurrentSubscription(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.packages.getCurrentSubscription(this.getTenantId(currentUser));
  }

  @ApiBearerAuth()
  @RequirePermission(RbacFeature.PACKAGE_MANAGEMENT, PermissionAction.READ)
  @Get("subscription/history")
  @ApiOperation({
    summary: "Get subscription history",
    description:
      "Shows subscription history that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
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
  @ApiOperation({
    summary: "Get subscription usage and limits",
    description:
      "Shows subscription usage and limits that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  getUsage(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.packages.getUsage(this.getTenantId(currentUser));
  }

  @ApiBearerAuth()
  @RequirePermission(RbacFeature.PACKAGE_MANAGEMENT, PermissionAction.CREATE)
  @Post("plans/:planId/checkout")
  @ApiOperation({
    summary: "Create package plan checkout",
    description:
      "Creates package plan checkout using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  checkoutPlan(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param("planId", ParseUUIDPipe) planId: string,
    @Body() dto: CheckoutPackagePlanDto,
  ) {
    return this.packages.checkoutPlan(
      this.getTenantId(currentUser),
      planId,
      dto,
    );
  }

  @ApiBearerAuth()
  @RequirePermission(RbacFeature.PACKAGE_MANAGEMENT, PermissionAction.CREATE)
  @Post("mock-payments/:paymentId/confirm")
  @ApiOperation({
    summary: "Confirm package payment",
    description:
      "Confirms package payment and updates the record so staff can see the action has been accepted.",
  })
  confirmMockPayment(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param("paymentId", ParseUUIDPipe) paymentId: string,
  ) {
    return this.packages.confirmMockPayment(
      this.getTenantId(currentUser),
      paymentId,
    );
  }

  private getTenantId(currentUser: CurrentUserPayload) {
    const tenantId = this.subscriptions.resolveTenantId(currentUser);

    if (!tenantId) {
      throw new ForbiddenException("Tenant context is missing");
    }

    return tenantId;
  }
}
