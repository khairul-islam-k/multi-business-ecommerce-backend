import Decimal from "decimal.js";

import {
  InventoryAdjustmentStatus,
  InventoryAdjustmentType,
  InventoryMovementType,
  InventoryReferenceType,
  inventoryStockAdjustment,
  inventoryStockAdjustmentItem,
} from "@/database/schema";
import { describe, expect, it, jest } from "@jest/globals";

import { StockAdjustmentService } from "./stock-adjustment.service";

const currentUser = { id: "user-1" } as never;
const businessId = "business-1";

function createService() {
  const db = {
    transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback(createTx()),
    ),
  };
  const lookup = {
    assertWarehouseExists: jest.fn(async () => ({ id: "warehouse-1" })),
    assertStockItem: jest.fn(async () => ({ id: "product-1" })),
    getWarehouseStock: jest.fn(async () => ({
      totalQuantity: new Decimal(10),
    })),
    generateUniqueAdjustmentNo: jest.fn(async () => "ADJ-001"),
    normalizeNullableText: jest.fn(
      (value?: string | null) => value?.trim() || null,
    ),
    buildStockItemKey: jest.fn(
      (productId: string, variantId?: string | null) =>
        `${productId}:${variantId ?? ""}`,
    ),
    applyStockDelta: jest.fn(async (..._args: unknown[]) => ({
      id: "stock-1",
    })),
  };
  const service = new StockAdjustmentService({ db } as never, lookup as never);

  return { db, lookup, service };
}

function createTx(updatedAdjustment = { id: "adjustment-1" }) {
  return {
    insert: jest.fn((table) => {
      if (table === inventoryStockAdjustment) {
        return {
          values: jest.fn().mockReturnValue({
            returning: jest.fn(async () => [
              {
                id: "adjustment-1",
                warehouseId: "warehouse-1",
              },
            ]),
          }),
        };
      }

      if (table === inventoryStockAdjustmentItem) {
        return { values: jest.fn(async () => undefined) };
      }

      return { values: jest.fn(async () => undefined) };
    }),
    update: jest.fn((table) => ({
      set: jest.fn().mockReturnValue({
        where: jest
          .fn()
          .mockReturnValue(
            table === inventoryStockAdjustment
              ? { returning: jest.fn(async () => [updatedAdjustment]) }
              : Promise.resolve(undefined),
          ),
      }),
    })),
  };
}

describe("StockAdjustmentService", () => {
  it("hydrates created adjustments through the current transaction", async () => {
    const { db, service } = createService();
    const tx = createTx();
    const hydratedAdjustment = { id: "adjustment-1", items: [] };
    const findAdjustment = jest
      .spyOn(service as any, "findAdjustmentWithRelations")
      .mockResolvedValue(hydratedAdjustment as never);

    db.transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(tx),
    );

    const result = await service.create(currentUser, businessId, {
      warehouseId: "warehouse-1",
      adjustmentType: InventoryAdjustmentType.INCREASE,
      items: [{ productId: "product-1", adjustmentQty: 5 }],
    });

    expect(result.data).toBe(hydratedAdjustment);
    expect(findAdjustment).toHaveBeenCalledWith(
      "adjustment-1",
      undefined,
      undefined,
      tx,
    );
  });

  it("applies decrease approvals as negative stock movements", async () => {
    const { db, lookup, service } = createService();
    const adjustment = {
      id: "adjustment-1",
      warehouseId: "warehouse-1",
      adjustmentType: InventoryAdjustmentType.DECREASE,
      reason: "Cycle count",
      items: [
        {
          id: "item-1",
          productId: "product-1",
          variantId: null,
          adjustmentQty: new Decimal(4),
          reason: null,
        },
      ],
    };
    const updatedAdjustment = {
      ...adjustment,
      status: InventoryAdjustmentStatus.APPROVED,
    };
    const tx = createTx(updatedAdjustment);

    db.transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(tx),
    );
    jest
      .spyOn(service as any, "findAdjustmentWithRelations")
      .mockResolvedValue(adjustment as never);
    jest
      .spyOn(service as any, "withAdjustmentRelations")
      .mockResolvedValue(updatedAdjustment as never);

    await service.approve(currentUser, businessId, "adjustment-1");

    expect(lookup.applyStockDelta).toHaveBeenCalledWith(tx, {
      businessId,
      warehouseId: "warehouse-1",
      productId: "product-1",
      variantId: null,
      quantityDelta: new Decimal(-4),
      movementType: InventoryMovementType.ADJUSTMENT_OUT,
      referenceType: InventoryReferenceType.STOCK_ADJUSTMENT,
      referenceId: "adjustment-1",
      note: "Cycle count",
      createdBy: "user-1",
    });
  });
});
