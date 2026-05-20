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
import { PermissionAction, RbacFeature } from "@prisma/client";

import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import { QueryStockDto, UpdateStockAlertDto } from "./dto/stock.dto";
import { StockService } from "./stock.service";

@ApiTags("Stocks")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("inventory/businesses/:businessId/stocks")
export class StockController {
  constructor(private readonly stocks: StockService) {}

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({ summary: "Get stocks" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryStockDto,
  ) {
    return this.stocks.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get("movements")
  @ApiOperation({ summary: "Get stock movements" })
  findMovements(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryStockDto,
  ) {
    return this.stocks.findMovements(businessId, query);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get(":stockId")
  @ApiOperation({ summary: "Get stock" })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("stockId", ParseUUIDPipe) stockId: string,
  ) {
    return this.stocks.findOne(businessId, stockId);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":stockId/alert")
  @ApiOperation({ summary: "Update low stock alert" })
  updateAlert(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("stockId", ParseUUIDPipe) stockId: string,
    @Body() dto: UpdateStockAlertDto,
  ) {
    return this.stocks.updateAlert(user, businessId, stockId, dto);
  }
}
