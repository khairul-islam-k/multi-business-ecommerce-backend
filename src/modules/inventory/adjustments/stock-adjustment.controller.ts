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
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
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
  @ApiOperation({
    summary: "Create stock adjustment",
    description:
      "Creates stock adjustment using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateStockAdjustmentDto,
  ) {
    return this.adjustments.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get stock adjustments",
    description:
      "Shows stock adjustments that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryStockAdjustmentDto,
  ) {
    return this.adjustments.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get(":adjustmentId")
  @ApiOperation({
    summary: "Get stock adjustment",
    description:
      "Shows stock adjustment that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("adjustmentId", ParseUUIDPipe) adjustmentId: string,
  ) {
    return this.adjustments.findOne(businessId, adjustmentId);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":adjustmentId/approve")
  @ApiOperation({
    summary: "Approve stock adjustment",
    description:
      "Approves stock adjustment and applies the business changes that happen after approval.",
  })
  approve(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("adjustmentId", ParseUUIDPipe) adjustmentId: string,
  ) {
    return this.adjustments.approve(user, businessId, adjustmentId);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":adjustmentId/cancel")
  @ApiOperation({
    summary: "Cancel stock adjustment",
    description:
      "Cancels stock adjustment when it should not continue. The system also updates related records that depend on this status.",
  })
  cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("adjustmentId", ParseUUIDPipe) adjustmentId: string,
  ) {
    return this.adjustments.cancel(user, businessId, adjustmentId);
  }
}
