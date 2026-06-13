import type { CurrentUserPayload } from "../../../auth/decorators/current-user.decorator";
import type { ReceivePurchaseOrderDto } from "../../dto/supplier.dto";

export type ReceivePurchaseOrderCommand = {
  currentUser: CurrentUserPayload;
  businessId: string;
  purchaseOrderId: string;
  dto: ReceivePurchaseOrderDto;
};
