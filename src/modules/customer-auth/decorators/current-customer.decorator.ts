import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import type { CurrentCustomerPayload } from "../strategies/customer-jwt.strategy";

export const CurrentCustomer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentCustomerPayload => {
    const request = ctx.switchToHttp().getRequest<{
      user: CurrentCustomerPayload;
    }>();

    return request.user;
  },
);
