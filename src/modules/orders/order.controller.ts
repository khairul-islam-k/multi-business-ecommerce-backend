import { PermissionAction, RbacFeature } from "@/database/schema";
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

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../business/guards/business.guard";
import { SubscriptionGuard } from "../packages/guards/subscription.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import {
  AddOrderPaymentDto,
  CreateOrderDto,
  QueryOrderDto,
  QueryOrderReturnDto,
  UpdateOrderReturnStatusDto,
} from "./dto/order.dto";
import { OrderService } from "./order.service";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

@ApiTags("Orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("orders/businesses/:businessId/orders")
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({
    summary: "Create order",
    description:
      "Creates order using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.orders.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get orders",
    description:
      "Shows orders that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryOrderDto,
  ) {
    return this.orders.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get("returns")
  @ApiOperation({
    summary: "Get order returns",
    description:
      "Shows return requests for this business so staff can review what customers sent back or asked to send back.",
  })
  findReturns(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryOrderReturnDto,
  ) {
    return this.orders.findReturns(businessId, query);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get("returns/:returnId")
  @ApiOperation({
    summary: "Get order return",
    description:
      "Shows a single return request with its order and item details so staff can decide the next step.",
  })
  findReturn(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("returnId", ParseUUIDPipe) returnId: string,
  ) {
    return this.orders.findReturn(businessId, returnId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("returns/:returnId/status")
  @ApiOperation({
    summary: "Update order return status",
    description:
      "Moves a return request through review. Requested returns can be approved, rejected, or cancelled; approved returns can be completed or cancelled.",
  })
  updateReturnStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("returnId", ParseUUIDPipe) returnId: string,
    @Body() dto: UpdateOrderReturnStatusDto,
  ) {
    return this.orders.updateReturnStatus(user, businessId, returnId, dto);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get(":orderId")
  @ApiOperation({
    summary: "Get order",
    description:
      "Shows order that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
  ) {
    return this.orders.findOne(businessId, orderId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.UPDATE)
  @Post(":orderId/payments")
  @ApiOperation({
    summary: "Add order payment",
    description:
      "Adds order payment to the selected record and returns the updated information.",
  })
  addPayment(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body() dto: AddOrderPaymentDto,
  ) {
    return this.orders.addPayment(user, businessId, orderId, dto);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":orderId/confirm")
  @ApiOperation({
    summary: "Confirm order",
    description:
      "Marks order as confirmed so staff can track that it has left the starting location.",
  })
  confirm(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
  ) {
    return this.orders.confirm(user, businessId, orderId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":orderId/process")
  @ApiOperation({
    summary: "Process order",
    description:
      "Marks order as processing so staff can track that it has left the starting location.",
  })
  process(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
  ) {
    return this.orders.process(user, businessId, orderId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":orderId/ship")
  @ApiOperation({
    summary: "Ship order",
    description:
      "Marks order as shipped so staff can track that it has left the starting location.",
  })
  ship(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
  ) {
    return this.orders.ship(user, businessId, orderId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":orderId/deliver")
  @ApiOperation({
    summary: "Deliver order",
    description:
      "Marks order as delivered and updates any related stock, courier, or finance records handled by this workflow.",
  })
  deliver(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
  ) {
    return this.orders.deliver(user, businessId, orderId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":orderId/cancel")
  @ApiOperation({
    summary: "Cancel order",
    description:
      "Cancels order when it should not continue. The system also updates related records that depend on this status.",
  })
  cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
  ) {
    return this.orders.cancel(user, businessId, orderId);
  }
}
