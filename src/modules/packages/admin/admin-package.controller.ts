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

import { AdminPackageService } from "./admin-package.service";
import { AdminGuard } from "../../auth/guards/admin.guard";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { QueryPackageDto } from "../dto/query-package.dto";
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

@ApiTags("Admin Packages")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin/packages")
export class AdminPackageController {
  constructor(private readonly packages: AdminPackageService) {}

  @Post("plans")
  @ApiOperation({ summary: "Create package plan" })
  createPlan(@Body() dto: CreatePackagePlanDto) {
    return this.packages.createPlan(dto);
  }

  @Get("plans")
  @ApiOperation({ summary: "Get package plans" })
  findPlans(@Query() query: QueryPackageDto) {
    return this.packages.findPlans(query);
  }

  @Get("plans/:planId")
  @ApiOperation({ summary: "Get package plan details" })
  findPlan(@Param("planId", ParseUUIDPipe) planId: string) {
    return this.packages.findPlan(planId);
  }

  @Patch("plans/:planId")
  @ApiOperation({ summary: "Update package plan" })
  updatePlan(
    @Param("planId", ParseUUIDPipe) planId: string,
    @Body() dto: UpdatePackagePlanDto,
  ) {
    return this.packages.updatePlan(planId, dto);
  }

  @Delete("plans/:planId")
  @ApiOperation({ summary: "Delete package plan" })
  deletePlan(@Param("planId", ParseUUIDPipe) planId: string) {
    return this.packages.deletePlan(planId);
  }

  @Post("subscriptions")
  @ApiOperation({ summary: "Create tenant subscription" })
  createTenantSubscription(@Body() dto: CreateTenantSubscriptionDto) {
    return this.packages.createTenantSubscription(dto);
  }

  @Get("subscriptions")
  @ApiOperation({ summary: "Get tenant subscriptions" })
  findSubscriptions(@Query() query: QueryPackageSubscriptionDto) {
    return this.packages.findSubscriptions(query);
  }

  @Get("subscriptions/:subscriptionId")
  @ApiOperation({ summary: "Get tenant subscription details" })
  findSubscription(
    @Param("subscriptionId", ParseUUIDPipe) subscriptionId: string,
  ) {
    return this.packages.findSubscription(subscriptionId);
  }

  @Patch("subscriptions/:subscriptionId/plan")
  @ApiOperation({ summary: "Change tenant subscription plan" })
  changeTenantSubscriptionPlan(
    @Param("subscriptionId", ParseUUIDPipe) subscriptionId: string,
    @Body() dto: ChangeTenantSubscriptionPlanDto,
  ) {
    return this.packages.changeTenantSubscriptionPlan(subscriptionId, dto);
  }

  @Patch("subscriptions/:subscriptionId/cancel")
  @ApiOperation({ summary: "Cancel tenant subscription" })
  cancelTenantSubscription(
    @Param("subscriptionId", ParseUUIDPipe) subscriptionId: string,
    @Body() dto: CancelPackageSubscriptionDto,
  ) {
    return this.packages.cancelSubscription(subscriptionId, dto);
  }

  @Patch("mock-payments/expire")
  @ApiOperation({ summary: "Expire pending mock payments" })
  expirePendingMockPayments() {
    return this.packages.expirePendingMockPayments();
  }
}
