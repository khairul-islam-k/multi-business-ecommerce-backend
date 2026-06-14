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
  CreateProductTagDto,
  UpdateProductTagDto,
} from "./dto/product-tag.dto";
import { ProductTagService } from "./product-tag.service";

@ApiTags("Product Tags")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("product-catalog/businesses/:businessId/tags")
export class ProductTagController {
  constructor(private readonly tags: ProductTagService) {}

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({
    summary: "Create product tag",
    description:
      "Creates product tag using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateProductTagDto,
  ) {
    return this.tags.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get product tags",
    description:
      "Shows product tags that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryCatalogDto,
  ) {
    return this.tags.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.READ)
  @Get(":tagId")
  @ApiOperation({
    summary: "Get product tag",
    description:
      "Shows product tag that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("tagId", ParseUUIDPipe) tagId: string,
  ) {
    return this.tags.findOne(businessId, tagId);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":tagId")
  @ApiOperation({
    summary: "Update product tag",
    description:
      "Updates product tag with the new information provided. Only the fields sent in the request are changed.",
  })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("tagId", ParseUUIDPipe) tagId: string,
    @Body() dto: UpdateProductTagDto,
  ) {
    return this.tags.update(user, businessId, tagId, dto);
  }

  @RequirePermission(RbacFeature.PRODUCT_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":tagId")
  @ApiOperation({
    summary: "Delete product tag",
    description:
      "Deletes product tag from normal day-to-day use. Records may be kept internally when the system needs history for reporting or auditing.",
  })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("tagId", ParseUUIDPipe) tagId: string,
  ) {
    return this.tags.remove(user, businessId, tagId);
  }
}
