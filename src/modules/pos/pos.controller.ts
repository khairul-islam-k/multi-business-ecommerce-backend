import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PermissionAction, RbacFeature } from "@prisma/client";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../business/guards/business.guard";
import { OrderService } from "../orders/order.service";
import { SubscriptionGuard } from "../packages/guards/subscription.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import { CreatePosSaleDto } from "./dto/pos-sale.dto";

@ApiTags("POS")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("pos/businesses/:businessId/sales")
export class PosController {
  constructor(private readonly orders: OrderService) {}

  @RequirePermission(RbacFeature.POS_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({ summary: "Create POS sale" })
  createSale(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreatePosSaleDto,
  ) {
    return this.orders.createPosSale(user, businessId, dto);
  }
}
