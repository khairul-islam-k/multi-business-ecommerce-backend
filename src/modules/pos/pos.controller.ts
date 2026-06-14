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
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../business/guards/business.guard";
import { SubscriptionGuard } from "../packages/guards/subscription.guard";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import { CreatePosSaleDto } from "./dto/pos-sale.dto";
import { OrderService } from "../orders/order.service";

@ApiTags("POS")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("pos/businesses/:businessId/sales")
export class PosController {
  constructor(private readonly orders: OrderService) {}

  @RequirePermission(RbacFeature.POS_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({
    summary: "Create POS sale",
    description:
      "Creates POS sale using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  createSale(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreatePosSaleDto,
  ) {
    return this.orders.createPosSale(user, businessId, dto);
  }
}
