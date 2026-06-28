import Decimal from "decimal.js";
import { and, asc, count, desc, eq, ilike, ne, or } from "drizzle-orm";

import {
  financeReceivable,
  FinanceReceivableStatus,
  FinanceSourceType,
  financeTax,
  InventoryMovementType,
  InventoryReferenceType,
  supplier,
  SupplierInvoice,
  supplierInvoice,
  SupplierInvoiceStatus,
  SupplierPurchaseOrder,
  supplierPurchaseOrder,
  SupplierPurchaseOrderItem,
  supplierPurchaseOrderItem,
  SupplierPurchaseOrderStatus,
  SupplierPurchaseReturn,
  supplierPurchaseReturn,
  supplierPurchaseReturnItem,
  SupplierPurchaseReturnStatus,
} from "@/database/schema";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import { DatabaseService } from "../../../database/database.service";
import { FinanceLedgerService } from "../../finance/common/finance-ledger.service";
import { InventoryLookupService } from "../../inventory/common/inventory-lookup.service";
import {
  assertPurchaseReturnItems,
  calculatePurchaseReturnTotals,
} from "../domain/purchase-return.policy";
import { normalizeNullableText } from "../domain/supplier-contact.policy";
import {
  CreateSupplierPurchaseReturnDto,
  QuerySupplierPurchaseReturnDto,
} from "../dto/supplier.dto";
import { SupplierCodeRepository } from "../infrastructure/supplier-code.repository";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

type PurchaseOrderForReturn = SupplierPurchaseOrder & {
  items: SupplierPurchaseOrderItem[];
  invoices: SupplierInvoice[];
};

@Injectable()
export class PurchaseReturnService {
  constructor(
    private readonly database: DatabaseService,
    private readonly inventoryLookup: InventoryLookupService,
    private readonly finance: FinanceLedgerService,
    private readonly codes: SupplierCodeRepository,
  ) {}

  private get db() {
    return this.database.db;
  }

  async createPurchaseReturn(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseOrderId: string,
    dto: CreateSupplierPurchaseReturnDto,
  ) {
    assertPurchaseReturnItems(dto.items);

    const purchaseOrder = await this.getReceivedPurchaseOrder(
      businessId,
      purchaseOrderId,
    );
    const supplierInvoiceRow = purchaseOrder.invoices[0];

    if (!supplierInvoiceRow) {
      throw new BadRequestException(
        "Purchase order must be received before return",
      );
    }

    const items = await this.buildPurchaseReturnItems(
      businessId,
      purchaseOrder,
      dto.items,
    );
    const totals = calculatePurchaseReturnTotals(items);
    const taxSnapshot = this.deriveTaxSnapshot(items, totals);

    const purchaseReturn = await this.db.transaction(async (tx) => {
      const [createdReturn] = await tx
        .insert(supplierPurchaseReturn)
        .values({
          businessId,
          supplierId: purchaseOrder.supplierId,
          purchaseOrderId: purchaseOrder.id,
          supplierInvoiceId: supplierInvoiceRow.id,
          warehouseId: purchaseOrder.warehouseId,
          taxId: taxSnapshot.taxId,
          returnNo: await this.codes.generateUniqueReturnNo(businessId),
          returnDate: new Date(),
          status: SupplierPurchaseReturnStatus.PENDING,
          reason: normalizeNullableText(dto.reason),
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          taxRate: taxSnapshot.taxRate,
          totalAmount: totals.totalAmount,
          createdBy: currentUser.id,
        })
        .returning();

      await tx.insert(supplierPurchaseReturnItem).values(
        items.map((item) => ({
          purchaseReturnId: createdReturn.id,
          productId: item.productId,
          variantId: item.variantId,
          taxId: item.taxId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          discountAmount: item.discountAmount,
          taxAmount: item.taxAmount,
          taxRate: item.taxRate,
          lineTotal: item.lineTotal,
          reason: normalizeNullableText(item.reason),
        })),
      );

      for (const item of items) {
        await this.inventoryLookup.reserveStock(tx, {
          businessId,
          warehouseId: purchaseOrder.warehouseId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          referenceType: InventoryReferenceType.PURCHASE_RETURN,
          referenceId: createdReturn.id,
          note: dto.reason,
          createdBy: currentUser.id,
        });
      }

      await this.finance.createSupplierReturnReceivable(tx, {
        businessId,
        supplierId: purchaseOrder.supplierId,
        supplierReturnId: createdReturn.id,
        totalAmount: totals.totalAmount,
        note: dto.reason,
      });

      return this.hydrateReturn(createdReturn);
    });

    return apiResponse(
      purchaseReturn,
      "Supplier purchase return request created successfully",
    );
  }

