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
import { PermissionAction, RbacFeature } from "@/database/schema";

import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
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
  @ApiOperation({
    summary: "Create stock transfer",
    description:
      "Creates stock transfer using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateStockTransferDto,
  ) {
    return this.transfers.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get stock transfers",
    description:
      "Shows stock transfers that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryStockTransferDto,
  ) {
    return this.transfers.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get(":transferId")
  @ApiOperation({
    summary: "Get stock transfer",
    description:
      "Shows stock transfer that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("transferId", ParseUUIDPipe) transferId: string,
  ) {
    return this.transfers.findOne(businessId, transferId);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":transferId/ship")
  @ApiOperation({
    summary: "Ship stock transfer",
    description:
      "Marks stock transfer as shipped so staff can track that it has left the starting location.",
  })
  ship(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("transferId", ParseUUIDPipe) transferId: string,
  ) {
    return this.transfers.ship(user, businessId, transferId);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":transferId/receive")
  @ApiOperation({
    summary: "Receive stock transfer",
    description:
      "Records stock transfer as received so stock, supplier, and finance information can be brought up to date.",
  })
  receive(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("transferId", ParseUUIDPipe) transferId: string,
  ) {
    return this.transfers.receive(user, businessId, transferId);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":transferId/cancel")
  @ApiOperation({
    summary: "Cancel stock transfer",
    description:
      "Cancels stock transfer when it should not continue. The system also updates related records that depend on this status.",
  })
  cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("transferId", ParseUUIDPipe) transferId: string,
  ) {
    return this.transfers.cancel(user, businessId, transferId);
  }
}
