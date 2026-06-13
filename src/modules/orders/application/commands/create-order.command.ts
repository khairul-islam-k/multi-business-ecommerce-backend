import type { CurrentUserPayload } from "../../../auth/decorators/current-user.decorator";
import type { CreateOrderDto } from "../../dto/order.dto";

export type CreateOrderCommand = {
  currentUser: CurrentUserPayload;
  businessId: string;
  dto: CreateOrderDto;
};
