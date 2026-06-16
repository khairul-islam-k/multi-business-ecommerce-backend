import { describe, expect, it } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";
import { SupplierPurchaseOrderStatus } from "@/database/schema";

import {
  assertManualPurchaseOrderStatus,
  assertPurchaseOrderCanCancel,
  assertPurchaseOrderCanReceive,
  assertPurchaseOrderCanRemove,
} from "./purchase-order-status.policy";

describe("purchase order status policy", () => {
  it("allows manual draft and ordered statuses", () => {
    expect(() =>
      assertManualPurchaseOrderStatus(SupplierPurchaseOrderStatus.DRAFT),
    ).not.toThrow();
    expect(() =>
      assertManualPurchaseOrderStatus(SupplierPurchaseOrderStatus.ORDERED),
    ).not.toThrow();
  });

  it("rejects receive-managed statuses for manual updates", () => {
    expect(() =>
      assertManualPurchaseOrderStatus(SupplierPurchaseOrderStatus.RECEIVED),
    ).toThrow(BadRequestException);
  });

  it("guards receive, cancel, and remove transitions", () => {
    expect(() =>
      assertPurchaseOrderCanReceive(SupplierPurchaseOrderStatus.DRAFT),
    ).toThrow(BadRequestException);
    expect(() =>
      assertPurchaseOrderCanCancel(SupplierPurchaseOrderStatus.RECEIVED),
    ).toThrow(BadRequestException);
    expect(() =>
      assertPurchaseOrderCanRemove(SupplierPurchaseOrderStatus.ORDERED),
    ).toThrow(BadRequestException);
  });
});
