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
import { PackageLimitKey, PermissionAction, RbacFeature } from "@prisma/client";

import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { RequirePackageLimit } from "../../packages/decorators/require-package-limit.decorator";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { PackageLimitGuard } from "../../packages/guards/package-limit.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import {
  CreateProductDto,
  QueryProductDto,
  UpdateProductDto,
} from "./dto/product.dto";
import { ProductService } from "./product.service";

@ApiTags("Products")
@ApiBearerAuth()
@UseGuards(
  JwtAuthGuard,
  SubscriptionGuard,
  BusinessGuard,
  PermissionGuard,
  PackageLimitGuard,
)
@Controller("product-catalog/businesses/:businessId/products")
export class ProductController {
  constructor(private readonly products: ProductService) {}

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.CREATE)
  @RequirePackageLimit(PackageLimitKey.MAX_PRODUCTS)
  @Post()
  @ApiOperation({
    summary: "Create product",
    description:
      "Creates product using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.products.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get products",
    description:
      "Shows products that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryProductDto,
  ) {
    return this.products.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.READ)
  @Get(":productId")
  @ApiOperation({
    summary: "Get product",
    description:
      "Shows product that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
  ) {
    return this.products.findOne(businessId, productId);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":productId")
  @ApiOperation({
    summary: "Update product",
    description:
      "Updates product with the new information provided. Only the fields sent in the request are changed.",
  })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(user, businessId, productId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":productId")
  @ApiOperation({
    summary: "Delete product",
    description:
      "Deletes product from normal day-to-day use. Records may be kept internally when the system needs history for reporting or auditing.",
  })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
  ) {
    return this.products.remove(user, businessId, productId);
  }
}
