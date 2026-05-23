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

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
import { PackageLimitGuard } from "../../packages/guards/package-limit.guard";
import { RequirePackageLimit } from "../../packages/decorators/require-package-limit.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { QueryCatalogDto } from "../common/dto/query-catalog.dto";
import { ProductBrandService } from "./product-brand.service";
import {
  CreateProductBrandDto,
  UpdateProductBrandDto,
} from "./dto/product-brand.dto";

@ApiTags("Product Brands")
@ApiBearerAuth()
@UseGuards(
  JwtAuthGuard,
  SubscriptionGuard,
  BusinessGuard,
  PermissionGuard,
  PackageLimitGuard,
)
@Controller("product-catalog/businesses/:businessId/brands")
export class ProductBrandController {
  constructor(private readonly brands: ProductBrandService) {}

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.CREATE,
  )
  @RequirePackageLimit(PackageLimitKey.MAX_BRANDS)
  @Post()
  @ApiOperation({ summary: "Create product brand" })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateProductBrandDto,
  ) {
    return this.brands.create(user, businessId, dto);
  }

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.READ,
  )
  @Get()
  @ApiOperation({ summary: "Get product brands" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryCatalogDto,
  ) {
    return this.brands.findAll(businessId, query);
  }

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.READ,
  )
  @Get(":brandId")
  @ApiOperation({ summary: "Get product brand" })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("brandId", ParseUUIDPipe) brandId: string,
  ) {
    return this.brands.findOne(businessId, brandId);
  }

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.UPDATE,
  )
  @Patch(":brandId")
  @ApiOperation({ summary: "Update product brand" })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("brandId", ParseUUIDPipe) brandId: string,
    @Body() dto: UpdateProductBrandDto,
  ) {
    return this.brands.update(user, businessId, brandId, dto);
  }

  @RequirePermission(
    RbacFeature.PRODUCT_CATALOG_MANAGEMENT,
    PermissionAction.DELETE,
  )
  @Delete(":brandId")
  @ApiOperation({ summary: "Delete product brand" })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("brandId", ParseUUIDPipe) brandId: string,
  ) {
    return this.brands.remove(user, businessId, brandId);
  }
}
