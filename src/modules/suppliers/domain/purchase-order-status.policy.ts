import { BadRequestException } from "@nestjs/common";
import { SupplierPurchaseOrderStatus } from "@/database/schema";

const ORDER_MANUAL_STATUSES: SupplierPurchaseOrderStatus[] = [
  SupplierPurchaseOrderStatus.DRAFT,
  SupplierPurchaseOrderStatus.ORDERED,
];

export function assertManualPurchaseOrderStatus(
  status: SupplierPurchaseOrderStatus,
) {
  if (!ORDER_MANUAL_STATUSES.includes(status)) {
    throw new BadRequestException(
      "Purchase order receiving statuses are managed by receive action",
    );
  }
}

export function assertPurchaseOrderCanUpdate(
  status: SupplierPurchaseOrderStatus,
) {
  if (status === SupplierPurchaseOrderStatus.RECEIVED) {
    throw new BadRequestException("Received purchase order cannot be updated");
  }
}

export function assertPurchaseOrderCanReceive(
  status: SupplierPurchaseOrderStatus,
) {
  if (status !== SupplierPurchaseOrderStatus.ORDERED) {
    throw new BadRequestException(
      "Only ordered purchase orders can be received",
    );
  }
}

export function assertPurchaseOrderCanCancel(
  status: SupplierPurchaseOrderStatus,
) {
  if (status === SupplierPurchaseOrderStatus.RECEIVED) {
    throw new BadRequestException("Received purchase orders cannot be deleted");
  }

  if (status !== SupplierPurchaseOrderStatus.ORDERED) {
    throw new BadRequestException(
      "Only ordered purchase orders can be cancelled",
    );
  }
}

export function assertPurchaseOrderCanRemove(
  status: SupplierPurchaseOrderStatus,
) {
  if (status !== SupplierPurchaseOrderStatus.DRAFT) {
    throw new BadRequestException("Only draft purchase orders can be deleted");
  }
}
