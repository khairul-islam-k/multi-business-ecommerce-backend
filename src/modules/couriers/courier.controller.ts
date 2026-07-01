import { PermissionAction, RbacFeature } from "@/database/schema";
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../business/guards/business.guard";
import { SubscriptionGuard } from "../packages/guards/subscription.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import { CourierService } from "./courier.service";
import {
  BulkUpdateCourierConfigDto,
  QueryCourierConfigDto,
  QueryCourierDto,
  UpdateCourierConfigDto,
} from "./dto/courier.dto";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

@ApiTags("Couriers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("couriers/businesses/:businessId")
export class CourierController {
  constructor(private readonly couriers: CourierService) {}

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Get("couriers")
  @ApiOperation({ summary: "Get predefined couriers" })
  findCouriers(@Query() query: QueryCourierDto) {
    return this.couriers.findCouriers(query);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Get("configs")
  @ApiOperation({ summary: "Get business courier configurations" })
  findConfigs(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryCourierConfigDto,
  ) {
    return this.couriers.findConfigs(businessId, query);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("configs/bulk")
  @ApiOperation({ summary: "Update courier configurations" })
  bulkUpdateConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: BulkUpdateCourierConfigDto,
  ) {
    return this.couriers.bulkUpdateConfig(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("configs/:configId")
  @ApiOperation({ summary: "Update courier configuration" })
  updateConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
    @Body() dto: UpdateCourierConfigDto,
  ) {
    return this.couriers.updateConfig(user, businessId, configId, dto);
  }
}
