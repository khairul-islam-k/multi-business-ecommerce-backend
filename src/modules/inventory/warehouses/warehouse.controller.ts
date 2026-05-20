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

import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import {
  CreateWarehouseDto,
  QueryWarehouseDto,
  UpdateWarehouseDto,
} from "./dto/warehouse.dto";
import { WarehouseService } from "./warehouse.service";

@ApiTags("Warehouses")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("inventory/businesses/:businessId/warehouses")
export class WarehouseController {
  constructor(private readonly warehouses: WarehouseService) {}

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({ summary: "Create warehouse" })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateWarehouseDto,
  ) {
    return this.warehouses.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({ summary: "Get warehouses" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryWarehouseDto,
  ) {
    return this.warehouses.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.READ)
  @Get(":warehouseId")
  @ApiOperation({ summary: "Get warehouse" })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("warehouseId", ParseUUIDPipe) warehouseId: string,
  ) {
    return this.warehouses.findOne(businessId, warehouseId);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":warehouseId")
  @ApiOperation({ summary: "Update warehouse" })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("warehouseId", ParseUUIDPipe) warehouseId: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehouses.update(user, businessId, warehouseId, dto);
  }

  @RequirePermission(RbacFeature.INVENTORY_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":warehouseId")
  @ApiOperation({ summary: "Delete warehouse" })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("warehouseId", ParseUUIDPipe) warehouseId: string,
  ) {
    return this.warehouses.remove(user, businessId, warehouseId);
  }
}
