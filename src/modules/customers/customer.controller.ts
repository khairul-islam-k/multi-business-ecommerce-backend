import { PermissionAction, RbacFeature } from "@/database/schema";
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
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { SecuredBusinessRoute } from "../access/decorators/secured-business-route.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { CustomerService } from "./customer.service";
import {
  CreateCustomerDto,
  CustomerAddressDto,
  QueryCustomerDto,
  QueryCustomerOrderDto,
  UpdateCustomerAddressDto,
  UpdateCustomerDto,
} from "./dto/customer.dto";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

@ApiTags("Customers")
@ApiBearerAuth()
@SecuredBusinessRoute()
@Controller("customers/businesses/:businessId/customers")
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({
    summary: "Create customer",
    description:
      "Creates customer using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customers.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get customers",
    description:
      "Shows customers that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryCustomerDto,
  ) {
    return this.customers.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get(":customerId")
  @ApiOperation({
    summary: "Get customer",
    description:
      "Shows customer that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
  ) {
    return this.customers.findOne(businessId, customerId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":customerId")
  @ApiOperation({
    summary: "Update customer",
    description:
      "Updates customer with the new information provided. Only the fields sent in the request are changed.",
  })
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
  @ApiOperation({
    summary: "Delete customer",
    description:
      "Deletes customer from normal day-to-day use. Records may be kept internally when the system needs history for reporting or auditing.",
  })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
  ) {
    return this.customers.remove(user, businessId, customerId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.CREATE)
  @Post(":customerId/addresses")
  @ApiOperation({
    summary: "Create customer address",
    description:
      "Creates customer address using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  createAddress(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Body() dto: CustomerAddressDto,
  ) {
    return this.customers.createAddress(businessId, customerId, dto);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get(":customerId/addresses")
  @ApiOperation({
    summary: "Get customer addresses",
    description:
      "Shows customer addresses that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAddresses(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
  ) {
    return this.customers.findAddresses(businessId, customerId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":customerId/addresses/:addressId")
  @ApiOperation({
    summary: "Update customer address",
    description:
      "Updates customer address with the new information provided. Only the fields sent in the request are changed.",
  })
  updateAddress(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Param("addressId", ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateCustomerAddressDto,
  ) {
    return this.customers.updateAddress(businessId, customerId, addressId, dto);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":customerId/addresses/:addressId")
  @ApiOperation({
    summary: "Delete customer address",
    description:
      "Deletes customer address from normal day-to-day use. Records may be kept internally when the system needs history for reporting or auditing.",
  })
  removeAddress(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Param("addressId", ParseUUIDPipe) addressId: string,
  ) {
    return this.customers.removeAddress(
      user,
      businessId,
      customerId,
      addressId,
    );
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get(":customerId/orders")
  @ApiOperation({
    summary: "Get customer orders",
    description:
      "Shows customer orders that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOrders(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Query() query: QueryCustomerOrderDto,
  ) {
    return this.customers.findOrders(businessId, customerId, query);
  }
}
