import type { CurrentUserPayload } from "../../../auth/decorators/current-user.decorator";

export type TransitionOrderStatusCommand = {
  currentUser: CurrentUserPayload;
  businessId: string;
  orderId: string;
};
