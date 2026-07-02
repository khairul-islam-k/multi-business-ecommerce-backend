import { PermissionAction, RbacFeature } from "@/database/schema";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
  AddCourierAreaCatalogToZoneDto,
  BulkUpdateCourierConfigDto,
  CreateCourierDeliveryZoneAreaDto,
  CreateCourierDeliveryZoneDto,
  CreateCourierShippingChargeDto,
  PathaoBookShipmentDto,
  PathaoCreateStoreDto,
  PathaoPricePlanDto,
  QueryCourierAreaCatalogDto,
  QueryCourierConfigDto,
  QueryCourierDeliveryZoneDto,
  QueryCourierDto,
  QueryCourierShippingChargeDto,
  UpdateCourierDeliveryZoneAreaDto,
  UpdateCourierDeliveryZoneDto,
  UpdateCourierShippingChargeDto,
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
  @ApiOperation({ summary: "Get predefined couriers" })
  findCouriers(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryCourierDto,
  ) {
    return this.couriers.findCouriers(query);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Get("area-catalog")
  @ApiOperation({ summary: "Get seeded courier area catalog" })
  findAreaCatalog(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryCourierAreaCatalogDto,
  ) {
    return this.couriers.findAreaCatalog(query);
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
  @Get("delivery-zones")
  @ApiOperation({ summary: "Get business courier delivery zones" })
  findDeliveryZones(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryCourierDeliveryZoneDto,
  ) {
    return this.couriers.findDeliveryZones(businessId, query);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.CREATE)
  @Post("delivery-zones")
  @ApiOperation({ summary: "Create courier delivery zone" })
  createDeliveryZone(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateCourierDeliveryZoneDto,
  ) {
    return this.couriers.createDeliveryZone(businessId, dto);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("delivery-zones/:zoneId")
  @ApiOperation({ summary: "Update courier delivery zone" })
  updateDeliveryZone(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("zoneId", ParseUUIDPipe) zoneId: string,
    @Body() dto: UpdateCourierDeliveryZoneDto,
  ) {
    return this.couriers.updateDeliveryZone(businessId, zoneId, dto);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.DELETE)
  @Delete("delivery-zones/:zoneId")
  @ApiOperation({ summary: "Delete courier delivery zone" })
  deleteDeliveryZone(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("zoneId", ParseUUIDPipe) zoneId: string,
  ) {
    return this.couriers.deleteDeliveryZone(user, businessId, zoneId);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.CREATE)
  @Post("delivery-zones/:zoneId/areas")
  @ApiOperation({ summary: "Create courier delivery zone area" })
  createDeliveryZoneArea(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("zoneId", ParseUUIDPipe) zoneId: string,
    @Body() dto: CreateCourierDeliveryZoneAreaDto,
  ) {
    return this.couriers.createDeliveryZoneArea(businessId, zoneId, dto);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.CREATE)
  @Post("delivery-zones/:zoneId/catalog-areas")
  @ApiOperation({ summary: "Add seeded catalog areas to a delivery zone" })
  addCatalogAreasToDeliveryZone(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("zoneId", ParseUUIDPipe) zoneId: string,
    @Body() dto: AddCourierAreaCatalogToZoneDto,
  ) {
    return this.couriers.addCatalogAreasToDeliveryZone(businessId, zoneId, dto);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("delivery-zones/:zoneId/areas/:areaId")
  @ApiOperation({ summary: "Update courier delivery zone area" })
  updateDeliveryZoneArea(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("zoneId", ParseUUIDPipe) zoneId: string,
    @Param("areaId", ParseUUIDPipe) areaId: string,
    @Body() dto: UpdateCourierDeliveryZoneAreaDto,
  ) {
    return this.couriers.updateDeliveryZoneArea(
      businessId,
      zoneId,
      areaId,
      dto,
    );
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.DELETE)
  @Delete("delivery-zones/:zoneId/areas/:areaId")
  @ApiOperation({ summary: "Delete courier delivery zone area" })
  deleteDeliveryZoneArea(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("zoneId", ParseUUIDPipe) zoneId: string,
    @Param("areaId", ParseUUIDPipe) areaId: string,
  ) {
    return this.couriers.deleteDeliveryZoneArea(businessId, zoneId, areaId);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Get("shipping-charges")
  @ApiOperation({ summary: "Get courier shipping charges" })
  findShippingCharges(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryCourierShippingChargeDto,
  ) {
    return this.couriers.findShippingCharges(businessId, query);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.CREATE)
  @Post("shipping-charges")
  @ApiOperation({ summary: "Create courier shipping charge" })
  createShippingCharge(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateCourierShippingChargeDto,
  ) {
    return this.couriers.createShippingCharge(businessId, dto);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("shipping-charges/:chargeId")
  @ApiOperation({ summary: "Update courier shipping charge" })
  updateShippingCharge(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("chargeId", ParseUUIDPipe) chargeId: string,
    @Body() dto: UpdateCourierShippingChargeDto,
  ) {
    return this.couriers.updateShippingCharge(businessId, chargeId, dto);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Get("configs/:configId/pathao/stores")
  @ApiOperation({ summary: "Get Pathao stores" })
  getPathaoStores(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
  ) {
    return this.couriers.getPathaoStores(user, businessId, configId);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.UPDATE)
  @Post("configs/:configId/pathao/stores")
  @ApiOperation({ summary: "Create Pathao store" })
  createPathaoStore(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
    @Body() dto: PathaoCreateStoreDto,
  ) {
    return this.couriers.createPathaoStore(user, businessId, configId, dto);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Get("configs/:configId/pathao/cities")
  @ApiOperation({ summary: "Get Pathao cities" })
  getPathaoCities(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
  ) {
    return this.couriers.getPathaoCities(user, businessId, configId);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Get("configs/:configId/pathao/cities/:cityId/zones")
  @ApiOperation({ summary: "Get Pathao zones by city" })
  getPathaoZones(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
    @Param("cityId", ParseIntPipe) cityId: number,
  ) {
    return this.couriers.getPathaoZones(user, businessId, configId, cityId);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Get("configs/:configId/pathao/zones/:zoneId/areas")
  @ApiOperation({ summary: "Get Pathao areas by zone" })
  getPathaoAreas(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
    @Param("zoneId", ParseIntPipe) zoneId: number,
  ) {
    return this.couriers.getPathaoAreas(user, businessId, configId, zoneId);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Post("configs/:configId/pathao/price-plan")
  @ApiOperation({ summary: "Calculate Pathao price plan" })
  calculatePathaoPrice(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
    @Body() dto: PathaoPricePlanDto,
  ) {
    return this.couriers.calculatePathaoPrice(user, businessId, configId, dto);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Get("configs/:configId/steadfast/balance")
  @ApiOperation({ summary: "Get Steadfast balance" })
  getSteadfastBalance(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
  ) {
    return this.couriers.getSteadfastBalance(businessId, configId);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Get("configs/:configId/steadfast/police-stations")
  @ApiOperation({ summary: "Get Steadfast police stations" })
  getSteadfastPoliceStations(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
  ) {
    return this.couriers.getSteadfastPoliceStations(businessId, configId);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.READ)
  @Get("configs/:configId/redx/areas")
  @ApiOperation({ summary: "Get REDX delivery areas" })
  getRedxAreas(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
    @Query("postCode") postCode?: string,
  ) {
    return this.couriers.getRedxAreas(
      businessId,
      configId,
      postCode ? Number(postCode) : undefined,
    );
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.UPDATE)
  @Post("shipments/:shipmentId/book")
  @ApiOperation({ summary: "Book a local shipment with its courier" })
  bookShipment(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("shipmentId", ParseUUIDPipe) shipmentId: string,
    @Body() dto: PathaoBookShipmentDto,
  ) {
    return this.couriers.bookShipment(user, businessId, shipmentId, dto);
  }

  @RequirePermission(RbacFeature.COURIER_MANAGEMENT, PermissionAction.UPDATE)
  @Post("shipments/:shipmentId/status/sync")
  @ApiOperation({ summary: "Sync courier shipment status" })
  syncShipmentStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("shipmentId", ParseUUIDPipe) shipmentId: string,
  ) {
    return this.couriers.syncShipmentStatus(user, businessId, shipmentId);
  }
}
