import { PermissionAction, RbacFeature } from "@/database/schema";
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

import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import {
  CreateProductReviewDto,
  QueryProductReviewDto,
  UpdateProductReviewStatusDto,
} from "./dto/product-review.dto";
import { ProductReviewService } from "./product-review.service";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@ApiTags("Product Reviews")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("product-catalog/businesses/:businessId/reviews")
export class ProductReviewController {
  constructor(private readonly reviews: ProductReviewService) {}

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({ summary: "Create product review" })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateProductReviewDto,
  ) {
    return this.reviews.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({ summary: "Get product reviews" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryProductReviewDto,
  ) {
    return this.reviews.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":reviewId/status")
  @ApiOperation({ summary: "Update product review status" })
  updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
    @Body() dto: UpdateProductReviewStatusDto,
  ) {
    return this.reviews.updateStatus(user, businessId, reviewId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":reviewId")
  @ApiOperation({ summary: "Delete product review" })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
  ) {
    return this.reviews.remove(user, businessId, reviewId);
  }
}
