import Decimal from "decimal.js";

import { describe, expect, it } from "@jest/globals";

import { StockReservationService } from "./stock-reservation.service";

describe("StockReservationService", () => {
  it("auto-selects an active warehouse with enough available quantity and stable tie-breaking", async () => {
    const service = new StockReservationService();
    const rows = [
      {
        warehouseStock: {
          id: "warehouse-stock-low",
          warehouseId: "warehouse-low",
          totalQuantity: new Decimal(10),
          quantityReserved: new Decimal(6),
        },
        warehouseCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        warehouseStock: {
          id: "warehouse-stock-newer",
          warehouseId: "warehouse-newer",
          totalQuantity: new Decimal(8),
          quantityReserved: new Decimal(0),
        },
        warehouseCreatedAt: new Date("2026-01-03T00:00:00.000Z"),
      },
      {
        warehouseStock: {
          id: "warehouse-stock-older",
          warehouseId: "warehouse-older",
          totalQuantity: new Decimal(12),
          quantityReserved: new Decimal(4),
        },
        warehouseCreatedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ];
    const tx = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: async () => rows,
            }),
          }),
        }),
      }),
    };

    const selected = await (service as any).findAutoWarehouseStock(tx, {
      businessId: "business-1",
      stockItemKey: "product-1",
      quantity: new Decimal(5),
    });

    expect(selected.id).toBe("warehouse-stock-older");
    expect(selected.availableQuantity.toString()).toBe("8");
  });
});
