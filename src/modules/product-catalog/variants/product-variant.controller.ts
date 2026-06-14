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
import {
  BulkCreateProductVariantsDto,
  BulkUpdateProductVariantsDto,
  CreateProductVariantDto,
  ProductVariantOptionsDto,
  QueryProductVariantDto,
  UpdateProductVariantAttributesDto,
  UpdateProductVariantDto,
} from "./dto/product-variant.dto";
import { ProductVariantService } from "./product-variant.service";

@ApiTags("Product Variants")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller(
  "product-catalog/businesses/:businessId/products/:productId/variants",
)
export class ProductVariantController {
  constructor(private readonly variants: ProductVariantService) {}

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({
    summary: "Create product variant",
    description:
      "Creates product variant using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() dto: CreateProductVariantDto,
  ) {
    return this.variants.create(user, businessId, productId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.CREATE)
  @Post("bulk")
  @ApiOperation({
    summary: "Create product variants in bulk",
    description:
      "Creates product variants in bulk using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  bulkCreate(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() dto: BulkCreateProductVariantsDto,
  ) {
    return this.variants.bulkCreate(user, businessId, productId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.READ)
  @Post("options")
  @ApiOperation({
    summary: "Resolve product variant options",
    description:
      "Resolves product variant options based on the request details and returns the matching system information.",
  })
  options(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() dto: ProductVariantOptionsDto,
  ) {
    return this.variants.options(businessId, productId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get product variants",
    description:
      "Shows product variants that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Query() query: QueryProductVariantDto,
  ) {
    return this.variants.findAll(businessId, productId, query);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.READ)
  @Get(":variantId")
  @ApiOperation({
    summary: "Get product variant",
    description:
      "Shows product variant that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("variantId", ParseUUIDPipe) variantId: string,
  ) {
    return this.variants.findOne(businessId, productId, variantId);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("bulk")
  @ApiOperation({
    summary: "Update product variants in bulk",
    description:
      "Updates product variants in bulk with the new information provided. Only the fields sent in the request are changed.",
  })
  bulkUpdate(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() dto: BulkUpdateProductVariantsDto,
  ) {
    return this.variants.bulkUpdate(user, businessId, productId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":variantId")
  @ApiOperation({
    summary: "Update product variant",
    description:
      "Updates product variant with the new information provided. Only the fields sent in the request are changed.",
  })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("variantId", ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.variants.update(user, businessId, productId, variantId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":variantId/attributes")
  @ApiOperation({
    summary: "Update product variant attributes",
    description:
      "Updates product variant attributes with the new information provided. Only the fields sent in the request are changed.",
  })
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

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":variantId")
  @ApiOperation({
    summary: "Delete product variant",
    description:
      "Deletes product variant from normal day-to-day use. Records may be kept internally when the system needs history for reporting or auditing.",
  })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("variantId", ParseUUIDPipe) variantId: string,
  ) {
    return this.variants.remove(user, businessId, productId, variantId);
  }
}
