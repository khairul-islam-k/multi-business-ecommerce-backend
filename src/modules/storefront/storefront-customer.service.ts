import Decimal from "decimal.js";
import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";

import {
  CatalogProductStatus,
  customer,
  customerAddress,
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
import { OrderSortBy } from "../orders/dto/order.dto";
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
  StorefrontOrderQueryDto,
  StorefrontOrderReturnQueryDto,
  StorefrontReviewQueryDto,
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

    return apiResponse(created, "Customer address created successfully");
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

    return apiResponse(updated, "Customer address updated successfully");
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

    return apiResponse(null, "Customer address deleted successfully");
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

  async addCartItem(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string | undefined,
    dto: AddStorefrontCartItemDto,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    await this.assertCartItemTarget(currentCustomer.businessId, dto);

    const cart = await this.findOrCreateActiveCart(currentCustomer);
    const existingItem = await this.findCartItemByProduct(
      cart.id,
      dto.productId,
      dto.variantId ?? null,
    );

    if (existingItem) {
      const quantity = new Decimal(existingItem.quantity).plus(dto.quantity);

      await this.db
        .update(orderCartItem)
        .set({ quantity })
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
    const [customerRow, cart] = await Promise.all([
      this.getCustomerOrThrow(currentCustomer),
      this.findActiveCart(currentCustomer),
    ]);

    if (!cart) {
      throw new BadRequestException("Active cart is empty");
    }

    const cartItems = await this.getCartItems(cart.id);

    if (cartItems.length === 0) {
      throw new BadRequestException("Active cart is empty");
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
        shippingCharge: dto.shippingCharge,
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

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
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
    const items = await this.db
      .select({
        item: orderCartItem,
        product,
        variant: productVariant,
      })
      .from(orderCartItem)
      .innerJoin(product, eq(product.id, orderCartItem.productId))
      .leftJoin(productVariant, eq(productVariant.id, orderCartItem.variantId))
      .where(eq(orderCartItem.cartId, cart.id))
      .orderBy(orderCartItem.createdAt);

    return {
      ...cart,
      items: items.map((row) => ({
        ...row.item,
        product: row.product,
        variant: row.variant,
      })),
    };
  }

  private getCartItems(cartId: string) {
    return this.db
      .select()
      .from(orderCartItem)
      .where(eq(orderCartItem.cartId, cartId))
      .orderBy(asc(orderCartItem.createdAt));
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
      throw new NotFoundException("Order not found");
    }

    return orderRow;
  }

  private async hydrateOrder(orderRow: typeof order.$inferSelect) {
    const [items, payments, statusLogs, returns] = await Promise.all([
      this.db
        .select()
        .from(orderItem)
        .where(eq(orderItem.orderId, orderRow.id))
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
      items,
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
      throw new NotFoundException("Customer address not found");
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
  ) {
    await this.getActiveProductOrThrow(businessId, dto.productId);
    await this.assertVariantSelection(businessId, dto.productId, dto.variantId);
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
      throw new NotFoundException("Product not found");
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
      throw new NotFoundException("Product variant not found");
    }

    return variant;
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
      throw new NotFoundException("Customer not found");
    }

    return customerRow;
  }
}
