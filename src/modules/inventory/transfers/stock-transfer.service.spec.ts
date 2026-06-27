import Decimal from "decimal.js";

import {
  InventoryMovementType,
  InventoryReferenceType,
  inventoryStockTransfer,
  inventoryStockTransferItem,
  InventoryTransferStatus,
} from "@/database/schema";
import { describe, expect, it, jest } from "@jest/globals";

import { StockTransferService } from "./stock-transfer.service";

const currentUser = { id: "user-1" } as never;
const businessId = "business-1";

function createService() {
  const db = {
    transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback(createTx()),
    ),
  };
  const lookup = {
    assertWarehouseExists: jest.fn(async () => ({ id: "warehouse" })),
    assertStockItem: jest.fn(async () => ({ id: "product" })),
    generateUniqueTransferNo: jest.fn(async () => "TRF-001"),
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
  const service = new StockTransferService({ db } as never, lookup as never);

  return { db, lookup, service };
}

function createTx(updatedTransfer = { id: "transfer-1" }) {
  return {
    insert: jest.fn((table) => {
      if (table === inventoryStockTransfer) {
        return {
          values: jest.fn().mockReturnValue({
            returning: jest.fn(async () => [
              {
                id: "transfer-1",
                fromWarehouseId: "warehouse-from",
                toWarehouseId: "warehouse-to",
              },
            ]),
          }),
        };
      }

      if (table === inventoryStockTransferItem) {
        return { values: jest.fn(async () => undefined) };
      }

      return { values: jest.fn(async () => undefined) };
    }),
    update: jest.fn((table) => ({
      set: jest.fn().mockReturnValue({
        where: jest
          .fn()
          .mockReturnValue(
            table === inventoryStockTransfer
              ? { returning: jest.fn(async () => [updatedTransfer]) }
              : Promise.resolve(undefined),
          ),
      }),
    })),
  };
}

describe("StockTransferService", () => {
  it("hydrates created transfers through the current transaction", async () => {
    const { db, service } = createService();
    const tx = createTx();
    const hydratedTransfer = { id: "transfer-1", items: [] };
    const findTransfer = jest
      .spyOn(service as any, "findTransferWithRelations")
      .mockResolvedValue(hydratedTransfer as never);

    db.transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(tx),
    );

    const result = await service.create(currentUser, businessId, {
      fromWarehouseId: "warehouse-from",
      toWarehouseId: "warehouse-to",
      items: [{ productId: "product-1", requestedQuantity: 2 }],
    });

    expect(result.data).toBe(hydratedTransfer);
    expect(findTransfer).toHaveBeenCalledWith(
      "transfer-1",
      undefined,
      undefined,
      tx,
    );
  });

  it("ships draft transfer items out of the source warehouse", async () => {
    const { db, lookup, service } = createService();
    const transfer = {
      id: "transfer-1",
      fromWarehouseId: "warehouse-from",
      toWarehouseId: "warehouse-to",
      note: "Move stock",
      items: [
        {
          id: "item-1",
          productId: "product-1",
          variantId: null,
          requestedQuantity: new Decimal(3),
        },
      ],
    };
    const updatedTransfer = {
      ...transfer,
      status: InventoryTransferStatus.SHIPPED,
    };
    const tx = createTx(updatedTransfer);

    db.transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(tx),
    );
    jest
      .spyOn(service as any, "findTransferWithRelations")
      .mockResolvedValue(transfer as never);
    jest
      .spyOn(service as any, "withTransferRelations")
      .mockResolvedValue(updatedTransfer as never);

    await service.ship(currentUser, businessId, "transfer-1");

    expect(lookup.applyStockDelta).toHaveBeenCalledWith(tx, {
      businessId,
      warehouseId: "warehouse-from",
      productId: "product-1",
      variantId: null,
      quantityDelta: new Decimal(-3),
      movementType: InventoryMovementType.TRANSFER_OUT,
      referenceType: InventoryReferenceType.STOCK_TRANSFER,
      referenceId: "transfer-1",
      note: "Move stock",
      createdBy: "user-1",
    });
  });
});
