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
  CreateStockTransferDto,
  QueryStockTransferDto,
} from "./dto/stock-transfer.dto";
import { StockTransferService } from "./stock-transfer.service";

@ApiTags("Stock Transfers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("inventory/businesses/:businessId/stock-transfers")
export class StockTransferController {
  constructor(private readonly transfers: StockTransferService) {}

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({ summary: "Create stock transfer" })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateStockTransferDto,
  ) {
    return this.transfers.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({ summary: "Get stock transfers" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryStockTransferDto,
  ) {
    return this.transfers.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get(":transferId")
  @ApiOperation({ summary: "Get stock transfer" })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("transferId", ParseUUIDPipe) transferId: string,
  ) {
    return this.transfers.findOne(businessId, transferId);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":transferId/ship")
  @ApiOperation({ summary: "Ship stock transfer" })
  ship(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("transferId", ParseUUIDPipe) transferId: string,
  ) {
    return this.transfers.ship(user, businessId, transferId);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":transferId/receive")
  @ApiOperation({ summary: "Receive stock transfer" })
  receive(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("transferId", ParseUUIDPipe) transferId: string,
  ) {
    return this.transfers.receive(user, businessId, transferId);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":transferId/cancel")
  @ApiOperation({ summary: "Cancel stock transfer" })
  cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("transferId", ParseUUIDPipe) transferId: string,
  ) {
    return this.transfers.cancel(user, businessId, transferId);
  }
}
