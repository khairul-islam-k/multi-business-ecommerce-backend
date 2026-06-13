import type { CurrentUserPayload } from "../../../auth/decorators/current-user.decorator";
import type { AddOrderPaymentDto } from "../../dto/order.dto";

export type AddOrderPaymentCommand = {
  currentUser: CurrentUserPayload;
  businessId: string;
  orderId: string;
  dto: AddOrderPaymentDto;
};
