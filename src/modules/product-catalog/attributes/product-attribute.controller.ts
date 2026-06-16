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
import { PermissionAction, RbacFeature } from "@/database/schema";

import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import {
  CreateProductAttributeDto,
  CreateProductAttributeValueDto,
  QueryProductAttributeDto,
  UpdateProductAttributeDto,
  UpdateProductAttributeValueDto,
} from "./dto/product-attribute.dto";
import { ProductAttributeService } from "./product-attribute.service";

@ApiTags("Product Attributes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("product-catalog/businesses/:businessId/attributes")
export class ProductAttributeController {
  constructor(private readonly attributes: ProductAttributeService) {}

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({
    summary: "Create product attribute",
    description:
      "Creates product attribute using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateProductAttributeDto,
  ) {
    return this.attributes.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get product attributes",
    description:
      "Shows product attributes that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryProductAttributeDto,
  ) {
    return this.attributes.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.READ)
  @Get(":attributeId")
  @ApiOperation({
    summary: "Get product attribute",
    description:
      "Shows product attribute that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
  ) {
    return this.attributes.findOne(businessId, attributeId);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":attributeId")
  @ApiOperation({
    summary: "Update product attribute",
    description:
      "Updates product attribute with the new information provided. Only the fields sent in the request are changed.",
  })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Body() dto: UpdateProductAttributeDto,
  ) {
    return this.attributes.update(user, businessId, attributeId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":attributeId")
  @ApiOperation({
    summary: "Delete product attribute",
    description:
      "Deletes product attribute from normal day-to-day use. Records may be kept internally when the system needs history for reporting or auditing.",
  })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
  ) {
    return this.attributes.remove(user, businessId, attributeId);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.CREATE)
  @Post(":attributeId/values")
  @ApiOperation({
    summary: "Create product attribute value",
    description:
      "Creates product attribute value using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  createValue(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Body() dto: CreateProductAttributeValueDto,
  ) {
    return this.attributes.createValue(user, businessId, attributeId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":attributeId/values/:valueId")
  @ApiOperation({
    summary: "Update product attribute value",
    description:
      "Updates product attribute value with the new information provided. Only the fields sent in the request are changed.",
  })
  updateValue(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Param("valueId", ParseUUIDPipe) valueId: string,
    @Body() dto: UpdateProductAttributeValueDto,
  ) {
    return this.attributes.updateValue(
      user,
      businessId,
      attributeId,
      valueId,
      dto,
    );
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":attributeId/values/:valueId")
  @ApiOperation({
    summary: "Delete product attribute value",
    description:
      "Deletes product attribute value from normal day-to-day use. Records may be kept internally when the system needs history for reporting or auditing.",
  })
  removeValue(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Param("valueId", ParseUUIDPipe) valueId: string,
  ) {
    return this.attributes.removeValue(user, businessId, attributeId, valueId);
  }
}
