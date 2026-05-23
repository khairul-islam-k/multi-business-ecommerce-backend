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

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../business/guards/business.guard";
import { SubscriptionGuard } from "../packages/guards/subscription.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import {
  AddOrderPaymentDto,
  CreateOrderDto,
  QueryOrderDto,
} from "./dto/order.dto";
import { OrderService } from "./order.service";

@ApiTags("Orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("orders/businesses/:businessId/orders")
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({ summary: "Create order" })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.orders.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({ summary: "Get orders" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryOrderDto,
  ) {
    return this.orders.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get(":orderId")
  @ApiOperation({ summary: "Get order" })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
  ) {
    return this.orders.findOne(businessId, orderId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.UPDATE)
  @Post(":orderId/payments")
  @ApiOperation({ summary: "Add order payment" })
  addPayment(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body() dto: AddOrderPaymentDto,
  ) {
    return this.orders.addPayment(user, businessId, orderId, dto);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":orderId/ship")
  @ApiOperation({ summary: "Ship order" })
  ship(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
  ) {
    return this.orders.ship(user, businessId, orderId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":orderId/deliver")
  @ApiOperation({ summary: "Deliver order" })
  deliver(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
  ) {
    return this.orders.deliver(user, businessId, orderId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":orderId/cancel")
  @ApiOperation({ summary: "Cancel order" })
  cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
  ) {
    return this.orders.cancel(user, businessId, orderId);
  }
}
