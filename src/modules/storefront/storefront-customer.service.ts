import Decimal from "decimal.js";
import { and, count, desc, eq, isNull } from "drizzle-orm";

import {
  CatalogProductStatus,
  customer,
  OrderCartStatus,
  orderCart,
  orderCartItem,
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
import {
  normalizeOptionalText,
  normalizeRequiredText,
} from "../../common/text/normalizers";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import { DatabaseService } from "../../database/database.service";
import { WebsiteService } from "../website/website.service";
import {
  AddStorefrontCartItemDto,
  CreateStorefrontReviewDto,
  StorefrontCartQueryDto,
  StorefrontReviewQueryDto,
  UpdateStorefrontCartItemDto,
} from "./dto/storefront-customer.dto";

import type { CurrentCustomerPayload } from "../customer-auth/strategies/customer-jwt.strategy";

@Injectable()
export class StorefrontCustomerService {
  constructor(
    private readonly database: DatabaseService,
    private readonly websites: WebsiteService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async findCarts(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string,
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
    websiteId: string,
  ) {
    await this.assertStorefrontCustomer(currentCustomer, websiteId);
    const cart = await this.findActiveCart(currentCustomer);

    return apiResponse(cart ? await this.hydrateCart(cart) : null);
  }

  async addCartItem(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string,
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
    websiteId: string,
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
    websiteId: string,
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
    websiteId: string,
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
    websiteId: string,
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

  async findReviews(
    currentCustomer: CurrentCustomerPayload,
    websiteId: string,
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
    websiteId: string,
  ) {
    if (currentCustomer.websiteId !== websiteId) {
      throw new ForbiddenException("Customer cannot access this storefront");
    }

    const storefront = await this.websites.findPublishedById(websiteId);

    if (!storefront) {
      throw new NotFoundException("Published storefront not found");
    }

    if (storefront.businessId !== currentCustomer.businessId) {
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
