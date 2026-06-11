import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BusinessMemberStatus,
  BusinessStatus,
  Prisma,
  SystemUserType,
} from "@prisma/client";

import { RequestContextService } from "../../common/request-context/request-context.service";
import {
  BusinessAccessContext,
  getBusinessAccessCacheKey,
} from "../../common/request-context/request-context.types";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import { throwConflictOnUnique } from "../../common/database/prisma-error.util";
import { generateRandomSlug } from "../../common/utils/slug-generator.util";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { QueryBusinessDto } from "./dto/query-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

const BUSINESS_INCLUDE = {
  ownerUser: {
    select: {
      id: true,
      name: true,
      email: true,
      type: true,
      status: true,
    },
  },
  settings: true,
  branding: true,
  _count: {
    select: {
      members: true,
    },
  },
} satisfies Prisma.BusinessInclude;

const ACCESSIBLE_BUSINESS_STATUSES = [
  BusinessStatus.TRIAL,
  BusinessStatus.ACTIVE,
] satisfies BusinessStatus[];

const BUSINESS_SLUG_MAX_LENGTH = 180;
const BUSINESS_SLUG_RETRY_LIMIT = 5;

@Injectable()
export class BusinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async create(
    userId: string,
    dto: CreateBusinessDto,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;

    const slug = await this.generateUniqueBusinessSlug(
      dto.name,
      userId,
      client,
    );

    const settingsData = dto.settings
      ? this.buildBusinessSettingData(dto.settings)
      : {};

    const brandingData = dto.branding
      ? this.buildBusinessBrandingData(dto.branding)
      : {};

    try {
      const business = await client.business.create({
        data: {
          name: dto.name.trim(),
          slug,
          email: dto.email ? this.normalizeEmail(dto.email) : null,
          phone: dto.phone?.trim() || null,
          country: dto.country?.trim() || null,
          currencyCode: dto.currencyCode?.trim().toUpperCase() || "BDT",
          timezone: dto.timezone?.trim() || "Asia/Dhaka",
          status: dto.status ?? BusinessStatus.TRIAL,

          ownerUser: {
            connect: {
              id: userId,
            },
          },

          createdBy: {
            connect: {
              id: userId,
            },
          },

          settings: {
            create: settingsData,
          },

          branding: {
            create: brandingData,
          },
        },
        include: BUSINESS_INCLUDE,
      });

      return apiResponse(business, "Business created successfully");
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(currentUser: CurrentUserPayload, query: QueryBusinessDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder ?? "desc";

    const canIncludeDeleted =
      currentUser.type === SystemUserType.ADMIN && query.includeDeleted;

    const searchWhere: Prisma.BusinessWhereInput | undefined = query.search
      ? {
          OR: [
            {
              name: {
                contains: query.search,
                mode: "insensitive",
              },
            },
            {
              slug: {
                contains: query.search,
                mode: "insensitive",
              },
            },
            {
              email: {
                contains: query.search,
                mode: "insensitive",
              },
            },
            {
              phone: {
                contains: query.search,
                mode: "insensitive",
              },
            },
            {
              country: {
                contains: query.search,
                mode: "insensitive",
              },
            },
          ],
        }
      : undefined;

    const statusWhere: Prisma.BusinessWhereInput =
      currentUser.type === SystemUserType.ADMIN
        ? {
            ...(query.status && {
              status: query.status,
            }),
          }
        : {
            ...(query.status
              ? {
                  AND: [
                    {
                      status: {
                        in: ACCESSIBLE_BUSINESS_STATUSES,
                      },
                    },
                    {
                      status: query.status,
                    },
                  ],
                }
              : {
                  status: {
                    in: ACCESSIBLE_BUSINESS_STATUSES,
                  },
                }),
          };

    const where: Prisma.BusinessWhereInput = {
      ...(!canIncludeDeleted && {
        deletedAt: null,
      }),

      AND: [
        this.getBusinessAccessWhere(currentUser),
        statusWhere,
        ...(searchWhere ? [searchWhere] : []),
      ],

      ...(query.country && {
        country: {
          equals: query.country,
          mode: "insensitive",
        },
      }),

      ...(query.currencyCode && {
        currencyCode: {
          equals: query.currencyCode,
          mode: "insensitive",
        },
      }),
    };

    const orderBy: Prisma.BusinessOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const items = await this.prisma.business.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: BUSINESS_INCLUDE,
    });

    const total = await this.prisma.business.count({
      where,
    });

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(currentUser: CurrentUserPayload, businessId: string) {
    const business = await this.prisma.business.findFirst({
      where: {
        id: businessId,
        deletedAt: null,
        ...this.getBusinessAccessWhere(currentUser),
      },
      include: BUSINESS_INCLUDE,
    });

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    return apiResponse(business);
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: UpdateBusinessDto,
  ) {
    await this.assertCanManageBusiness(currentUser, businessId);

    const settingData = dto.settings
      ? this.buildBusinessSettingData(dto.settings)
      : null;

    const brandingData = dto.branding
      ? this.buildBusinessBrandingData(dto.branding)
      : null;

    const data: Prisma.BusinessUpdateInput = {
      ...(dto.name !== undefined && {
        name: dto.name.trim(),
      }),

      ...(dto.email !== undefined && {
        email: dto.email ? this.normalizeEmail(dto.email) : null,
      }),

      ...(dto.phone !== undefined && {
        phone: dto.phone?.trim() || null,
      }),

      ...(dto.country !== undefined && {
        country: dto.country?.trim() || null,
      }),

      ...(dto.currencyCode !== undefined && {
        currencyCode: dto.currencyCode.trim().toUpperCase(),
      }),

      ...(dto.timezone !== undefined && {
        timezone: dto.timezone.trim(),
      }),

      ...(dto.status !== undefined && {
        status: dto.status,
      }),

      updatedBy: {
        connect: {
          id: currentUser.id,
        },
      },

      ...(settingData &&
        this.hasKeys(settingData) && {
          settings: {
            upsert: {
              create: settingData,
              update: settingData,
            },
          },
        }),

      ...(brandingData &&
        this.hasKeys(brandingData) && {
          branding: {
            upsert: {
              create: brandingData,
              update: brandingData,
            },
          },
        }),
    };

    try {
      const business = await this.prisma.business.update({
        where: {
          id: businessId,
        },
        data,
        include: BUSINESS_INCLUDE,
      });

      return apiResponse(business, "Business updated successfully");
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(currentUser: CurrentUserPayload, businessId: string) {
    const business = await this.assertCanDeleteBusiness(
      currentUser,
      businessId,
    );

    const activeOwnedBusinessCount = await this.prisma.business.count({
      where: {
        ownerUserId: business.ownerUserId,
        deletedAt: null,
        status: {
          in: ACCESSIBLE_BUSINESS_STATUSES,
        },
      },
    });

    const isActiveOwnedBusiness =
      business.status === BusinessStatus.ACTIVE ||
      business.status === BusinessStatus.TRIAL;

    if (isActiveOwnedBusiness && activeOwnedBusinessCount <= 1) {
      throw new ForbiddenException(
        "You must have at least one active business",
      );
    }

    await this.prisma.business.update({
      where: {
        id: businessId,
      },
      data: {
        status: BusinessStatus.INACTIVE,
        deletedAt: new Date(),
        updatedBy: {
          connect: {
            id: currentUser.id,
          },
        },
      },
    });

    return apiResponse(null, "Business deleted successfully");
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

  async assertCanManageBusiness(
    currentUser: CurrentUserPayload,
    businessId: string,
  ) {
    return this.assertCanAccessBusiness(currentUser, businessId);
  }

  private async assertCanDeleteBusiness(
    currentUser: CurrentUserPayload,
    businessId: string,
  ) {
    const access = await this.assertCanAccessBusiness(currentUser, businessId);

    if (!access.isAdmin && !access.isOwner) {
      throw new ForbiddenException(
        "Only the business owner can delete this business",
      );
    }

    const business = await this.prisma.business.findFirst({
      where: {
        id: businessId,
        deletedAt: null,
      },
      select: {
        id: true,
        ownerUserId: true,
        status: true,
      },
    });

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    return business;
  }

  private buildBusinessSettingData(
    dto: NonNullable<CreateBusinessDto["settings"]>,
  ) {
    return {
      ...(dto.orderPrefix !== undefined && {
        orderPrefix: dto.orderPrefix.trim().toUpperCase(),
      }),

      ...(dto.invoicePrefix !== undefined && {
        invoicePrefix: dto.invoicePrefix.trim().toUpperCase(),
      }),

      ...(dto.lowStockThreshold !== undefined && {
        lowStockThreshold: dto.lowStockThreshold,
      }),

      ...(dto.allowBackorder !== undefined && {
        allowBackorder: dto.allowBackorder,
      }),

      ...(dto.autoConfirmOrder !== undefined && {
        autoConfirmOrder: dto.autoConfirmOrder,
      }),

      ...(dto.codEnabled !== undefined && {
        codEnabled: dto.codEnabled,
      }),

      ...(dto.onlinePaymentEnabled !== undefined && {
        onlinePaymentEnabled: dto.onlinePaymentEnabled,
      }),
    };
  }

  private buildBusinessBrandingData(
    dto: NonNullable<CreateBusinessDto["branding"]>,
  ) {
    return {
      ...(dto.logoUrl !== undefined && {
        logoUrl: dto.logoUrl || null,
      }),

      ...(dto.faviconUrl !== undefined && {
        faviconUrl: dto.faviconUrl || null,
      }),

      ...(dto.primaryColor !== undefined && {
        primaryColor: dto.primaryColor || null,
      }),

      ...(dto.secondaryColor !== undefined && {
        secondaryColor: dto.secondaryColor || null,
      }),

      ...(dto.accentColor !== undefined && {
        accentColor: dto.accentColor || null,
      }),

      ...(dto.fontFamily !== undefined && {
        fontFamily: dto.fontFamily || null,
      }),

      ...(dto.seoTitle !== undefined && {
        seoTitle: dto.seoTitle || null,
      }),

      ...(dto.seoDescription !== undefined && {
        seoDescription: dto.seoDescription || null,
      }),
    };
  }

  private async generateUniqueBusinessSlug(
    name: string,
    ownerUserId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    for (let attempt = 0; attempt < BUSINESS_SLUG_RETRY_LIMIT; attempt++) {
      const slug = generateRandomSlug(name, {
        fallback: "business",
        maxLength: BUSINESS_SLUG_MAX_LENGTH,
      });

      const existingBusiness = await client.business.findFirst({
        where: {
          slug,
          ownerUserId,
        },
        select: {
          id: true,
        },
      });

      if (!existingBusiness) {
        return slug;
      }
    }

    throw new ConflictException("Could not generate a unique business slug");
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private hasKeys(value: object) {
    return Object.keys(value).length > 0;
  }

  private handlePrismaError(error: unknown): never {
    throwConflictOnUnique(error, "Business slug already exists");
  }
}
