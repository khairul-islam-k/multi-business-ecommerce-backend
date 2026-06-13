import type { CurrentUserPayload } from "../../../auth/decorators/current-user.decorator";
import type { CreateSupplierPurchaseReturnDto } from "../../dto/supplier.dto";

export type CreatePurchaseReturnCommand = {
  currentUser: CurrentUserPayload;
  businessId: string;
  purchaseOrderId: string;
  dto: CreateSupplierPurchaseReturnDto;
};
