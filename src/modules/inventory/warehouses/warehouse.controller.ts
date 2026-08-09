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
  AssignCourierStore,
  CreateWarehouseDto,
  QueryWarehouseDto,
  UpdateWarehouseDto,
} from "./dto/warehouse.dto";
import { WarehouseService } from "./warehouse.service";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@ApiTags("Warehouses")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("inventory/businesses/:businessId/warehouses")
export class WarehouseController {
  constructor(private readonly warehouses: WarehouseService) {}

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({
    summary: "Create warehouse",
    description:
      "Creates warehouse using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateWarehouseDto,
  ) {
    return this.warehouses.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get warehouses",
    description:
      "Shows warehouses that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryWarehouseDto,
  ) {
    return this.warehouses.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get(":warehouseId")
  @ApiOperation({
    summary: "Get warehouse",
    description:
      "Shows warehouse that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("warehouseId", ParseUUIDPipe) warehouseId: string,
  ) {
    return this.warehouses.findOne(businessId, warehouseId);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":warehouseId")
  @ApiOperation({
    summary: "Update warehouse",
    description:
      "Updates warehouse with the new information provided. Only the fields sent in the request are changed.",
  })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("warehouseId", ParseUUIDPipe) warehouseId: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehouses.update(user, businessId, warehouseId, dto);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":warehouseId/assign_courier")
  @ApiOperation({
    summary: "Assign courier store",
    description:
      "Updates warehouse with the new information provided. Only the fields sent in the request are changed.",
  })
  assignCourierStore(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("warehouseId", ParseUUIDPipe) warehouseId: string,
    @Body() dto: AssignCourierStore,
  ) {
    return this.warehouses.assignCourierStore(businessId, warehouseId, dto);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":warehouseId")
  @ApiOperation({
    summary: "Delete warehouse",
    description:
      "Deletes warehouse from normal day-to-day use. Records may be kept internally when the system needs history for reporting or auditing.",
  })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("warehouseId", ParseUUIDPipe) warehouseId: string,
  ) {
    return this.warehouses.remove(user, businessId, warehouseId);
  }
}
