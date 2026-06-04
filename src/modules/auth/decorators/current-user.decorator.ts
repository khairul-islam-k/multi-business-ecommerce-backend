import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { SystemUserStatus, SystemUserType } from "@prisma/client";

export type CurrentUserPayload = {
  id: string;
  name: string;
  email: string;
  type: SystemUserType;
  status: SystemUserStatus;
  businessId: string | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest<{
      user: CurrentUserPayload;
    }>();

    return request.user;
  },
);
