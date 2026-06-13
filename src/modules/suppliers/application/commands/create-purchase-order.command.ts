import type { CurrentUserPayload } from "../../../auth/decorators/current-user.decorator";
import type { CreatePurchaseOrderDto } from "../../dto/supplier.dto";

export type CreatePurchaseOrderCommand = {
  currentUser: CurrentUserPayload;
  businessId: string;
  dto: CreatePurchaseOrderDto;
};
