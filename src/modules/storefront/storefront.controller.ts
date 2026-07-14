import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ResolveStorefrontVariantDto,
  StorefrontCatalogSearchDto,
  StorefrontProductQueryDto,
  StorefrontProductReviewQueryDto,
} from "./dto/storefront.dto";
import { StorefrontService } from "./storefront.service";

@ApiTags("Storefront")
@Controller("storefront")
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  @Get("resolve")
  @ApiOperation({ summary: "Resolve published storefront" })
  resolve(
    @Headers("host") host?: string,
    @Headers("x-forwarded-host") forwardedHost?: string,
  ) {
    return this.storefront.resolve(this.getRequestHost(host, forwardedHost));
  }

  @Get("categories")
  @ApiOperation({ summary: "Get storefront categories" })
  findCategories(
    @Headers("host") host?: string,
    @Headers("x-forwarded-host") forwardedHost?: string,
    @Query() query?: StorefrontCatalogSearchDto,
  ) {
    return this.storefront.findCategories(
      this.getRequestHost(host, forwardedHost),
      query,
    );
  }

  @Get("brands")
  @ApiOperation({ summary: "Get storefront brands" })
  findBrands(
    @Headers("host") host?: string,
    @Headers("x-forwarded-host") forwardedHost?: string,
    @Query() query?: StorefrontCatalogSearchDto,
  ) {
    return this.storefront.findBrands(
      this.getRequestHost(host, forwardedHost),
      query,
    );
  }

  @Get("tags")
  @ApiOperation({ summary: "Get storefront featured tags" })
  findTags(
    @Headers("host") host?: string,
    @Headers("x-forwarded-host") forwardedHost?: string,
    @Query() query?: StorefrontCatalogSearchDto,
  ) {
    return this.storefront.findTags(
      this.getRequestHost(host, forwardedHost),
      query,
    );
  }

  @Get("products")
  @ApiOperation({ summary: "Get storefront products" })
  findProducts(
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Query() query: StorefrontProductQueryDto,
  ) {
    return this.storefront.findProducts(
      query,
      this.getRequestHost(host, forwardedHost),
    );
  }

  @Get("products/:productId/reviews")
  @ApiOperation({ summary: "Get storefront product reviews" })
  findProductReviews(
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Query() query: StorefrontProductReviewQueryDto,
  ) {
    return this.storefront.findProductReviews(
      this.getRequestHost(host, forwardedHost),
      productId,
      query,
    );
  }

  @Get("products/:productSlug/attributes")
  @ApiOperation({ summary: "Get available storefront product attributes" })
  findProductAttributes(
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("productSlug") productSlug: string,
  ) {
    return this.storefront.findProductAttributes(
      this.getRequestHost(host, forwardedHost),
      productSlug,
    );
  }

  @Post("products/:productSlug/variants/resolve")
  @ApiOperation({ summary: "Resolve a storefront product variant" })
  resolveProductVariant(
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("productSlug") productSlug: string,
    @Body() dto: ResolveStorefrontVariantDto,
  ) {
    return this.storefront.resolveProductVariant(
      this.getRequestHost(host, forwardedHost),
      productSlug,
      dto,
    );
  }

  @Get("products/:productSlug")
  @ApiOperation({ summary: "Get storefront product" })
  findProduct(
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("productSlug") productSlug: string,
  ) {
    return this.storefront.findProduct(
      this.getRequestHost(host, forwardedHost),
      productSlug,
    );
  }

  private getRequestHost(host?: string, forwardedHost?: string) {
    return forwardedHost ?? host;
  }
}
