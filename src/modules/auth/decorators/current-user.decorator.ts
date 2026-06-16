import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { SystemUserStatus, SystemUserType } from "@/database/schema";

export type CurrentUserPayload = {
  id: string;
  name: string;
  email: string;
  type: SystemUserType;
  status: SystemUserStatus;
  businessId: string | null;
  tenantId: string | null;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest<{
      user: CurrentUserPayload;
    }>();

    return request.user;
  },
);
