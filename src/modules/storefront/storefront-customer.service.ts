import Decimal from "decimal.js";
import { and, asc, count, desc, eq, inArray, isNull, or } from "drizzle-orm";

import {
  businessSetting,
  CatalogProductStatus,
  customer,
  customerAddress,
  customerWishlist,
  inventoryStock,
  order,
  orderCart,
  orderCartItem,
  OrderCartStatus,
  orderItem,
  orderPayment,
  orderReturn,
  orderReturnItem,
  OrderReturnStatus,
  OrderStatus,
  orderStatusLog,
  product,
  productImage,
  productReview,
  ProductReviewStatus,
  productVariant,
  ProductVariantStatus,
} from "@/database/schema";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { isUniqueConstraintError } from "../../common/database/db-error.util";
import { buildOrderBy, resolveSortColumn } from "../../common/http/sort.util";
import {
  normalizeOptionalText,
  normalizeRequiredText,
} from "../../common/text/normalizers";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import { DatabaseService } from "../../database/database.service";
import { OrderSortBy, QueryCustomerInvoiceDto } from "../orders/dto/order.dto";
import { OrderCodeRepository } from "../orders/infrastructure/order-code.repository";
import { OrderService } from "../orders/order.service";
import { WebsiteService } from "../website/website.service";
import {
  AddStorefrontCartItemDto,
  CancelStorefrontOrderDto,
  CreateStorefrontCustomerAddressDto,
  CreateStorefrontOrderReturnDto,
  CreateStorefrontReviewDto,
  PlaceStorefrontOrderDto,
  StorefrontCartQueryDto,
  StorefrontCheckoutPaymentMethod,
  StorefrontOrderQueryDto,
  StorefrontOrderReturnQueryDto,
  StorefrontReviewQueryDto,
  StorefrontWishlistItemDto,
  StorefrontWishlistQueryDto,
  StorefrontWishlistSortBy,
  UpdateStorefrontCartItemDto,
  UpdateStorefrontCustomerAddressDto,
} from "./dto/storefront-customer.dto";

import type { CurrentCustomerPayload } from "../customer-auth/strategies/customer-jwt.strategy";

@Injectable()
export class StorefrontCustomerService {
  constructor(
    private readonly database: DatabaseService,
    private readonly websites: WebsiteService,
    private readonly orders: OrderService,
    private readonly orderCodes: OrderCodeRepository,
  ) {}

  private get db() {
    return this.database.db;
  }

  async findAddresses(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    const addresses = await this.db
      .select()
      .from(customerAddress)
      .where(
        and(
          eq(customerAddress.customerId, currentCustomer.customerId),
          isNull(customerAddress.deletedAt),
        ),
      )
      .orderBy(
        desc(customerAddress.isDefault),
        desc(customerAddress.updatedAt),
      );

    return apiResponse(addresses);
  }

  async findAddress(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    addressId: string,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    await this.getCustomerAddressOrThrow(currentCustomer, addressId);

    const [address] = await this.db
      .select()
      .from(customerAddress)
      .where(
        and(
          eq(customerAddress.customerId, currentCustomer.customerId),
          eq(customerAddress.id, addressId),
          isNull(customerAddress.deletedAt),
        ),
      )
      .limit(1);

    return apiResponse(address);
  }

  async createAddress(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    dto: CreateStorefrontCustomerAddressDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    await this.getCustomerOrThrow(currentCustomer);
    const shouldSetDefault =
      dto.isDefault ?? !(await this.customerHasAddress(currentCustomer));

    const [created] = await this.db.transaction(async (tx) => {
      if (shouldSetDefault) {
        await tx
          .update(customerAddress)
          .set({ isDefault: false })
          .where(
            and(
              eq(customerAddress.customerId, currentCustomer.customerId),
              isNull(customerAddress.deletedAt),
            ),
          );
      }

      return tx
        .insert(customerAddress)
        .values({
          customerId: currentCustomer.customerId,
          addressType: dto.addressType,
          name: normalizeOptionalText(dto.name),
          address: normalizeRequiredText(dto.address),
          city: normalizeOptionalText(dto.city),
          country: normalizeOptionalText(dto.country),
          isDefault: shouldSetDefault,
        })
        .returning();
    });

    return apiResponse(
      created,
      "Customer address was created successfully. The address has been saved and default-address rules were applied when requested.",
    );
  }

  async updateAddress(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    addressId: string,
    dto: UpdateStorefrontCustomerAddressDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    await this.getCustomerAddressOrThrow(currentCustomer, addressId);

    const [updated] = await this.db.transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx
          .update(customerAddress)
          .set({ isDefault: false })
          .where(
            and(
              eq(customerAddress.customerId, currentCustomer.customerId),
              isNull(customerAddress.deletedAt),
            ),
          );
      }

