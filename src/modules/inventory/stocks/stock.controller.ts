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

import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import {
  FulfillOrderAllocationDto,
  QueryStockDto,
  ReleaseOrderAllocationDto,
  ReserveOrderStockDto,
  UpdateStockAlertDto,
} from "./dto/stock.dto";
import { StockService } from "./stock.service";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@ApiTags("Stocks")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("inventory/businesses/:businessId/stocks")
export class StockController {
  constructor(private readonly stocks: StockService) {}

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get stocks",
    description:
      "Shows stocks that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryStockDto,
  ) {
    return this.stocks.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get("movements")
  @ApiOperation({
    summary: "Get stock movements",
    description:
      "Shows stock movements that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findMovements(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryStockDto,
  ) {
    return this.stocks.findMovements(businessId, query);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get(":stockId")
  @ApiOperation({
    summary: "Get stock",
    description:
      "Shows stock that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("stockId", ParseUUIDPipe) stockId: string,
  ) {
    return this.stocks.findOne(businessId, stockId);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("orders/reserve")
  @ApiOperation({
    summary: "Reserve stock for order item",
    description:
      "Reserve stock for order item. Use this endpoint when staff need this business action from the API.",
  })
  reserveForOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: ReserveOrderStockDto,
  ) {
    return this.stocks.reserveForOrder(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("orders/release")
  @ApiOperation({
    summary: "Release order stock reservation",
    description:
      "Release order stock reservation. Use this endpoint when staff need this business action from the API.",
  })
  releaseOrderAllocation(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: ReleaseOrderAllocationDto,
  ) {
    return this.stocks.releaseOrderAllocation(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("orders/fulfill")
  @ApiOperation({
    summary: "Fulfill order stock allocation",
    description:
      "Fulfill order stock allocation. Use this endpoint when staff need this business action from the API.",
  })
  fulfillOrderAllocation(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: FulfillOrderAllocationDto,
  ) {
    return this.stocks.fulfillOrderAllocation(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":stockId/alert")
  @ApiOperation({
    summary: "Update low stock alert",
    description:
      "Updates low stock alert with the new information provided. Only the fields sent in the request are changed.",
  })
  updateAlert(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("stockId", ParseUUIDPipe) stockId: string,
    @Body() dto: UpdateStockAlertDto,
  ) {
    return this.stocks.updateAlert(user, businessId, stockId, dto);
  }
}
