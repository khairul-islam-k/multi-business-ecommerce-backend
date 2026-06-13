import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  BusinessMemberStatus,
  BusinessStatus,
  Prisma,
  SystemUserType,
} from "@prisma/client";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import {
  BusinessAccessContext,
  getBusinessAccessCacheKey,
} from "../../../common/request-context/request-context.types";

import { PrismaService } from "../../../prisma/prisma.service";

const ACCESSIBLE_BUSINESS_STATUSES = [
  BusinessStatus.TRIAL,
  BusinessStatus.ACTIVE,
] satisfies BusinessStatus[];

@Injectable()
export class BusinessAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async assertCanAccessBusiness(
    currentUser: CurrentUserPayload,
    businessId: string,
  ): Promise<BusinessAccessContext> {
    const cacheKey = getBusinessAccessCacheKey(currentUser.id, businessId);
    const cachedAccess = this.requestContext.getBusinessAccess(cacheKey);

    if (cachedAccess) {
      return cachedAccess;
    }

    const where: Prisma.BusinessWhereInput = {
      id: businessId,
      deletedAt: null,
      ...(currentUser.type !== SystemUserType.ADMIN && {
        status: {
          in: ACCESSIBLE_BUSINESS_STATUSES,
        },
        ...this.getBusinessAccessWhere(currentUser),
      }),
    };

    const business = await this.prisma.business.findFirst({
      where,
      select: {
        id: true,
        ownerUserId: true,
      },
    });

    if (!business) {
      throw new ForbiddenException(
        "You do not have permission for this business",
      );
    }

    const accessContext = {
      businessId: business.id,
      isAdmin: currentUser.type === SystemUserType.ADMIN,
      isOwner: business.ownerUserId === currentUser.id,
    };

    this.requestContext.setBusinessAccess(cacheKey, accessContext);

    return accessContext;
  }

  private getBusinessAccessWhere(
    currentUser: CurrentUserPayload,
  ): Prisma.BusinessWhereInput {
    if (currentUser.type === SystemUserType.ADMIN) {
      return {};
    }

    return {
      AND: [
        {
          OR: [
            { status: BusinessStatus.ACTIVE },
            { status: BusinessStatus.TRIAL },
          ],
          deletedAt: null,
        },
        {
          OR: [
            {
              ownerUserId: currentUser.id,
            },
            {
              members: {
                some: {
                  userId: currentUser.id,
                  status: BusinessMemberStatus.ACTIVE,
                  deletedAt: null,
                },
              },
            },
          ],
        },
      ],
    };
  }
}
