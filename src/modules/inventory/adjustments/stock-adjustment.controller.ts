import {
  Body,
  Controller,
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

import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import {
  CreateStockAdjustmentDto,
  QueryStockAdjustmentDto,
} from "./dto/stock-adjustment.dto";
import { StockAdjustmentService } from "./stock-adjustment.service";

@ApiTags("Stock Adjustments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("inventory/businesses/:businessId/stock-adjustments")
export class StockAdjustmentController {
  constructor(private readonly adjustments: StockAdjustmentService) {}

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({ summary: "Create stock adjustment" })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateStockAdjustmentDto,
  ) {
    return this.adjustments.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({ summary: "Get stock adjustments" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryStockAdjustmentDto,
  ) {
    return this.adjustments.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get(":adjustmentId")
  @ApiOperation({ summary: "Get stock adjustment" })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("adjustmentId", ParseUUIDPipe) adjustmentId: string,
  ) {
    return this.adjustments.findOne(businessId, adjustmentId);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":adjustmentId/approve")
  @ApiOperation({ summary: "Approve stock adjustment" })
  approve(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("adjustmentId", ParseUUIDPipe) adjustmentId: string,
  ) {
    return this.adjustments.approve(user, businessId, adjustmentId);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":adjustmentId/cancel")
  @ApiOperation({ summary: "Cancel stock adjustment" })
  cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("adjustmentId", ParseUUIDPipe) adjustmentId: string,
  ) {
    return this.adjustments.cancel(user, businessId, adjustmentId);
  }
}