  async findPurchaseReturns(
    businessId: string,
    query: QuerySupplierPurchaseReturnDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(supplierPurchaseReturn.businessId, businessId),
      query.supplierId
        ? eq(supplierPurchaseReturn.supplierId, query.supplierId)
        : undefined,
      query.purchaseOrderId
        ? eq(supplierPurchaseReturn.purchaseOrderId, query.purchaseOrderId)
        : undefined,
      query.status
        ? eq(supplierPurchaseReturn.status, query.status)
        : undefined,
      query.search
        ? or(
            ilike(supplierPurchaseReturn.returnNo, `%${query.search}%`),
            ilike(supplierPurchaseReturn.reason, `%${query.search}%`),
          )
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(supplierPurchaseReturn)
        .where(where)
        .orderBy(desc(supplierPurchaseReturn.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(supplierPurchaseReturn)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);
    const items = await Promise.all(rows.map((row) => this.hydrateReturn(row)));

    return paginatedResponse(
      items,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Supplier purchase returns were loaded successfully. The response includes the requested page of return records for this business and pagination metadata for browsing more results.",
    );
  }

  async findPurchaseReturn(businessId: string, purchaseReturnId: string) {
    const purchaseReturn = await this.findReturnRow(
      businessId,
      purchaseReturnId,
    );

    if (!purchaseReturn) {
      throw new NotFoundException("Supplier purchase return not found");
    }

    return apiResponse(await this.hydrateReturn(purchaseReturn));
  }

  async completePurchaseReturn(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseReturnId: string,
  ) {
    const purchaseReturn = await this.getPendingReturn(
      businessId,
      purchaseReturnId,
    );

    const completedReturn = await this.db.transaction(async (tx) => {
      for (const item of purchaseReturn.items) {
        await this.inventoryLookup.deductReservedStock(tx, {
          businessId,
          warehouseId: purchaseReturn.warehouseId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          movementType: InventoryMovementType.PURCHASE_RETURN_OUT,
          referenceType: InventoryReferenceType.PURCHASE_RETURN,
          referenceId: purchaseReturn.id,
          note: purchaseReturn.reason,
          createdBy: currentUser.id,
        });
      }

      const [updatedReturn] = await tx
        .update(supplierPurchaseReturn)
        .set({ status: SupplierPurchaseReturnStatus.COMPLETED })
        .where(eq(supplierPurchaseReturn.id, purchaseReturn.id))
        .returning();

      return this.hydrateReturn(updatedReturn);
    });

    return apiResponse(
      completedReturn,
      "Supplier purchase return completed successfully",
    );
  }

  async cancelPurchaseReturn(businessId: string, purchaseReturnId: string) {
    const purchaseReturn = await this.getPendingReturn(
      businessId,
      purchaseReturnId,
    );

    const cancelledReturn = await this.db.transaction(async (tx) => {
      for (const item of purchaseReturn.items) {
        await this.inventoryLookup.releaseStockReservation(tx, {
          businessId,
          warehouseId: purchaseReturn.warehouseId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          referenceType: InventoryReferenceType.PURCHASE_RETURN,
          referenceId: purchaseReturn.id,
          note: purchaseReturn.reason,
        });
      }

      await tx
        .update(financeReceivable)
        .set({ status: FinanceReceivableStatus.CANCELLED })
        .where(
          and(
            eq(financeReceivable.businessId, businessId),
            eq(financeReceivable.sourceType, FinanceSourceType.SUPPLIER_RETURN),
            eq(financeReceivable.sourceId, purchaseReturn.id),
            ne(financeReceivable.status, FinanceReceivableStatus.RECEIVED),
          ),
        );

      const [updatedReturn] = await tx
        .update(supplierPurchaseReturn)
        .set({ status: SupplierPurchaseReturnStatus.CANCELLED })
        .where(eq(supplierPurchaseReturn.id, purchaseReturn.id))
        .returning();

      return this.hydrateReturn(updatedReturn);
    });

    return apiResponse(
      cancelledReturn,
      "Supplier purchase return cancelled successfully",
    );
  }

  private async getReceivedPurchaseOrder(
    businessId: string,
    purchaseOrderId: string,
  ): Promise<PurchaseOrderForReturn> {
    const [purchaseOrder] = await this.db
      .select()
      .from(supplierPurchaseOrder)
      .where(
        and(
          eq(supplierPurchaseOrder.id, purchaseOrderId),
          eq(supplierPurchaseOrder.businessId, businessId),
          eq(
            supplierPurchaseOrder.status,
            SupplierPurchaseOrderStatus.RECEIVED,
          ),
        ),
      );

    if (!purchaseOrder) {
      throw new NotFoundException("Received purchase order not found");
    }

    const [items, invoices] = await Promise.all([
      this.db
        .select()
        .from(supplierPurchaseOrderItem)
        .where(eq(supplierPurchaseOrderItem.purchaseOrderId, purchaseOrder.id)),
      this.db
        .select()
        .from(supplierInvoice)
        .where(
          and(
            eq(supplierInvoice.purchaseOrderId, purchaseOrder.id),
            ne(supplierInvoice.status, SupplierInvoiceStatus.CANCELLED),
          ),
        )
        .orderBy(desc(supplierInvoice.createdAt)),
    ]);

    return { ...purchaseOrder, items, invoices };
  }

  private async getPendingReturn(businessId: string, purchaseReturnId: string) {
    const purchaseReturn = await this.findReturnRow(
      businessId,
      purchaseReturnId,
      SupplierPurchaseReturnStatus.PENDING,
    );

    if (!purchaseReturn) {
      throw new NotFoundException("Pending supplier purchase return not found");
    }

    const items = await this.db
      .select()
      .from(supplierPurchaseReturnItem)
      .where(
        eq(supplierPurchaseReturnItem.purchaseReturnId, purchaseReturn.id),
      );

    return { ...purchaseReturn, items };
  }

  private async findReturnRow(
    businessId: string,
    purchaseReturnId: string,
    status?: SupplierPurchaseReturnStatus,
  ) {
    const [purchaseReturn] = await this.db
      .select()
      .from(supplierPurchaseReturn)
      .where(
        and(
          eq(supplierPurchaseReturn.id, purchaseReturnId),
          eq(supplierPurchaseReturn.businessId, businessId),
          status ? eq(supplierPurchaseReturn.status, status) : undefined,
        ),
      );

    return purchaseReturn ?? null;
  }

  private async hydrateReturn(purchaseReturn: SupplierPurchaseReturn) {
    const [supplierRow, purchaseOrder, supplierInvoiceRow, tax, items] =
      await Promise.all([
        this.db
          .select()
          .from(supplier)
          .where(eq(supplier.id, purchaseReturn.supplierId))
          .then(([row]) => row ?? null),
        purchaseReturn.purchaseOrderId
          ? this.db
              .select()
              .from(supplierPurchaseOrder)
              .where(
                eq(supplierPurchaseOrder.id, purchaseReturn.purchaseOrderId),
              )
              .then(([row]) => row ?? null)
          : Promise.resolve(null),
        purchaseReturn.supplierInvoiceId
          ? this.db
              .select()
              .from(supplierInvoice)
              .where(eq(supplierInvoice.id, purchaseReturn.supplierInvoiceId))
              .then(([row]) => row ?? null)
          : Promise.resolve(null),
        purchaseReturn.taxId
          ? this.db
              .select()
              .from(financeTax)
              .where(eq(financeTax.id, purchaseReturn.taxId))
              .then(([row]) => row ?? null)
          : Promise.resolve(null),
        this.db
          .select()
          .from(supplierPurchaseReturnItem)
          .where(
            eq(supplierPurchaseReturnItem.purchaseReturnId, purchaseReturn.id),
          )
          .orderBy(asc(supplierPurchaseReturnItem.createdAt)),
      ]);

    return {
      ...purchaseReturn,
      supplier: supplierRow,
      purchaseOrder,
      supplierInvoice: supplierInvoiceRow,
      tax,
      items,
    };
  }

  private async buildPurchaseReturnItems(
    businessId: string,
    purchaseOrder: PurchaseOrderForReturn,
    requestedItems: {
      productId: string;
      variantId?: string | null;
      quantity: number;
      reason?: string;
    }[],
  ) {
    const purchaseOrderItemMap = new Map(
      purchaseOrder.items.map((item) => [
        this.inventoryLookup.buildStockItemKey(item.productId, item.variantId),
        item,
      ]),
    );
    const existingReturnItems = await this.db
      .select({
        productId: supplierPurchaseReturnItem.productId,
        variantId: supplierPurchaseReturnItem.variantId,
        quantity: supplierPurchaseReturnItem.quantity,
      })
      .from(supplierPurchaseReturnItem)
      .innerJoin(
        supplierPurchaseReturn,
        eq(
          supplierPurchaseReturn.id,
          supplierPurchaseReturnItem.purchaseReturnId,
        ),
      )
      .where(
        and(
          eq(supplierPurchaseReturn.businessId, businessId),
          eq(supplierPurchaseReturn.purchaseOrderId, purchaseOrder.id),
          ne(
            supplierPurchaseReturn.status,
            SupplierPurchaseReturnStatus.CANCELLED,
          ),
        ),
      );
    const returnedQuantityByItem = new Map<string, Decimal>();

    for (const item of existingReturnItems) {
      const itemKey = this.inventoryLookup.buildStockItemKey(
        item.productId,
        item.variantId,
      );
      const current = returnedQuantityByItem.get(itemKey) ?? new Decimal(0);

      returnedQuantityByItem.set(itemKey, current.plus(item.quantity));
    }

    return requestedItems.map((requestedItem) => {
      const itemKey = this.inventoryLookup.buildStockItemKey(
        requestedItem.productId,
        requestedItem.variantId,
      );
      const purchaseOrderItem = purchaseOrderItemMap.get(itemKey);

      if (
        !purchaseOrderItem ||
        purchaseOrderItem.productId !== requestedItem.productId
      ) {
        throw new BadRequestException(
          "One or more purchase return items are invalid",
        );
      }

      const quantity = new Decimal(requestedItem.quantity);
      const alreadyReturned =
        returnedQuantityByItem.get(itemKey) ?? new Decimal(0);
      const remainingReturnable = new Decimal(
        purchaseOrderItem.quantityReceived,
      ).minus(alreadyReturned);

      if (quantity.greaterThan(remainingReturnable)) {
        throw new BadRequestException(
          "Return quantity cannot exceed remaining received quantity",
        );
      }

      const orderedQuantity = new Decimal(purchaseOrderItem.quantityOrdered);
      const discountPerUnit = new Decimal(purchaseOrderItem.discountAmount).div(
        orderedQuantity,
      );
      const subtotal = quantity.mul(purchaseOrderItem.unitCost);
      const discountAmount = discountPerUnit.mul(quantity).toDecimalPlaces(2);
      const taxableAmount = subtotal.minus(discountAmount);
      const taxAmount = taxableAmount
        .mul(purchaseOrderItem.taxRate)
        .div(100)
        .toDecimalPlaces(2);

      return {
        productId: requestedItem.productId,
        variantId: requestedItem.variantId ?? null,
        taxId: purchaseOrderItem.taxId,
        quantity,
        unitCost: purchaseOrderItem.unitCost,
        discountAmount,
        taxRate: purchaseOrderItem.taxRate,
        taxAmount,
        lineTotal: taxableAmount.plus(taxAmount),
        reason: requestedItem.reason,
      };
    });
  }

  private deriveTaxSnapshot(
    items: { taxId: string }[],
    totals: ReturnType<typeof calculatePurchaseReturnTotals>,
  ) {
    const uniqueTaxIds = new Set(items.map((item) => item.taxId));
    const taxableBase = totals.subtotal.minus(totals.discountTotal);
    const taxRate = taxableBase.equals(0)
      ? new Decimal(0)
      : totals.taxTotal.mul(100).div(taxableBase).toDecimalPlaces(2);

    return {
      taxId: uniqueTaxIds.size === 1 ? items[0]?.taxId : null,
      taxRate,
    };
  }
}
