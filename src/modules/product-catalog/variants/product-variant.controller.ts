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
import { ProductVariantService } from "./product-variant.service";
import {
  CreateProductVariantDto,
  UpdateProductVariantAttributesDto,
  UpdateProductVariantDto,
} from "./dto/product-variant.dto";

@ApiTags("Product Variants")
@ApiBearerAuth()
@UseGuards(
  JwtAuthGuard,
  SubscriptionGuard,
  BusinessGuard,
  PermissionGuard,
  PackageLimitGuard,
)
@Controller(
  "product-catalog/businesses/:businessId/products/:productId/variants",
)
export class ProductVariantController {
  constructor(private readonly variants: ProductVariantService) {}

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.CREATE,
  )
  @RequirePackageLimit(PackageLimitKey.MAX_VARIANTS)
  @Post()
  @ApiOperation({ summary: "Create product variant" })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() dto: CreateProductVariantDto,
  ) {
    return this.variants.create(user, businessId, productId, dto);
  }

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.READ,
  )
  @Get()
  @ApiOperation({ summary: "Get product variants" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
  ) {
    return this.variants.findAll(businessId, productId);
  }

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.READ,
  )
  @Get(":variantId")
  @ApiOperation({ summary: "Get product variant" })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("variantId", ParseUUIDPipe) variantId: string,
  ) {
    return this.variants.findOne(businessId, productId, variantId);
  }

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.UPDATE,
  )
  @Patch(":variantId")
  @ApiOperation({ summary: "Update product variant" })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("variantId", ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.variants.update(user, businessId, productId, variantId, dto);
  }

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.UPDATE,
  )
  @Patch(":variantId/attributes")
  @ApiOperation({ summary: "Update product variant attributes" })
  updateAttributes(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("variantId", ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateProductVariantAttributesDto,
  ) {
    return this.variants.updateAttributes(
      user,
      businessId,
      productId,
      variantId,
      dto.attributes,
    );
  }

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.DELETE,
  )
  @Delete(":variantId")
  @ApiOperation({ summary: "Delete product variant" })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("variantId", ParseUUIDPipe) variantId: string,
  ) {
    return this.variants.remove(user, businessId, productId, variantId);
  }
}
