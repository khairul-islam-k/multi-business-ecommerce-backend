import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { AdminGuard } from "../../auth/guards/admin.guard";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { QueryPackageDto } from "../dto/query-package.dto";
import { AdminPackageService } from "./admin-package.service";
import {
  CreatePackagePlanDto,
  UpdatePackagePlanDto,
} from "./dto/package-plan.dto";
import {
  CancelPackageSubscriptionDto,
  ChangeTenantSubscriptionPlanDto,
  CreateTenantSubscriptionDto,
  QueryPackageSubscriptionDto,
} from "./dto/package-subscription.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@ApiTags("Admin Packages")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin/packages")
export class AdminPackageController {
  constructor(private readonly packages: AdminPackageService) {}

  @Post("plans")
  @ApiOperation({
    summary: "Create package plan",
    description:
      "Creates package plan using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  createPlan(@Body() dto: CreatePackagePlanDto) {
    return this.packages.createPlan(dto);
  }

  @Get("plans")
  @ApiOperation({
    summary: "Get package plans",
    description:
      "Shows package plans that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findPlans(@Query() query: QueryPackageDto) {
    return this.packages.findPlans(query);
  }

  @Get("plans/:planId")
  @ApiOperation({
    summary: "Get package plan details",
    description:
      "Shows package plan details that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findPlan(@Param("planId", ParseUUIDPipe) planId: string) {
    return this.packages.findPlan(planId);
  }

  @Patch("plans/:planId")
  @ApiOperation({
    summary: "Update package plan",
    description:
      "Updates package plan with the new information provided. Only the fields sent in the request are changed.",
  })
  updatePlan(
    @Param("planId", ParseUUIDPipe) planId: string,
    @Body() dto: UpdatePackagePlanDto,
  ) {
    return this.packages.updatePlan(planId, dto);
  }

  @Delete("plans/:planId")
  @ApiOperation({
    summary: "Delete package plan",
    description:
      "Deletes package plan from normal day-to-day use. Records may be kept internally when the system needs history for reporting or auditing.",
  })
  deletePlan(
    @CurrentUser() user: CurrentUserPayload,
    @Param("planId", ParseUUIDPipe) planId: string,
  ) {
    return this.packages.deletePlan(user, planId);
  }

  @Post("subscriptions")
  @ApiOperation({
    summary: "Create tenant subscription",
    description:
      "Creates tenant subscription using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  createTenantSubscription(@Body() dto: CreateTenantSubscriptionDto) {
    return this.packages.createTenantSubscription(dto);
  }

  @Get("subscriptions")
  @ApiOperation({
    summary: "Get tenant subscriptions",
    description:
      "Shows tenant subscriptions that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findSubscriptions(@Query() query: QueryPackageSubscriptionDto) {
    return this.packages.findSubscriptions(query);
  }

  @Get("subscriptions/:subscriptionId")
  @ApiOperation({
    summary: "Get tenant subscription details",
    description:
      "Shows tenant subscription details that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findSubscription(
    @Param("subscriptionId", ParseUUIDPipe) subscriptionId: string,
  ) {
    return this.packages.findSubscription(subscriptionId);
  }

  @Patch("subscriptions/:subscriptionId/plan")
  @ApiOperation({
    summary: "Change tenant subscription plan",
    description:
      "Change tenant subscription plan. Use this endpoint when staff need this business action from the API.",
  })
  changeTenantSubscriptionPlan(
    @Param("subscriptionId", ParseUUIDPipe) subscriptionId: string,
    @Body() dto: ChangeTenantSubscriptionPlanDto,
  ) {
    return this.packages.changeTenantSubscriptionPlan(subscriptionId, dto);
  }

  @Patch("subscriptions/:subscriptionId/cancel")
  @ApiOperation({
    summary: "Cancel tenant subscription",
    description:
      "Cancels tenant subscription when it should not continue. The system also updates related records that depend on this status.",
  })
  cancelTenantSubscription(
    @Param("subscriptionId", ParseUUIDPipe) subscriptionId: string,
    @Body() dto: CancelPackageSubscriptionDto,
  ) {
    return this.packages.cancelSubscription(subscriptionId, dto);
  }

  @Patch("mock-payments/expire")
  @ApiOperation({
    summary: "Expire pending package payments",
    description:
      "Expires pending package payments that should no longer remain pending.",
  })
  expirePendingMockPayments() {
    return this.packages.expirePendingMockPayments();
  }
}
