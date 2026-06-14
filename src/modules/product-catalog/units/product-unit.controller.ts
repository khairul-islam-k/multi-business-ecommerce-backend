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
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import { QueryCatalogDto } from "../common/dto/query-catalog.dto";
import {
  CreateProductUnitDto,
  UpdateProductUnitDto,
} from "./dto/product-unit.dto";
import { ProductUnitService } from "./product-unit.service";

@ApiTags("Product Units")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("product-catalog/businesses/:businessId/units")
export class ProductUnitController {
  constructor(private readonly units: ProductUnitService) {}

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({
    summary: "Create product unit",
    description:
      "Creates product unit using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateProductUnitDto,
  ) {
    return this.units.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get product units",
    description:
      "Shows product units that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryCatalogDto,
  ) {
    return this.units.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.READ)
  @Get(":unitId")
  @ApiOperation({
    summary: "Get product unit",
    description:
      "Shows product unit that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("unitId", ParseUUIDPipe) unitId: string,
  ) {
    return this.units.findOne(businessId, unitId);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":unitId")
  @ApiOperation({
    summary: "Update product unit",
    description:
      "Updates product unit with the new information provided. Only the fields sent in the request are changed.",
  })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("unitId", ParseUUIDPipe) unitId: string,
    @Body() dto: UpdateProductUnitDto,
  ) {
    return this.units.update(user, businessId, unitId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":unitId")
  @ApiOperation({
    summary: "Delete product unit",
    description:
      "Deletes product unit from normal day-to-day use. Records may be kept internally when the system needs history for reporting or auditing.",
  })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("unitId", ParseUUIDPipe) unitId: string,
  ) {
    return this.units.remove(user, businessId, unitId);
  }
}
