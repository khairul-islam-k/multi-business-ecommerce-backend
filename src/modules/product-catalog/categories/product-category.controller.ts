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
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
} from "./dto/product-category.dto";
import { ProductCategoryService } from "./product-category.service";

@ApiTags("Product Categories")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("product-catalog/businesses/:businessId/categories")
export class ProductCategoryController {
  constructor(private readonly categories: ProductCategoryService) {}

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({
    summary: "Create product category",
    description:
      "Creates product category using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateProductCategoryDto,
  ) {
    return this.categories.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get product categories",
    description:
      "Shows product categories that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryCatalogDto,
  ) {
    return this.categories.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.READ)
  @Get(":categoryId")
  @ApiOperation({
    summary: "Get product category",
    description:
      "Shows product category that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("categoryId", ParseUUIDPipe) categoryId: string,
  ) {
    return this.categories.findOne(businessId, categoryId);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":categoryId")
  @ApiOperation({
    summary: "Update product category",
    description:
      "Updates product category with the new information provided. Only the fields sent in the request are changed.",
  })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("categoryId", ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateProductCategoryDto,
  ) {
    return this.categories.update(user, businessId, categoryId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":categoryId")
  @ApiOperation({
    summary: "Delete product category",
    description:
      "Deletes product category from normal day-to-day use. Records may be kept internally when the system needs history for reporting or auditing.",
  })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("categoryId", ParseUUIDPipe) categoryId: string,
  ) {
    return this.categories.remove(user, businessId, categoryId);
  }
}
