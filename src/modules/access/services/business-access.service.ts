import { ForbiddenException, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  BusinessMemberStatus,
  BusinessStatus,
  business,
  businessMember,
  SystemUserType,
} from "@/database/schema";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { DatabaseService } from "../../../database/database.service";
import {
  BusinessAccessContext,
  getBusinessAccessCacheKey,
} from "../../../common/request-context/request-context.types";

@Injectable()
export class BusinessAccessService {
  constructor(
    private readonly database: DatabaseService,
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

    const [matchedBusiness] = await this.database.db
      .select({
        id: business.id,
        ownerUserId: business.ownerUserId,
      })
      .from(business)
      .where(
        and(
          eq(business.id, businessId),
          this.getBusinessAccessCondition(currentUser),
        ),
      )
      .limit(1);

    if (!matchedBusiness) {
      throw new ForbiddenException(
        "You do not have permission for this business",
      );
    }

    const accessContext = {
      businessId: matchedBusiness.id,
      isAdmin: currentUser.type === SystemUserType.ADMIN,
      isOwner: matchedBusiness.ownerUserId === currentUser.id,
    };

    this.requestContext.setBusinessAccess(cacheKey, accessContext);

    return accessContext;
  }

  private getBusinessAccessCondition(currentUser: CurrentUserPayload) {
    if (currentUser.type === SystemUserType.ADMIN) {
      return undefined;
    }

    return and(
      eq(business.status, BusinessStatus.ACTIVE),
      isNull(business.deletedAt),
      or(
        eq(business.ownerUserId, currentUser.id),
        sql`exists (
          select 1
          from ${businessMember}
          where ${businessMember.businessId} = ${business.id}
            and ${businessMember.userId} = ${currentUser.id}
            and ${businessMember.status} = ${BusinessMemberStatus.ACTIVE}
            and ${businessMember.deletedAt} is null
        )`,
      ),
    );
  }
}
