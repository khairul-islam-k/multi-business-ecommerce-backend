import {
  Body,
  Controller,
  Delete,
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
import { CustomerService } from "./customer.service";
import {
  CreateCustomerDto,
  CustomerAddressDto,
  QueryCustomerDto,
  QueryCustomerOrderDto,
  UpdateCustomerAddressDto,
  UpdateCustomerDto,
} from "./dto/customer.dto";

@ApiTags("Customers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("customers/businesses/:businessId/customers")
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({ summary: "Create customer" })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customers.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({ summary: "Get customers" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryCustomerDto,
  ) {
    return this.customers.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get(":customerId")
  @ApiOperation({ summary: "Get customer" })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
  ) {
    return this.customers.findOne(businessId, customerId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":customerId")
  @ApiOperation({ summary: "Update customer" })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(user, businessId, customerId, dto);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":customerId")
  @ApiOperation({ summary: "Delete customer" })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
  ) {
    return this.customers.remove(user, businessId, customerId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.CREATE)
  @Post(":customerId/addresses")
  @ApiOperation({ summary: "Create customer address" })
  createAddress(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Body() dto: CustomerAddressDto,
  ) {
    return this.customers.createAddress(businessId, customerId, dto);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get(":customerId/addresses")
  @ApiOperation({ summary: "Get customer addresses" })
  findAddresses(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
  ) {
    return this.customers.findAddresses(businessId, customerId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":customerId/addresses/:addressId")
  @ApiOperation({ summary: "Update customer address" })
  updateAddress(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Param("addressId", ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateCustomerAddressDto,
  ) {
    return this.customers.updateAddress(
      businessId,
      customerId,
      addressId,
      dto,
    );
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":customerId/addresses/:addressId")
  @ApiOperation({ summary: "Delete customer address" })
  removeAddress(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Param("addressId", ParseUUIDPipe) addressId: string,
  ) {
    return this.customers.removeAddress(businessId, customerId, addressId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get(":customerId/orders")
  @ApiOperation({ summary: "Get customer orders" })
  findOrders(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Query() query: QueryCustomerOrderDto,
  ) {
    return this.customers.findOrders(businessId, customerId, query);
  }
}
