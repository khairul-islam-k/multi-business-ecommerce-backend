import Decimal from "decimal.js";
import { and, count, desc, eq, exists, ilike, isNull, or } from "drizzle-orm";

import {
  product,
  supplier,
  supplierPurchaseOrder,
  supplierPurchaseOrderItem,
  SupplierPurchaseOrderStatus,
  warehouse,
} from "@/database/schema";
import { BadRequestException, Injectable } from "@nestjs/common";

import { isUniqueConstraintError } from "../../../common/database/db-error.util";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import {
  normalizeSearch,
  normalizeSearchUuid,
} from "../../../common/http/search.util";
import { DatabaseService } from "../../../database/database.service";
import { FinanceLedgerService } from "../../finance/common/finance-ledger.service";
import { InventoryLookupService } from "../../inventory/common/inventory-lookup.service";
import {
  assertManualPurchaseOrderStatus,
  assertPurchaseOrderCanCancel,
  assertPurchaseOrderCanRemove,
  assertPurchaseOrderCanUpdate,
} from "../domain/purchase-order-status.policy";
import {
  calculateLineTax,
  calculateLineTotal,
  calculatePurchaseOrderTotals,
} from "../domain/purchase-order-totals.calculator";
import { assertPurchaseOrderItems } from "../domain/purchase-return.policy";
import { normalizeNullableText } from "../domain/supplier-contact.policy";
import {
  CancelPurchaseOrderDto,
  CreatePurchaseOrderDto,
  PurchaseOrderItemDto,
  QueryPurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from "../dto/supplier.dto";
import { PurchaseOrderRepository } from "../infrastructure/purchase-order.repository";
import { SupplierCodeRepository } from "../infrastructure/supplier-code.repository";
import { SupplierRepository } from "../infrastructure/supplier.repository";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly database: DatabaseService,
    private readonly inventoryLookup: InventoryLookupService,
    private readonly finance: FinanceLedgerService,
    private readonly suppliers: SupplierRepository,
    private readonly purchaseOrders: PurchaseOrderRepository,
    private readonly codes: SupplierCodeRepository,
  ) {}

  private get db() {
    return this.database.db;
  }

  async createPurchaseOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreatePurchaseOrderDto,
  ) {
    assertPurchaseOrderItems(dto.items);
    assertManualPurchaseOrderStatus(
      dto.status ?? SupplierPurchaseOrderStatus.DRAFT,
    );

    await Promise.all([
      this.suppliers.assertSupplierExists(businessId, dto.supplierId, true),
      this.inventoryLookup.assertWarehouseExists(businessId, dto.warehouseId),
      ...dto.items.map((item) =>
        this.inventoryLookup.assertStockItem(
          businessId,
          item.productId,
          item.variantId ?? null,
        ),
      ),
    ]);

    const items = await this.buildPurchaseOrderItems(businessId, dto.items);
    const totals = calculatePurchaseOrderTotals(items, dto.shippingCost ?? 0);
    const taxSnapshot = this.deriveTaxSnapshot(items, totals);
    const purchaseOrderNo =
      await this.codes.generateUniquePurchaseOrderNo(businessId);

    try {
      const purchaseOrder = await this.db.transaction(async (tx) => {
        const [createdOrder] = await tx
          .insert(supplierPurchaseOrder)
          .values({
            businessId,
            supplierId: dto.supplierId,
            warehouseId: dto.warehouseId,
            taxId: taxSnapshot.taxId,
            purchaseOrderNo,
            orderDate: new Date(),
            expectedDeliveryDate: dto.expectedDeliveryDate,
            status: dto.status ?? SupplierPurchaseOrderStatus.DRAFT,
            subtotal: new Decimal(totals.subtotal),
            discountTotal: new Decimal(totals.discountTotal),
            taxTotal: new Decimal(totals.taxTotal),
            taxRate: taxSnapshot.taxRate,
            shippingCost: new Decimal(totals.shippingCost),
            totalAmount: new Decimal(totals.totalAmount),
            note: normalizeNullableText(dto.note),
            createdBy: currentUser.id,
          })
          .returning();

        await tx.insert(supplierPurchaseOrderItem).values(
          items.map((item) => ({
            purchaseOrderId: createdOrder.id,
            productId: item.productId,
            variantId: item.variantId ?? null,
            taxId: item.taxId,
            quantityOrdered: new Decimal(item.quantityOrdered),
            unitCost: new Decimal(item.unitCost),
            discountAmount: new Decimal(item.discountAmount ?? 0),
            taxAmount: item.taxAmount,
            taxRate: item.taxRate,
            lineTotal: item.lineTotal,
            quantityReceived: new Decimal(0),
          })),
        );

        return this.purchaseOrders.hydrate(createdOrder);
      });

      return apiResponse(
        purchaseOrder,
        "Supplier purchase order created successfully",
      );
    } catch (error) {
      this.handleUniqueError(error, "Purchase order number already exists");
    }
  }

  async findPurchaseOrders(businessId: string, query: QueryPurchaseOrderDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);
    const where = and(
      eq(supplierPurchaseOrder.businessId, businessId),
      isNull(supplierPurchaseOrder.deletedAt),
      query.supplierId
        ? eq(supplierPurchaseOrder.supplierId, query.supplierId)
        : undefined,
      query.warehouseId
        ? eq(supplierPurchaseOrder.warehouseId, query.warehouseId)
        : undefined,
      query.status ? eq(supplierPurchaseOrder.status, query.status) : undefined,
      search
        ? or(
            searchUuid ? eq(supplierPurchaseOrder.id, searchUuid) : undefined,
            searchUuid
              ? eq(supplierPurchaseOrder.supplierId, searchUuid)
              : undefined,
            searchUuid
              ? eq(supplierPurchaseOrder.warehouseId, searchUuid)
              : undefined,
            ilike(supplierPurchaseOrder.purchaseOrderNo, `%${search}%`),
            ilike(supplierPurchaseOrder.note, `%${search}%`),
            exists(
              this.db
                .select({ id: supplier.id })
                .from(supplier)
                .where(
                  and(
                    eq(supplier.id, supplierPurchaseOrder.supplierId),
                    eq(supplier.businessId, businessId),
                    isNull(supplier.deletedAt),
                    or(
                      ilike(supplier.name, `%${search}%`),
                      ilike(supplier.companyName, `%${search}%`),
                      ilike(supplier.email, `%${search}%`),
                      ilike(supplier.phone, `%${search}%`),
                    ),
                  ),
                ),
            ),
            exists(
              this.db
                .select({ id: warehouse.id })
                .from(warehouse)
                .where(
                  and(
                    eq(warehouse.id, supplierPurchaseOrder.warehouseId),
                    eq(warehouse.businessId, businessId),
                    isNull(warehouse.deletedAt),
                    ilike(warehouse.name, `%${search}%`),
                  ),
                ),
            ),
          )
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(supplierPurchaseOrder)
        .where(where)
        .orderBy(desc(supplierPurchaseOrder.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(supplierPurchaseOrder)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);
    const items = await Promise.all(
      rows.map((purchaseOrder) => this.purchaseOrders.hydrate(purchaseOrder)),
    );

    return paginatedResponse(
      items,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Supplier purchase orders were loaded successfully. The response includes the requested page of purchase orders for this business and pagination metadata for browsing more results.",
    );
  }

  async findPurchaseOrder(businessId: string, purchaseOrderId: string) {
    const purchaseOrder = await this.purchaseOrders.getPurchaseOrderOrThrow(
      businessId,
      purchaseOrderId,
    );

    return apiResponse(purchaseOrder);
  }

  async updatePurchaseOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseOrderId: string,
    dto: UpdatePurchaseOrderDto,
  ) {
    const existingOrder = await this.purchaseOrders.getPurchaseOrderOrThrow(
      businessId,
      purchaseOrderId,
    );

    assertPurchaseOrderCanUpdate(existingOrder.status);

    if (dto.status !== undefined) {
      assertManualPurchaseOrderStatus(dto.status);
    }

    const shippingCost = new Decimal(
      dto.shippingCost ?? existingOrder.shippingCost,
    );
    const totalAmount = new Decimal(existingOrder.subtotal)
      .minus(existingOrder.discountTotal)
      .plus(existingOrder.taxTotal)
      .plus(shippingCost);

    const [updatedOrder] = await this.db
      .update(supplierPurchaseOrder)
      .set({
        ...(dto.expectedDeliveryDate !== undefined && {
          expectedDeliveryDate: dto.expectedDeliveryDate,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.shippingCost !== undefined && {
          shippingCost,
          totalAmount,
        }),
        ...(dto.note !== undefined && {
          note: normalizeNullableText(dto.note),
        }),
        approvedBy:
          dto.status === SupplierPurchaseOrderStatus.ORDERED
            ? currentUser.id
            : undefined,
        approvedAt:
          dto.status === SupplierPurchaseOrderStatus.ORDERED
            ? new Date()
            : undefined,
      })
      .where(eq(supplierPurchaseOrder.id, purchaseOrderId))
      .returning();

    return apiResponse(
      await this.purchaseOrders.hydrate(updatedOrder),
      "Purchase order updated successfully",
    );
  }

  async cancelPurchaseOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseOrderId: string,
    dto: CancelPurchaseOrderDto,
  ) {
    void currentUser;
    const purchaseOrder = await this.purchaseOrders.getPurchaseOrderOrThrow(
      businessId,
      purchaseOrderId,
    );

    assertPurchaseOrderCanCancel(purchaseOrder.status);

    const [cancelledOrder] = await this.db
      .update(supplierPurchaseOrder)
      .set({
        status: SupplierPurchaseOrderStatus.CANCELLED,
        note: dto.note,
      })
      .where(eq(supplierPurchaseOrder.id, purchaseOrderId))
      .returning();

    return apiResponse(
      await this.purchaseOrders.hydrate(cancelledOrder),
      "Purchase order received successfully",
    );
  }

  async removePurchaseOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseOrderId: string,
  ) {
    const purchaseOrder = await this.purchaseOrders.getPurchaseOrderOrThrow(
      businessId,
      purchaseOrderId,
    );

    assertPurchaseOrderCanRemove(purchaseOrder.status);

    await this.db
      .update(supplierPurchaseOrder)
      .set({ deletedAt: new Date(), deletedBy: currentUser.id })
      .where(eq(supplierPurchaseOrder.id, purchaseOrderId));

    return apiResponse(null, "Purchase order deleted successfully");
  }

  private handleUniqueError(error: unknown, message: string): never {
    if (isUniqueConstraintError(error)) {
      throw new BadRequestException(message);
    }

    throw error;
  }

  private async buildPurchaseOrderItems(
    businessId: string,
    items: PurchaseOrderItemDto[],
  ) {
    const builtItems: (PurchaseOrderItemDto & {
      taxId: string;
      taxRate: Decimal;
      taxAmount: Decimal;
      lineTotal: Decimal;
    })[] = [];

    for (const item of items) {
      const [productRow] = await this.db
        .select({ taxId: product.taxId })
        .from(product)
        .where(
          and(
            eq(product.id, item.productId),
            eq(product.businessId, businessId),
            isNull(product.deletedAt),
          ),
        )
        .limit(1);

      if (!productRow) {
        throw new BadRequestException("One or more purchase items are invalid");
      }

      const tax = await this.finance.assertActiveTax(
        this.db,
        businessId,
        productRow.taxId,
      );
      const itemWithTax = {
        ...item,
        taxId: tax.id,
        taxRate: new Decimal(tax.rate),
      };

      builtItems.push({
        ...itemWithTax,
        taxAmount: calculateLineTax(itemWithTax),
        lineTotal: calculateLineTotal(itemWithTax),
      });
    }

    return builtItems;
  }

  private deriveTaxSnapshot(
    items: { taxId: string }[],
    totals: ReturnType<typeof calculatePurchaseOrderTotals>,
  ) {
    const uniqueTaxIds = new Set(items.map((item) => item.taxId));
    const taxableBase = new Decimal(totals.subtotal).minus(
      totals.discountTotal,
    );
    const taxRate = taxableBase.equals(0)
      ? new Decimal(0)
      : new Decimal(totals.taxTotal)
          .mul(100)
          .div(taxableBase)
          .toDecimalPlaces(2);

    return {
      taxId: uniqueTaxIds.size === 1 ? items[0]?.taxId : null,
      taxRate,
    };
  }
}
