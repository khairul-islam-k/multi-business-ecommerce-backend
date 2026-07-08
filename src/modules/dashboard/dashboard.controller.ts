import { PermissionAction, RbacFeature } from "@/database/schema";
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AdminGuard } from "../auth/guards/admin.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../business/guards/business.guard";
import { CurrentCustomer } from "../customer-auth/decorators/current-customer.decorator";
import { CustomerAuthGuard } from "../customer-auth/guards/customer-auth.guard";
import { SubscriptionGuard } from "../packages/guards/subscription.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import { DashboardService } from "./dashboard.service";
import { OverviewQueryDto } from "./dto/dashboard.dto";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import type { CurrentCustomerPayload } from "../customer-auth/strategies/customer-jwt.strategy";

@ApiTags("Dashboards")
@Controller("dashboards")
export class DashboardController {
  constructor(private readonly dashboards: DashboardService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("admin/overview")
  @ApiOperation({ summary: "Get admin dashboard overview" })
  adminOverview(@Query() query: OverviewQueryDto) {
    return this.dashboards.adminOverview(query);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerAuthGuard)
  @Get("customer/overview")
  @ApiOperation({ summary: "Get storefront customer dashboard overview" })
  customerOverview(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Query() query: OverviewQueryDto,
  ) {
    return this.dashboards.customerOverview(
      customer.customerId,
      customer.businessId,
      query,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
  @RequirePermission(RbacFeature.BUSINESS_MANAGEMENT, PermissionAction.READ)
  @Get("businesses/:businessId/overview/general")
  @ApiOperation({ summary: "Get tenant general dashboard overview" })
  tenantGeneralOverview(
    @CurrentUser() _user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: OverviewQueryDto,
  ) {
    return this.dashboards.tenantGeneralOverview(businessId, query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get("businesses/:businessId/overview/orders")
  @ApiOperation({ summary: "Get tenant order dashboard overview" })
  tenantOrdersOverview(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: OverviewQueryDto,
  ) {
    return this.dashboards.tenantOrdersOverview(businessId, query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get("businesses/:businessId/overview/finance")
  @ApiOperation({ summary: "Get tenant finance dashboard overview" })
  tenantFinanceOverview(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: OverviewQueryDto,
  ) {
    return this.dashboards.tenantFinanceOverview(businessId, query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get("businesses/:businessId/overview/inventory")
  @ApiOperation({ summary: "Get tenant inventory dashboard overview" })
  tenantInventoryOverview(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: OverviewQueryDto,
  ) {
    return this.dashboards.tenantInventoryOverview(businessId, query);
  }
}
