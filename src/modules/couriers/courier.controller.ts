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
import { CourierService } from "./courier.service";
import {
  AssignCourierToOrderDto,
  BulkUpdateCourierConfigDto,
  QueryCourierConfigDto,
  QueryCourierDto,
  RedxAreaQueryDto,
  RedxChargeQuoteDto,
  RedxCreatePickupStoreDto,
  UpdateCourierConfigDto,
} from "./dto/courier.dto";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

@ApiTags("Couriers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("couriers/businesses/:businessId")
export class CourierController {
  constructor(private readonly couriers: CourierService) {}

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Get("couriers")
  @ApiOperation({ summary: "Get predefined REDX courier" })
  findCouriers(@Query() query: QueryCourierDto) {
    return this.couriers.findCouriers(query);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Get("configs")
  @ApiOperation({ summary: "Get business courier configurations" })
  findConfigs(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryCourierConfigDto,
  ) {
    return this.couriers.findConfigs(businessId, query);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("configs/bulk")
  @ApiOperation({ summary: "Update courier configurations" })
  bulkUpdateConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: BulkUpdateCourierConfigDto,
  ) {
    return this.couriers.bulkUpdateConfig(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("configs/:configId")
  @ApiOperation({ summary: "Update courier configuration" })
  updateConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
    @Body() dto: UpdateCourierConfigDto,
  ) {
    return this.couriers.updateConfig(user, businessId, configId, dto);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Get("configs/:configId/redx/areas")
  @ApiOperation({ summary: "Get REDX delivery areas" })
  getRedxAreas(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
    @Query() query: RedxAreaQueryDto,
  ) {
    return this.couriers.getRedxAreas(businessId, configId, query);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Post("configs/:configId/redx/charge")
  @ApiOperation({ summary: "Calculate REDX delivery charge" })
  calculateRedxCharge(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
    @Body() dto: RedxChargeQuoteDto,
  ) {
    return this.couriers.calculateRedxCharge(businessId, configId, dto);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Get("configs/:configId/redx/pickup-stores")
  @ApiOperation({ summary: "List REDX pickup stores" })
  listRedxPickupStores(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
  ) {
    return this.couriers.listRedxPickupStores(businessId, configId);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.CREATE)
  @Post("configs/:configId/redx/pickup-stores")
  @ApiOperation({ summary: "Create REDX pickup store" })
  createRedxPickupStore(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
    @Body() dto: RedxCreatePickupStoreDto,
  ) {
    return this.couriers.createRedxPickupStore(businessId, configId, dto);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Get("configs/:configId/redx/pickup-stores/:storeId")
  @ApiOperation({ summary: "Get REDX pickup store details" })
  getRedxPickupStore(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
    @Param("storeId") storeId: string,
  ) {
    return this.couriers.getRedxPickupStore(businessId, configId, storeId);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.UPDATE)
  @Post("orders/:orderId/assign")
  @ApiOperation({ summary: "Assign REDX courier to an existing order" })
  assignCourierToOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body() dto: AssignCourierToOrderDto,
  ) {
    return this.couriers.assignCourierToOrder(user, businessId, orderId, dto);
  }
}
