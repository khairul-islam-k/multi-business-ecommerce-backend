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

import { CurrentCustomer } from "../customer-auth/decorators/current-customer.decorator";
import { CustomerAuthGuard } from "../customer-auth/guards/customer-auth.guard";
import {
  AddStorefrontCartItemDto,
  CancelStorefrontOrderDto,
  CreateStorefrontOrderReturnDto,
  CreateStorefrontReviewDto,
  PlaceStorefrontOrderDto,
  StorefrontCartQueryDto,
  StorefrontOrderQueryDto,
  StorefrontReviewQueryDto,
  UpdateStorefrontCartItemDto,
} from "./dto/storefront-customer.dto";
import { StorefrontCustomerService } from "./storefront-customer.service";

import type { CurrentCustomerPayload } from "../customer-auth/strategies/customer-jwt.strategy";

@ApiTags("Storefront Customers")
@ApiBearerAuth()
@UseGuards(CustomerAuthGuard)
@Controller("storefront/:websiteId/customer")
export class StorefrontCustomerController {
  constructor(
    private readonly storefrontCustomers: StorefrontCustomerService,
  ) {}

  @Get("carts")
  @ApiOperation({ summary: "Get customer carts" })
  findCarts(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Query() query: StorefrontCartQueryDto,
  ) {
    return this.storefrontCustomers.findCarts(customer, websiteId, query);
  }

  @Get("cart")
  @ApiOperation({ summary: "Get active customer cart" })
  getActiveCart(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
  ) {
    return this.storefrontCustomers.getActiveCart(customer, websiteId);
  }

  @Post("cart/items")
  @ApiOperation({ summary: "Add item to active customer cart" })
  addCartItem(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Body() dto: AddStorefrontCartItemDto,
  ) {
    return this.storefrontCustomers.addCartItem(customer, websiteId, dto);
  }

  @Patch("cart/items/:itemId")
  @ApiOperation({ summary: "Update active customer cart item" })
  updateCartItem(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateStorefrontCartItemDto,
  ) {
    return this.storefrontCustomers.updateCartItem(
      customer,
      websiteId,
      itemId,
      dto,
    );
  }

  @Delete("cart/items/:itemId")
  @ApiOperation({ summary: "Remove item from active customer cart" })
  removeCartItem(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
  ) {
    return this.storefrontCustomers.removeCartItem(customer, websiteId, itemId);
  }

  @Delete("cart")
  @ApiOperation({ summary: "Clear active customer cart" })
  clearActiveCart(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
  ) {
    return this.storefrontCustomers.clearActiveCart(customer, websiteId);
  }

  @Post("orders/place")
  @ApiOperation({ summary: "Place active cart as an unpaid order" })
  placeOrder(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Body() dto: PlaceStorefrontOrderDto,
  ) {
    return this.storefrontCustomers.placeOrder(customer, websiteId, dto);
  }

  @Get("orders")
  @ApiOperation({ summary: "Get customer order history" })
  findOrders(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Query() query: StorefrontOrderQueryDto,
  ) {
    return this.storefrontCustomers.findOrders(customer, websiteId, query);
  }

  @Get("orders/:orderId")
  @ApiOperation({ summary: "Get customer order details" })
  findOrder(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
  ) {
    return this.storefrontCustomers.findOrder(customer, websiteId, orderId);
  }

  @Post("orders/:orderId/cancel")
  @ApiOperation({ summary: "Cancel a customer order" })
  cancelOrder(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body() dto: CancelStorefrontOrderDto,
  ) {
    return this.storefrontCustomers.cancelOrder(
      customer,
      websiteId,
      orderId,
      dto,
    );
  }

  @Post("orders/:orderId/return")
  @ApiOperation({ summary: "Request a customer order return" })
  createOrderReturn(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body() dto: CreateStorefrontOrderReturnDto,
  ) {
    return this.storefrontCustomers.createOrderReturn(
      customer,
      websiteId,
      orderId,
      dto,
    );
  }

  @Get("reviews")
  @ApiOperation({ summary: "Get customer product reviews" })
  findReviews(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Query() query: StorefrontReviewQueryDto,
  ) {
    return this.storefrontCustomers.findReviews(customer, websiteId, query);
  }

  @Post("products/reviews")
  @ApiOperation({ summary: "Create customer product review" })
  createReview(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Body() dto: CreateStorefrontReviewDto,
  ) {
    return this.storefrontCustomers.createReview(customer, websiteId, dto);
  }
}
