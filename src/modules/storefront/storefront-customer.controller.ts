import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { QueryCustomerInvoiceDto } from "../orders/dto/order.dto";
import {
  AddStorefrontCartItemDto,
  CancelStorefrontOrderDto,
  CreateStorefrontCustomerAddressDto,
  CreateStorefrontOrderReturnDto,
  CreateStorefrontReviewDto,
  PlaceStorefrontOrderDto,
  StorefrontAddressQueryDto,
  StorefrontCartQueryDto,
  StorefrontOrderQueryDto,
  StorefrontOrderReturnQueryDto,
  StorefrontReviewQueryDto,
  StorefrontWishlistItemDto,
  StorefrontWishlistQueryDto,
  UpdateStorefrontCartItemDto,
  UpdateStorefrontCustomerAddressDto,
} from "./dto/storefront-customer.dto";
import { StorefrontCustomerService } from "./storefront-customer.service";

import type { CurrentCustomerPayload } from "../customer-auth/strategies/customer-jwt.strategy";

@ApiTags("Storefront Customers")
@ApiBearerAuth()
@UseGuards(CustomerAuthGuard)
@Controller("storefront/customer")
export class StorefrontCustomerController {
  constructor(
    private readonly storefrontCustomers: StorefrontCustomerService,
  ) {}

  @Get("addresses")
  @ApiOperation({ summary: "Get customer addresses" })
  findAddresses(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Query() query: StorefrontAddressQueryDto,
  ) {
    return this.storefrontCustomers.findAddresses(
      customer,
      this.getRequestHost(host, forwardedHost),
      query,
    );
  }

  @Get("addresses/:addressId")
  @ApiOperation({ summary: "Get customer address" })
  findAddress(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("addressId", ParseUUIDPipe) addressId: string,
  ) {
    return this.storefrontCustomers.findAddress(
      customer,
      this.getRequestHost(host, forwardedHost),
      addressId,
    );
  }

  @Post("addresses")
  @ApiOperation({ summary: "Create customer address" })
  createAddress(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Body() dto: CreateStorefrontCustomerAddressDto,
  ) {
    return this.storefrontCustomers.createAddress(
      customer,
      this.getRequestHost(host, forwardedHost),
      dto,
    );
  }

