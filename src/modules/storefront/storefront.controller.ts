import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ResolveStorefrontDto,
  StorefrontProductQueryDto,
} from "./dto/storefront.dto";
import { StorefrontService } from "./storefront.service";

@ApiTags("Storefront")
@Controller("storefront")
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  @Get("resolve")
  @ApiOperation({ summary: "Resolve published storefront" })
  resolve(
    @Query() query: ResolveStorefrontDto,
    @Headers("host") host?: string,
  ) {
    return this.storefront.resolve(query, host);
  }

  @Get(":websiteId/categories")
  @ApiOperation({ summary: "Get storefront categories" })
  findCategories(@Param("websiteId", ParseUUIDPipe) websiteId: string) {
    return this.storefront.findCategories(websiteId);
  }

  @Get(":websiteId/products")
  @ApiOperation({ summary: "Get storefront products" })
  findProducts(
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Query() query: StorefrontProductQueryDto,
  ) {
    return this.storefront.findProducts(websiteId, query);
  }

  @Get(":websiteId/products/:productId/reviews")
  @ApiOperation({ summary: "Get storefront product reviews" })
  findProductReviews(
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
  ) {
    return this.storefront.findProductReviews(websiteId, productId);
  }

  @Get(":websiteId/products/:productSlug")
  @ApiOperation({ summary: "Get storefront product" })
  findProduct(
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Param("productSlug") productSlug: string,
  ) {
    return this.storefront.findProduct(websiteId, productSlug);
  }
}