      return tx
        .update(customerAddress)
        .set({
          addressType: dto.addressType,
          name:
            dto.name === undefined
              ? undefined
              : normalizeOptionalText(dto.name),
          address:
            dto.address === undefined
              ? undefined
              : normalizeRequiredText(dto.address),
          city:
            dto.city === undefined
              ? undefined
              : normalizeOptionalText(dto.city),
          country:
            dto.country === undefined
              ? undefined
              : normalizeOptionalText(dto.country),
          isDefault: dto.isDefault,
        })
        .where(eq(customerAddress.id, addressId))
        .returning();
    });

    return apiResponse(
      updated,
      "Customer address was updated successfully. The saved address now reflects the submitted details and default-address rules.",
    );
  }

  async deleteAddress(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    addressId: string,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    const address = await this.getCustomerAddressOrThrow(
      currentCustomer,
      addressId,
    );

    await this.db
      .update(customerAddress)
      .set({
        isDefault: false,
        deletedAt: new Date(),
      })
      .where(eq(customerAddress.id, address.id));

    return apiResponse(
      null,
      "Customer address was deleted successfully. The address has been soft-deleted and will no longer be used for customer checkout or profile flows.",
    );
  }

  async findCarts(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    query: StorefrontCartQueryDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);

    const carts = await this.db
      .select()
      .from(orderCart)
      .where(
        and(
          eq(orderCart.businessId, currentCustomer.businessId),
          eq(orderCart.customerId, currentCustomer.customerId),
          query.status ? eq(orderCart.status, query.status) : undefined,
        ),
      )
      .orderBy(desc(orderCart.updatedAt));

    return apiResponse(
      await Promise.all(carts.map((cart) => this.hydrateCart(cart))),
    );
  }

  async getActiveCart(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    const cart = await this.findActiveCart(currentCustomer);

    return apiResponse(cart ? await this.hydrateCart(cart) : null);
  }

  async findWishlist(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    query: StorefrontWishlistQueryDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(customerWishlist.businessId, currentCustomer.businessId),
      eq(customerWishlist.customerId, currentCustomer.customerId),
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(customerWishlist)
        .where(where)
        .orderBy(
          buildOrderBy(
            resolveSortColumn(
              query.sortBy,
              {
                [StorefrontWishlistSortBy.CREATED_AT]:
                  customerWishlist.createdAt,
                [StorefrontWishlistSortBy.UPDATED_AT]:
                  customerWishlist.updatedAt,
              },
              StorefrontWishlistSortBy.CREATED_AT,
            ),
            query.sortOrder,
          ),
        )
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(customerWishlist)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      await Promise.all(rows.map((row) => this.hydrateWishlistItem(row))),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Customer wishlist was loaded successfully. The response includes saved products and pagination metadata for browsing more items.",
    );
  }

  async addWishlistItem(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    dto: StorefrontWishlistItemDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    await this.getActiveProductOrThrow(
      currentCustomer.businessId,
      dto.productId,
    );
    await this.assertVariantSelection(
      currentCustomer.businessId,
      dto.productId,
      dto.variantId,
    );

    const existing = await this.findWishlistItemByProduct(
      currentCustomer,
      dto.productId,
      dto.variantId ?? null,
    );

    if (existing) {
      return apiResponse(
        await this.hydrateWishlistItem(existing),
        "Wishlist item already exists",
      );
    }

    try {
      const [created] = await this.db
        .insert(customerWishlist)
        .values({
          businessId: currentCustomer.businessId,
          customerId: currentCustomer.customerId,
          productId: dto.productId,
          variantId: dto.variantId ?? null,
        })
        .returning();

      return apiResponse(
        await this.hydrateWishlistItem(created),
        "Wishlist item added successfully",
      );
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const concurrentItem = await this.findWishlistItemByProduct(
        currentCustomer,
        dto.productId,
        dto.variantId ?? null,
      );

      if (!concurrentItem) {
        throw error;
      }

      return apiResponse(
        await this.hydrateWishlistItem(concurrentItem),
        "Wishlist item already exists",
      );
    }
  }

  async checkWishlistItem(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    query: StorefrontWishlistItemDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    const item = await this.findWishlistItemByProduct(
      currentCustomer,
      query.productId,
      query.variantId ?? null,
    );

    return apiResponse({
      exists: Boolean(item),
      item: item ? await this.hydrateWishlistItem(item) : null,
    });
  }

  async removeWishlistItem(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    wishlistItemId: string,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    await this.getWishlistItemOrThrow(currentCustomer, wishlistItemId);

    await this.db
      .delete(customerWishlist)
      .where(eq(customerWishlist.id, wishlistItemId));

    return apiResponse(null, "Wishlist item removed successfully");
  }

  async clearWishlist(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);

    await this.db
      .delete(customerWishlist)
      .where(
        and(
          eq(customerWishlist.businessId, currentCustomer.businessId),
          eq(customerWishlist.customerId, currentCustomer.customerId),
        ),
      );

    return apiResponse(null, "Wishlist cleared successfully");
  }

  async addCartItem(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    dto: AddStorefrontCartItemDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);

    const cart = await this.findOrCreateActiveCart(currentCustomer);
    const existingItem = await this.findCartItemByProduct(
      cart.id,
      dto.productId,
      dto.variantId ?? null,
    );
    const nextQuantity = existingItem
      ? new Decimal(existingItem.quantity).plus(dto.quantity)
      : new Decimal(dto.quantity);

    await this.assertCartItemTarget(
      currentCustomer.businessId,
      dto,
      nextQuantity,
    );

    if (existingItem) {
      await this.db
        .update(orderCartItem)
        .set({ quantity: nextQuantity })
        .where(eq(orderCartItem.id, existingItem.id));

      return apiResponse(
        await this.hydrateCart(cart),
        "Cart item quantity updated successfully",
      );
    }

    await this.db.insert(orderCartItem).values({
      cartId: cart.id,
      productId: dto.productId,
      variantId: dto.variantId ?? null,
      quantity: new Decimal(dto.quantity),
    });

    return apiResponse(
      await this.hydrateCart(cart),
      "Cart item added successfully",
    );
  }

  async updateCartItem(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    itemId: string,
    dto: UpdateStorefrontCartItemDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    const row = await this.getActiveCustomerCartItemOrThrow(
      currentCustomer,
      itemId,
    );
    await this.assertItemInStock(
      currentCustomer.businessId,
      row.item.productId,
      row.item.variantId ?? undefined,
      dto.quantity,
    );

    await this.db
      .update(orderCartItem)
      .set({ quantity: new Decimal(dto.quantity) })
      .where(eq(orderCartItem.id, row.item.id));

    return apiResponse(
      await this.hydrateCart(row.cart),
      "Cart item updated successfully",
    );
  }

  async removeCartItem(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    itemId: string,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    const row = await this.getActiveCustomerCartItemOrThrow(
      currentCustomer,
      itemId,
    );

    await this.db
      .delete(orderCartItem)
      .where(eq(orderCartItem.id, row.item.id));

    return apiResponse(
      await this.hydrateCart(row.cart),
      "Cart item removed successfully",
    );
  }

  async clearActiveCart(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    const cart = await this.findActiveCart(currentCustomer);

    if (!cart) {
      return apiResponse(null, "Cart cleared successfully");
    }

    await this.db
      .delete(orderCartItem)
      .where(eq(orderCartItem.cartId, cart.id));

    return apiResponse(
      await this.hydrateCart(cart),
      "Cart cleared successfully",
    );
  }

  async createReview(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    dto: CreateStorefrontReviewDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    await this.assertReviewTarget(currentCustomer.businessId, dto);
    const customerRow = await this.getCustomerOrThrow(currentCustomer);

    const [review] = await this.db
      .insert(productReview)
      .values({
        businessId: currentCustomer.businessId,
        productId: dto.productId,
        customerId: currentCustomer.customerId,
        variantId: dto.variantId ?? null,
        rating: dto.rating,
        title: normalizeOptionalText(dto.title),
        comment: normalizeOptionalText(dto.comment),
        reviewerName: normalizeRequiredText(customerRow.name),
        reviewerEmail: normalizeOptionalText(currentCustomer.email),
        reviewerPhone: normalizeOptionalText(customerRow.phone),
        status: ProductReviewStatus.PENDING,
      })
      .returning();

    return apiResponse(review, "Product review created successfully");
  }

  async placeOrder(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    dto: PlaceStorefrontOrderDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    const cart = await this.findActiveCart(currentCustomer);

    if (!cart) {
      throw new BadRequestException("Active cart is empty");
    }

    return this.placeCartOrder(currentCustomer, cart, dto);
  }

  async placeOrderFromCart(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    cartId: string,
    dto: PlaceStorefrontOrderDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    const cart = await this.getPlaceableCartOrThrow(currentCustomer, cartId);

    return this.placeCartOrder(currentCustomer, cart, dto);
  }

  private async placeCartOrder(
    currentCustomer: CurrentCustomerPayload,
    cart: typeof orderCart.$inferSelect,
    dto: PlaceStorefrontOrderDto,
  ) {
    const customerRow = await this.getCustomerOrThrow(currentCustomer);

    const cartItems = await this.getCartItems(cart.id);

    if (cartItems.length === 0) {
      throw new BadRequestException("Active cart is empty");
    }

    await this.assertCheckoutPaymentSettings(
      currentCustomer.businessId,
      dto.paymentMethod,
    );

    for (const cartItem of cartItems) {
      await this.assertItemInStock(
        currentCustomer.businessId,
        cartItem.productId,
        cartItem.variantId ?? undefined,
        cartItem.quantity,
      );
    }

    if (
      Boolean(dto.shippingAddressId) === Boolean(dto.shippingAddressSnapshot)
    ) {
      throw new BadRequestException(
        "Provide either a saved shipping address or a new shipping address snapshot",
      );
    }

    const shippingAddressSnapshot = dto.shippingAddressId
      ? this.buildAddressSnapshot(
          await this.getCustomerAddressOrThrow(
            currentCustomer,
            dto.shippingAddressId,
          ),
        )
      : dto.shippingAddressSnapshot;

    const createdOrderResponse = await this.orders.createStorefrontOrder(
      currentCustomer.businessId,
      {
        customerId: currentCustomer.customerId,
        customerName: customerRow.name,
        customerPhone: customerRow.phone ?? undefined,
        customerEmail: currentCustomer.email,
        shippingAddressSnapshot,
        shippingCharge: 0,
        isCod: dto.paymentMethod === StorefrontCheckoutPaymentMethod.COD,
        note: dto.note,
        items: cartItems.map((row) => ({
          productId: row.productId,
          variantId: row.variantId ?? undefined,
          quantity: Number(new Decimal(row.quantity).toString()),
        })),
      },
    );

    await this.db
      .update(orderCart)
      .set({
        status: OrderCartStatus.ORDERED,
      })
      .where(eq(orderCart.id, cart.id));

    const placedOrder = await this.findCustomerOrderOrThrow(
      currentCustomer,
      createdOrderResponse.data.id,
    );

    return apiResponse(placedOrder, "Order placed successfully");
  }

  async findOrders(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    query: StorefrontOrderQueryDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    // TODO: add search here
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(order.businessId, currentCustomer.businessId),
      eq(order.customerId, currentCustomer.customerId),
      isNull(order.deletedAt),
      query.status ? eq(order.status, query.status) : undefined,
      query.paymentStatus
        ? eq(order.paymentStatus, query.paymentStatus)
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(order)
        .where(where)
        .orderBy(
          buildOrderBy(
            resolveSortColumn(
              query.sortBy,
              {
                [OrderSortBy.ORDER_NO]: order.orderNo,
                [OrderSortBy.TOTAL_AMOUNT]: order.totalAmount,
                [OrderSortBy.CREATED_AT]: order.createdAt,
                [OrderSortBy.UPDATED_AT]: order.updatedAt,
              },
              OrderSortBy.CREATED_AT,
            ),
            query.sortOrder,
          ),
        )
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(order)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      await Promise.all(rows.map((row) => this.hydrateOrder(row))),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Customer orders were loaded successfully. The response includes the requested page of storefront orders for this customer and pagination metadata for browsing more results.",
    );
  }

  async findOrder(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    orderId: string,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);

    return apiResponse(
      await this.findCustomerOrderOrThrow(currentCustomer, orderId),
    );
  }

  async findInvoices(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    query: QueryCustomerInvoiceDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);

    return this.orders.findCustomerInvoices(currentCustomer, query);
  }

  async findInvoice(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    invoiceId: string,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);

    return this.orders.findCustomerInvoice(currentCustomer, invoiceId);
  }

  async cancelOrder(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    orderId: string,
    dto: CancelStorefrontOrderDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    await this.assertCustomerOrderExists(currentCustomer, orderId);
    await this.orders.cancelByCustomer(
      currentCustomer.businessId,
      orderId,
      normalizeOptionalText(dto.reason),
    );

    return apiResponse(
      await this.findCustomerOrderOrThrow(currentCustomer, orderId),
      "Order cancelled successfully",
    );
  }

  async createOrderReturn(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    orderId: string,
    dto: CreateStorefrontOrderReturnDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    const orderRow = await this.getCustomerOrderRowOrThrow(
      currentCustomer,
      orderId,
    );

    if (orderRow.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException("Only delivered orders can be returned");
    }

    if (dto.items.length === 0) {
      throw new BadRequestException("At least one return item is required");
    }

    const uniqueOrderItemIds = new Set(
      dto.items.map((item) => item.orderItemId),
    );

    if (uniqueOrderItemIds.size !== dto.items.length) {
      throw new BadRequestException("Duplicate return items are not allowed");
    }

    const orderItems = await this.db
      .select()
      .from(orderItem)
      .where(
        and(
          eq(orderItem.orderId, orderId),
          inArray(orderItem.id, [...uniqueOrderItemIds]),
        ),
      );

    if (orderItems.length !== dto.items.length) {
      throw new BadRequestException("One or more return items are invalid");
    }

    const itemById = new Map(orderItems.map((item) => [item.id, item]));
    const returnItems = dto.items.map((item) => {
      const sourceItem = itemById.get(item.orderItemId)!;
      const quantity = new Decimal(item.quantity);
      const sourceQuantity = new Decimal(sourceItem.quantity);

      if (quantity.greaterThan(sourceQuantity)) {
        throw new BadRequestException(
          "Return quantity cannot exceed ordered quantity",
        );
      }

      const lineTotal = new Decimal(sourceItem.lineTotal)
        .mul(quantity)
        .div(sourceQuantity)
        .toDecimalPlaces(2);

      return {
        sourceItem,
        quantity,
        lineTotal,
        reason: normalizeOptionalText(item.reason),
      };
    });
    const totalAmount = returnItems.reduce(
      (total, item) => total.plus(item.lineTotal),
      new Decimal(0),
    );
    const returnNo = await this.orderCodes.generateUniqueReturnNo(
      currentCustomer.businessId,
    );

    const createdReturn = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(orderReturn)
        .values({
          businessId: currentCustomer.businessId,
          orderId,
          returnNo,
          status: OrderReturnStatus.REQUESTED,
          reason: normalizeOptionalText(dto.reason),
          totalAmount,
        })
        .returning();

      await tx.insert(orderReturnItem).values(
        returnItems.map((item) => ({
          returnId: created.id,
          orderItemId: item.sourceItem.id,
          productId: item.sourceItem.productId,
          variantId: item.sourceItem.variantId,
          quantity: item.quantity,
          unitPrice: item.sourceItem.unitPrice,
          lineTotal: item.lineTotal,
          reason: item.reason,
        })),
      );

      return created;
    });

    return apiResponse(
      await this.hydrateOrderReturn(createdReturn),
      "Order return requested successfully",
    );
  }

  async findOrderReturns(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    query: StorefrontOrderReturnQueryDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(orderReturn.businessId, currentCustomer.businessId),
      eq(order.customerId, currentCustomer.customerId),
      isNull(orderReturn.deletedAt),
      isNull(order.deletedAt),
      query.status ? eq(orderReturn.status, query.status) : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select({
          return: orderReturn,
          order,
        })
        .from(orderReturn)
        .innerJoin(order, eq(order.id, orderReturn.orderId))
        .where(where)
        .orderBy(desc(orderReturn.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(orderReturn)
        .innerJoin(order, eq(order.id, orderReturn.orderId))
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      await Promise.all(
        rows.map(async (row) => ({
          ...(await this.hydrateOrderReturn(row.return)),
          order: row.order,
        })),
      ),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Customer order returns were loaded successfully. The response includes the requested page of storefront return requests and pagination metadata for browsing more results.",
    );
  }

  async findOrderReturn(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    returnId: string,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    const row = await this.getCustomerOrderReturnOrThrow(
      currentCustomer,
      returnId,
    );

    return apiResponse({
      ...(await this.hydrateOrderReturn(row.return)),
      order: row.order,
    });
  }

  async cancelOrderReturn(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    returnId: string,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    const row = await this.getCustomerOrderReturnOrThrow(
      currentCustomer,
      returnId,
    );

    if (row.return.status !== OrderReturnStatus.REQUESTED) {
      throw new BadRequestException(
        "This return request can no longer be cancelled because the store has already reviewed it.",
      );
    }

    const [updated] = await this.db
      .update(orderReturn)
      .set({ status: OrderReturnStatus.CANCELLED })
      .where(eq(orderReturn.id, row.return.id))
      .returning();

    return apiResponse(
      await this.hydrateOrderReturn(updated),
      "Order return request cancelled successfully",
    );
  }

  async findReviews(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    query: StorefrontReviewQueryDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(productReview.businessId, currentCustomer.businessId),
      eq(productReview.customerId, currentCustomer.customerId),
      isNull(productReview.deletedAt),
      query.productId
        ? eq(productReview.productId, query.productId)
        : undefined,
      query.status ? eq(productReview.status, query.status) : undefined,
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(productReview)
        .innerJoin(product, eq(product.id, productReview.productId))
        .where(where)
        .orderBy(desc(productReview.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(productReview)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      items.map((item) => ({
        ...item.product_reviews,
        product: item.products,
      })),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Customer product reviews were loaded successfully. The response includes the requested page of storefront reviews from this customer and pagination metadata for browsing more results.",
    );
  }

  private async assertStorefrontCustomer(
    currentCustomer: CurrentCustomerPayload,
    host?: string,
  ) {
    const storefront = await this.websites.findPublishedByHostOrThrow(host);

    if (
      currentCustomer.websiteId !== storefront.id ||
      storefront.businessId !== currentCustomer.businessId
    ) {
      throw new ForbiddenException("Customer cannot access this storefront");
    }

    return storefront;
  }

  private async findActiveCart(currentCustomer: CurrentCustomerPayload) {
    return this.db
      .select()
      .from(orderCart)
      .where(
        and(
          eq(orderCart.businessId, currentCustomer.businessId),
          eq(orderCart.customerId, currentCustomer.customerId),
          eq(orderCart.status, OrderCartStatus.ACTIVE),
        ),
      )
      .orderBy(desc(orderCart.updatedAt))
      .limit(1)
      .then(([cart]) => cart ?? null);
  }

  private async getPlaceableCartOrThrow(
    currentCustomer: CurrentCustomerPayload,
    cartId: string,
  ) {
    const [cart] = await this.db
      .select()
      .from(orderCart)
      .where(
        and(
          eq(orderCart.id, cartId),
          eq(orderCart.businessId, currentCustomer.businessId),
          eq(orderCart.customerId, currentCustomer.customerId),
        ),
      )
      .limit(1);

    if (!cart) {
      throw new NotFoundException(
        "Cart could not be found. It may not exist, or may not belong to this storefront customer.",
      );
    }

    return cart;
  }

  private async findOrCreateActiveCart(
    currentCustomer: CurrentCustomerPayload,
  ) {
    const existingCart = await this.findActiveCart(currentCustomer);

    if (existingCart) {
      return existingCart;
    }

    try {
      const [cart] = await this.db
        .insert(orderCart)
        .values({
          businessId: currentCustomer.businessId,
          customerId: currentCustomer.customerId,
          status: OrderCartStatus.ACTIVE,
        })
        .returning();

      return cart;
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const concurrentCart = await this.findActiveCart(currentCustomer);

      if (!concurrentCart) {
        throw error;
      }

      return concurrentCart;
    }
  }

  private async hydrateCart(cart: typeof orderCart.$inferSelect) {
    const rows = await this.db
      .select({
        item: orderCartItem,
        product: product,
        variant: productVariant,
        image: productImage,
      })
      .from(orderCartItem)
      .innerJoin(product, eq(product.id, orderCartItem.productId))
      .leftJoin(
        productVariant,
        and(
          eq(productVariant.id, orderCartItem.variantId),
          eq(productVariant.productId, product.id),
        ),
      )
      .leftJoin(
        productImage,
        or(
          eq(product.id, productImage.productId),
          eq(productVariant.id, productImage.variantId),
        ),
      )
      .where(eq(orderCartItem.cartId, cart.id))
      .orderBy(orderCartItem.createdAt);

    const itemsById = new Map<
      string,
      typeof orderCartItem.$inferSelect & {
        product: typeof product.$inferSelect;
        variant: typeof productVariant.$inferSelect | null;
        images: (typeof productImage.$inferSelect)[];
      }
    >();

    for (const row of rows) {
      let item = itemsById.get(row.item.id);

      if (!item) {
        item = {
          ...row.item,
          product: row.product,
          variant: row.variant,
          images: [],
        };

        itemsById.set(row.item.id, item);
      }

      if (row.image) {
        item.images.push(row.image);
      }
    }

    return {
      ...cart,
      items: Array.from(itemsById.values()),
    };
  }

  private getCartItems(cartId: string) {
    return this.db
      .select()
      .from(orderCartItem)
      .where(eq(orderCartItem.cartId, cartId))
      .orderBy(asc(orderCartItem.createdAt));
  }

  private async hydrateWishlistItem(
    wishlistItem: typeof customerWishlist.$inferSelect,
  ) {
    const [row] = await this.db
      .select({
        item: customerWishlist,
        product,
        variant: productVariant,
        image: productImage,
      })
      .from(customerWishlist)
      .innerJoin(product, eq(product.id, customerWishlist.productId))
      .leftJoin(
        productVariant,
        and(
          eq(productVariant.id, customerWishlist.variantId),
          eq(productVariant.productId, product.id),
        ),
      )
      .leftJoin(
        productImage,
        or(
          eq(product.id, productImage.productId),
          eq(productVariant.id, productImage.variantId),
        ),
      )
      .where(eq(customerWishlist.id, wishlistItem.id))
      .orderBy(desc(productImage.isThumbnail), asc(productImage.sortOrder))
      .limit(1);

    return row
      ? {
          ...row.item,
          product: row.product,
          variant: row.variant,
          image: row.image,
        }
      : wishlistItem;
  }

  private async findWishlistItemByProduct(
    currentCustomer: CurrentCustomerPayload,
    productId: string,
    variantId: string | null,
  ) {
    return this.db
      .select()
      .from(customerWishlist)
      .where(
        and(
          eq(customerWishlist.businessId, currentCustomer.businessId),
          eq(customerWishlist.customerId, currentCustomer.customerId),
          eq(customerWishlist.productId, productId),
          variantId
            ? eq(customerWishlist.variantId, variantId)
            : isNull(customerWishlist.variantId),
        ),
      )
      .limit(1)
      .then(([item]) => item ?? null);
  }

  private async getWishlistItemOrThrow(
    currentCustomer: CurrentCustomerPayload,
    wishlistItemId: string,
  ) {
    const [item] = await this.db
      .select()
      .from(customerWishlist)
      .where(
        and(
          eq(customerWishlist.id, wishlistItemId),
          eq(customerWishlist.businessId, currentCustomer.businessId),
          eq(customerWishlist.customerId, currentCustomer.customerId),
        ),
      )
      .limit(1);

    if (!item) {
      throw new NotFoundException(
        "Wishlist item could not be found. It may not exist, may have already been removed, or may not belong to this storefront customer.",
      );
    }

    return item;
  }

  private async findCustomerOrderOrThrow(
    currentCustomer: CurrentCustomerPayload,
    orderId: string,
  ) {
    const orderRow = await this.getCustomerOrderRowOrThrow(
      currentCustomer,
      orderId,
    );

    return this.hydrateOrder(orderRow);
  }

  private async assertCustomerOrderExists(
    currentCustomer: CurrentCustomerPayload,
    orderId: string,
  ) {
    await this.getCustomerOrderRowOrThrow(currentCustomer, orderId);
  }

  private async getCustomerOrderRowOrThrow(
    currentCustomer: CurrentCustomerPayload,
    orderId: string,
  ) {
    const [orderRow] = await this.db
      .select()
      .from(order)
      .where(
        and(
          eq(order.id, orderId),
          eq(order.businessId, currentCustomer.businessId),
          eq(order.customerId, currentCustomer.customerId),
          isNull(order.deletedAt),
        ),
      )
      .limit(1);

    if (!orderRow) {
      throw new NotFoundException(
        "Order could not be found. It may not exist, may have been deleted, or may not belong to the current business or customer account.",
      );
    }

    return orderRow;
  }

  private async hydrateOrder(orderRow: typeof order.$inferSelect) {
    const [items, payments, statusLogs, returns] = await Promise.all([
      this.db
        .select()
        .from(orderItem)
        .where(eq(orderItem.orderId, orderRow.id))
        .innerJoin(
          productImage,
          eq(productImage.productId, orderItem.productId),
        )
        .innerJoin(product, eq(product.id, orderItem.productId))
        .leftJoin(productVariant, eq(productVariant.id, orderItem.variantId))
        .orderBy(asc(orderItem.createdAt)),
      this.db
        .select()
        .from(orderPayment)
        .where(eq(orderPayment.orderId, orderRow.id))
        .orderBy(desc(orderPayment.createdAt)),
      this.db
        .select()
        .from(orderStatusLog)
        .where(eq(orderStatusLog.orderId, orderRow.id))
        .orderBy(asc(orderStatusLog.createdAt)),
      this.db
        .select()
        .from(orderReturn)
        .where(
          and(
            eq(orderReturn.orderId, orderRow.id),
            isNull(orderReturn.deletedAt),
          ),
        )
        .orderBy(desc(orderReturn.createdAt)),
    ]);

    return {
      ...orderRow,
      items: items.map((item) => ({
        ...item.order_items,
        product: item.products,
        variant: item.product_variants,
        image: item.product_images,
      })),
      payments,
      statusLogs,
      returns,
    };
  }

  private async hydrateOrderReturn(returnRow: typeof orderReturn.$inferSelect) {
    const items = await this.db
      .select()
      .from(orderReturnItem)
      .where(eq(orderReturnItem.returnId, returnRow.id))
      .orderBy(asc(orderReturnItem.createdAt));

    return {
      ...returnRow,
      items,
    };
  }

  private async customerHasAddress(currentCustomer: CurrentCustomerPayload) {
    const [row] = await this.db
      .select({ id: customerAddress.id })
      .from(customerAddress)
      .where(
        and(
          eq(customerAddress.customerId, currentCustomer.customerId),
          isNull(customerAddress.deletedAt),
        ),
      )
      .limit(1);

    return Boolean(row);
  }

  private async getCustomerAddressOrThrow(
    currentCustomer: CurrentCustomerPayload,
    addressId: string,
  ) {
    const [address] = await this.db
      .select()
      .from(customerAddress)
      .where(
        and(
          eq(customerAddress.id, addressId),
          eq(customerAddress.customerId, currentCustomer.customerId),
          isNull(customerAddress.deletedAt),
        ),
      )
      .limit(1);

    if (!address) {
      throw new NotFoundException(
        "Customer address could not be found. It may not exist, may have been deleted, or may not belong to this customer.",
      );
    }

    return address;
  }

  private buildAddressSnapshot(address: typeof customerAddress.$inferSelect) {
    return {
      addressId: address.id,
      addressType: address.addressType,
      name: address.name,
      address: address.address,
      city: address.city,
      country: address.country,
    };
  }

  private async getCustomerOrderReturnOrThrow(
    currentCustomer: CurrentCustomerPayload,
    returnId: string,
  ) {
    const [row] = await this.db
      .select({
        return: orderReturn,
        order,
      })
      .from(orderReturn)
      .innerJoin(order, eq(order.id, orderReturn.orderId))
      .where(
        and(
          eq(orderReturn.id, returnId),
          eq(orderReturn.businessId, currentCustomer.businessId),
          eq(order.customerId, currentCustomer.customerId),
          isNull(orderReturn.deletedAt),
          isNull(order.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException("Order return not found");
    }

    return row;
  }

  private async findCartItemByProduct(
    cartId: string,
    productId: string,
    variantId: string | null,
  ) {
    return this.db
      .select()
      .from(orderCartItem)
      .where(
        and(
          eq(orderCartItem.cartId, cartId),
          eq(orderCartItem.productId, productId),
          variantId
            ? eq(orderCartItem.variantId, variantId)
            : isNull(orderCartItem.variantId),
        ),
      )
      .limit(1)
      .then(([item]) => item ?? null);
  }

  private async getActiveCustomerCartItemOrThrow(
    currentCustomer: CurrentCustomerPayload,
    itemId: string,
  ) {
    const [row] = await this.db
      .select({
        item: orderCartItem,
        cart: orderCart,
      })
      .from(orderCartItem)
      .innerJoin(orderCart, eq(orderCart.id, orderCartItem.cartId))
      .where(
        and(
          eq(orderCartItem.id, itemId),
          eq(orderCart.businessId, currentCustomer.businessId),
          eq(orderCart.customerId, currentCustomer.customerId),
          eq(orderCart.status, OrderCartStatus.ACTIVE),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException("Cart item not found");
    }

    return row;
  }

  private async assertCartItemTarget(
    businessId: string,
    dto: AddStorefrontCartItemDto,
    quantity: Decimal.Value,
  ) {
    await this.getActiveProductOrThrow(businessId, dto.productId);
    await this.assertVariantSelection(businessId, dto.productId, dto.variantId);
    await this.assertItemInStock(
      businessId,
      dto.productId,
      dto.variantId,
      quantity,
    );
  }

  private async assertReviewTarget(
    businessId: string,
    dto: CreateStorefrontReviewDto,
  ) {
    await this.getActiveProductOrThrow(businessId, dto.productId);
    await this.assertVariantSelection(businessId, dto.productId, dto.variantId);
  }

  private async getActiveProductOrThrow(businessId: string, productId: string) {
    const [productRow] = await this.db
      .select({ id: product.id })
      .from(product)
      .where(
        and(
          eq(product.id, productId),
          eq(product.businessId, businessId),
          eq(product.status, CatalogProductStatus.ACTIVE),
          isNull(product.deletedAt),
        ),
      )
      .limit(1);

    if (!productRow) {
      throw new NotFoundException(
        "Product could not be found. It may not exist, may have been deleted, or may not belong to the current business or storefront.",
      );
    }

    return productRow;
  }

  private async assertVariantSelection(
    businessId: string,
    productId: string,
    variantId?: string,
  ) {
    if (!variantId) {
      return null;
    }

    const [variant] = await this.db
      .select({ id: productVariant.id })
      .from(productVariant)
      .where(
        and(
          eq(productVariant.id, variantId),
          eq(productVariant.businessId, businessId),
          eq(productVariant.productId, productId),
          eq(productVariant.status, ProductVariantStatus.ACTIVE),
          isNull(productVariant.deletedAt),
        ),
      )
      .limit(1);

    if (!variant) {
      throw new NotFoundException(
        "Product variant could not be found. It may not exist, may have been deleted, or may not belong to the selected product.",
      );
    }

    return variant;
  }

  private async assertItemInStock(
    businessId: string,
    productId: string,
    variantId?: string,
    requestedQuantity: Decimal.Value = 1,
  ) {
    const [stock] = await this.db
      .select()
      .from(inventoryStock)
      .where(
        and(
          eq(inventoryStock.businessId, businessId),
          eq(inventoryStock.productId, productId),
          variantId
            ? eq(inventoryStock.variantId, variantId)
            : isNull(inventoryStock.variantId),
        ),
      )
      .limit(1);

    if (!stock) {
      throw new NotFoundException(
        "The requested item is out of stock. Stock has not been added for this product or variant yet.",
      );
    }

    const availableQuantity = new Decimal(stock.totalQuantity).minus(
      stock.quantityReserved,
    );

    if (availableQuantity.lessThan(requestedQuantity)) {
      throw new NotFoundException(
        "The requested item does not have enough available stock. Some quantity may already be reserved for other orders.",
      );
    }

    return stock;
  }

  private async assertCheckoutPaymentSettings(
    businessId: string,
    paymentMethod: StorefrontCheckoutPaymentMethod,
  ) {
    const [settings] = await this.db
      .select({
        codEnabled: businessSetting.codEnabled,
        onlinePaymentEnabled: businessSetting.onlinePaymentEnabled,
      })
      .from(businessSetting)
      .where(eq(businessSetting.businessId, businessId))
      .limit(1);

    if (
      paymentMethod === StorefrontCheckoutPaymentMethod.COD &&
      !settings?.codEnabled
    ) {
      throw new BadRequestException(
        "Cash on delivery is not enabled for this storefront",
      );
    }

    if (
      paymentMethod === StorefrontCheckoutPaymentMethod.ONLINE &&
      !settings?.onlinePaymentEnabled
    ) {
      throw new BadRequestException(
        "Online payment is not enabled for this storefront",
      );
    }
  }
  private async getCustomerOrThrow(currentCustomer: CurrentCustomerPayload) {
    const [customerRow] = await this.db
      .select()
      .from(customer)
      .where(
        and(
          eq(customer.id, currentCustomer.customerId),
          eq(customer.businessId, currentCustomer.businessId),
          isNull(customer.deletedAt),
        ),
      )
      .limit(1);

    if (!customerRow) {
      throw new NotFoundException(
        "Customer could not be found. It may not exist, may have been deleted, or may not belong to the current business or storefront.",
      );
    }

    return customerRow;
  }
}