  @Patch("addresses/:addressId")
  @ApiOperation({ summary: "Update customer address" })
  updateAddress(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("addressId", ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateStorefrontCustomerAddressDto,
  ) {
    return this.storefrontCustomers.updateAddress(
      customer,
      this.getRequestHost(host, forwardedHost),
      addressId,
      dto,
    );
  }

  @Delete("addresses/:addressId")
  @ApiOperation({ summary: "Delete customer address" })
  deleteAddress(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("addressId", ParseUUIDPipe) addressId: string,
  ) {
    return this.storefrontCustomers.deleteAddress(
      customer,
      this.getRequestHost(host, forwardedHost),
      addressId,
    );
  }

  @Get("carts")
  @ApiOperation({ summary: "Get customer carts" })
  findCarts(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Query() query: StorefrontCartQueryDto,
  ) {
    return this.storefrontCustomers.findCarts(
      customer,
      this.getRequestHost(host, forwardedHost),
      query,
    );
  }

  @Get("carts/:cartId")
  @ApiOperation({ summary: "Get customer cart details" })
  findCart(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("cartId", ParseUUIDPipe) cartId: string,
  ) {
    return this.storefrontCustomers.findCart(
      customer,
      this.getRequestHost(host, forwardedHost),
      cartId,
    );
  }

  @Get("cart")
  @ApiOperation({ summary: "Get active customer cart" })
  getActiveCart(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
  ) {
    return this.storefrontCustomers.getActiveCart(
      customer,
      this.getRequestHost(host, forwardedHost),
    );
  }

  @Post("cart/items")
  @ApiOperation({ summary: "Add item to active customer cart" })
  addCartItem(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Body() dto: AddStorefrontCartItemDto,
  ) {
    return this.storefrontCustomers.addCartItem(
      customer,
      this.getRequestHost(host, forwardedHost),
      dto,
    );
  }

  @Patch("cart/items/:itemId")
  @ApiOperation({ summary: "Update active customer cart item" })
  updateCartItem(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateStorefrontCartItemDto,
  ) {
    return this.storefrontCustomers.updateCartItem(
      customer,
      this.getRequestHost(host, forwardedHost),
      itemId,
      dto,
    );
  }

  @Delete("cart/items/:itemId")
  @ApiOperation({ summary: "Remove item from active customer cart" })
  removeCartItem(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("itemId", ParseUUIDPipe) itemId: string,
  ) {
    return this.storefrontCustomers.removeCartItem(
      customer,
      this.getRequestHost(host, forwardedHost),
      itemId,
    );
  }

  @Delete("cart")
  @ApiOperation({ summary: "Clear active customer cart" })
  clearActiveCart(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
  ) {
    return this.storefrontCustomers.clearActiveCart(
      customer,
      this.getRequestHost(host, forwardedHost),
    );
  }

  @Post("carts/:cartId/place")
  @ApiOperation({ summary: "Place an existing active cart as an unpaid order" })
  placeExistingCartOrder(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("cartId", ParseUUIDPipe) cartId: string,
    @Body() dto: PlaceStorefrontOrderDto,
  ) {
    return this.storefrontCustomers.placeOrderFromCart(
      customer,
      this.getRequestHost(host, forwardedHost),
      cartId,
      dto,
    );
  }

  @Post("orders/place")
  @ApiOperation({ summary: "Place active cart as an unpaid order" })
  placeOrder(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Body() dto: PlaceStorefrontOrderDto,
  ) {
    return this.storefrontCustomers.placeOrder(
      customer,
      this.getRequestHost(host, forwardedHost),
      dto,
    );
  }

  @Get("wishlist")
  @ApiOperation({ summary: "Get customer wishlist" })
  findWishlist(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Query() query: StorefrontWishlistQueryDto,
  ) {
    return this.storefrontCustomers.findWishlist(
      customer,
      this.getRequestHost(host, forwardedHost),
      query,
    );
  }

  @Get("wishlist/check")
  @ApiOperation({ summary: "Check if a product is in the customer wishlist" })
  checkWishlistItem(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Query() query: StorefrontWishlistItemDto,
  ) {
    return this.storefrontCustomers.checkWishlistItem(
      customer,
      this.getRequestHost(host, forwardedHost),
      query,
    );
  }

  @Post("wishlist/items")
  @ApiOperation({ summary: "Add item to customer wishlist" })
  addWishlistItem(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Body() dto: StorefrontWishlistItemDto,
  ) {
    return this.storefrontCustomers.addWishlistItem(
      customer,
      this.getRequestHost(host, forwardedHost),
      dto,
    );
  }

  @Delete("wishlist/items/:wishlistItemId")
  @ApiOperation({ summary: "Remove item from customer wishlist" })
  removeWishlistItem(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("wishlistItemId", ParseUUIDPipe) wishlistItemId: string,
  ) {
    return this.storefrontCustomers.removeWishlistItem(
      customer,
      this.getRequestHost(host, forwardedHost),
      wishlistItemId,
    );
  }

  @Delete("wishlist")
  @ApiOperation({ summary: "Clear customer wishlist" })
  clearWishlist(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
  ) {
    return this.storefrontCustomers.clearWishlist(
      customer,
      this.getRequestHost(host, forwardedHost),
    );
  }

  @Get("orders")
  @ApiOperation({ summary: "Get customer order history" })
  findOrders(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Query() query: StorefrontOrderQueryDto,
  ) {
    return this.storefrontCustomers.findOrders(
      customer,
      this.getRequestHost(host, forwardedHost),
      query,
    );
  }

  @Get("orders/:orderId")
  @ApiOperation({ summary: "Get customer order details" })
  findOrder(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("orderId", ParseUUIDPipe) orderId: string,
  ) {
    return this.storefrontCustomers.findOrder(
      customer,
      this.getRequestHost(host, forwardedHost),
      orderId,
    );
  }

  @Get("invoices")
  @ApiOperation({ summary: "Get customer invoices" })
  findInvoices(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Query() query: QueryCustomerInvoiceDto,
  ) {
    return this.storefrontCustomers.findInvoices(
      customer,
      this.getRequestHost(host, forwardedHost),
      query,
    );
  }

  @Get("invoices/:invoiceId")
  @ApiOperation({ summary: "Get customer invoice details" })
  findInvoice(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
  ) {
    return this.storefrontCustomers.findInvoice(
      customer,
      this.getRequestHost(host, forwardedHost),
      invoiceId,
    );
  }

  @Post("orders/:orderId/cancel")
  @ApiOperation({ summary: "Cancel a customer order" })
  cancelOrder(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body() dto: CancelStorefrontOrderDto,
  ) {
    return this.storefrontCustomers.cancelOrder(
      customer,
      this.getRequestHost(host, forwardedHost),
      orderId,
      dto,
    );
  }

  @Post("orders/:orderId/return")
  @ApiOperation({ summary: "Request a customer order return" })
  createOrderReturn(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body() dto: CreateStorefrontOrderReturnDto,
  ) {
    return this.storefrontCustomers.createOrderReturn(
      customer,
      this.getRequestHost(host, forwardedHost),
      orderId,
      dto,
    );
  }

  @Get("returns")
  @ApiOperation({ summary: "Get customer order returns" })
  findOrderReturns(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Query() query: StorefrontOrderReturnQueryDto,
  ) {
    return this.storefrontCustomers.findOrderReturns(
      customer,
      this.getRequestHost(host, forwardedHost),
      query,
    );
  }

  @Get("returns/:returnId")
  @ApiOperation({ summary: "Get customer order return details" })
  findOrderReturn(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("returnId", ParseUUIDPipe) returnId: string,
  ) {
    return this.storefrontCustomers.findOrderReturn(
      customer,
      this.getRequestHost(host, forwardedHost),
      returnId,
    );
  }

  @Post("returns/:returnId/cancel")
  @ApiOperation({ summary: "Cancel customer order return request" })
  cancelOrderReturn(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("returnId", ParseUUIDPipe) returnId: string,
  ) {
    return this.storefrontCustomers.cancelOrderReturn(
      customer,
      this.getRequestHost(host, forwardedHost),
      returnId,
    );
  }

  @Get("reviews")
  @ApiOperation({ summary: "Get customer product reviews" })
  findReviews(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Query() query: StorefrontReviewQueryDto,
  ) {
    return this.storefrontCustomers.findReviews(
      customer,
      this.getRequestHost(host, forwardedHost),
      query,
    );
  }

  @Post("products/reviews")
  @ApiOperation({ summary: "Create customer product review" })
  createReview(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Body() dto: CreateStorefrontReviewDto,
  ) {
    return this.storefrontCustomers.createReview(
      customer,
      this.getRequestHost(host, forwardedHost),
      dto,
    );
  }

  private getRequestHost(host?: string, forwardedHost?: string) {
    return forwardedHost ?? host;
  }
}
