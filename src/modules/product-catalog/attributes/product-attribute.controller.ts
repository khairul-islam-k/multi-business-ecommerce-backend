import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PackageLimitKey, PermissionAction, RbacFeature } from "@prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
import { PackageLimitGuard } from "../../packages/guards/package-limit.guard";
import { RequirePackageLimit } from "../../packages/decorators/require-package-limit.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { ProductAttributeService } from "./product-attribute.service";
import {
  CreateProductAttributeDto,
  CreateProductAttributeValueDto,
  UpdateProductAttributeDto,
  UpdateProductAttributeValueDto,
} from "./dto/product-attribute.dto";

@ApiTags("Product Attributes")
@ApiBearerAuth()
@UseGuards(
  JwtAuthGuard,
  SubscriptionGuard,
  BusinessGuard,
  PermissionGuard,
  PackageLimitGuard,
)
@Controller(
  "product-catalog/businesses/:businessId/products/:productId/attributes",
)
export class ProductAttributeController {
  constructor(private readonly attributes: ProductAttributeService) {}

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.CREATE,
  )
  @RequirePackageLimit(PackageLimitKey.MAX_ATTRIBUTES)
  @Post()
  @ApiOperation({ summary: "Create product attribute" })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() dto: CreateProductAttributeDto,
  ) {
    return this.attributes.create(user, businessId, productId, dto);
  }

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.READ,
  )
  @Get()
  @ApiOperation({ summary: "Get product attributes" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
  ) {
    return this.attributes.findAll(businessId, productId);
  }

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.UPDATE,
  )
  @Patch(":attributeId")
  @ApiOperation({ summary: "Update product attribute" })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Body() dto: UpdateProductAttributeDto,
  ) {
    return this.attributes.update(
      user,
      businessId,
      productId,
      attributeId,
      dto,
    );
  }

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.DELETE,
  )
  @Delete(":attributeId")
  @ApiOperation({ summary: "Delete product attribute" })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
  ) {
    return this.attributes.remove(user, businessId, productId, attributeId);
  }

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.CREATE,
  )
  @Post(":attributeId/values")
  @ApiOperation({ summary: "Create product attribute value" })
  createValue(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Body() dto: CreateProductAttributeValueDto,
  ) {
    return this.attributes.createValue(
      user,
      businessId,
      productId,
      attributeId,
      dto,
    );
  }

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.UPDATE,
  )
  @Patch(":attributeId/values/:valueId")
  @ApiOperation({ summary: "Update product attribute value" })
  updateValue(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Param("valueId", ParseUUIDPipe) valueId: string,
    @Body() dto: UpdateProductAttributeValueDto,
  ) {
    return this.attributes.updateValue(
      user,
      businessId,
      productId,
      attributeId,
      valueId,
      dto,
    );
  }

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.DELETE,
  )
  @Delete(":attributeId/values/:valueId")
  @ApiOperation({ summary: "Delete product attribute value" })
  removeValue(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Param("valueId", ParseUUIDPipe) valueId: string,
  ) {
    return this.attributes.removeValue(
      user,
      businessId,
      productId,
      attributeId,
      valueId,
    );
  }
}
