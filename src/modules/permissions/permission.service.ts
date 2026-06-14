import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CommonStatus,
  PermissionAction,
  Prisma,
  RbacFeature,
  SystemUserType,
  UserRoleMapStatus,
} from "@prisma/client";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { AddPermissionDto } from "./dto/add-permission";
import { PermissionItemDto } from "./dto/permission-item.dto";
import { QueryPermissionDto } from "./dto/query-permission.dto";
import { UpdatePermissionDto } from "./dto/update-permission.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessAccessService } from "../access/services/business-access.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";

const ROLE_PERMISSION_INCLUDE = {
  role: {
    select: {
      id: true,
      businessId: true,
      name: true,
      status: true,
    },
  },
} satisfies Prisma.RbacRolePermissionInclude;

const ROLE_WITH_PERMISSIONS_INCLUDE = {
  permissions: {
    orderBy: [{ feature: "asc" }, { action: "asc" }],
  },
  _count: {
    select: {
      userRoleMaps: true,
    },
  },
} satisfies Prisma.RbacRoleInclude;

type PermissionCheckOptions = {
  isOwner?: boolean;
  skipBusinessAccessCheck?: boolean;
};

@Injectable()
export class PermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessAccess: BusinessAccessService,
  ) {}

  getAvailablePermissions() {
    return apiResponse({
      actions: Object.values(PermissionAction),
      features: Object.values(RbacFeature).map((feature) => ({
        feature,
        actions: Object.values(PermissionAction),
      })),
    });
  }

  async findAll(businessId: string, query: QueryPermissionDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.RbacRolePermissionWhereInput = {
      role: {
        businessId,
        deletedAt: null,
      },

      ...(query.roleId !== undefined && {
        roleId: query.roleId,
      }),

      ...(query.feature !== undefined && {
        feature: query.feature,
      }),

      ...(query.action !== undefined && {
        action: query.action,
      }),
    };

    const items = await this.prisma.rbacRolePermission.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ roleId: "asc" }, { feature: "asc" }, { action: "asc" }],
      include: ROLE_PERMISSION_INCLUDE,
    });

    const total = await this.prisma.rbacRolePermission.count({
      where,
    });

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findByRole(businessId: string, roleId: string) {
    const role = await this.getRoleWithPermissionsOrThrow(businessId, roleId);

    return apiResponse(role);
  }

  async addToRole(businessId: string, roleId: string, dto: AddPermissionDto) {
    await this.assertRoleBelongsToBusiness(businessId, roleId);

    const permissions = this.normalizePermissions(dto.permissions);

    return this.prisma.$transaction(async (tx) => {
      await tx.rbacRolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId,
          feature: permission.feature,
          action: permission.action,
        })),
        skipDuplicates: true,
      });

      const role = await tx.rbacRole.findFirst({
        where: {
          id: roleId,
          businessId,
          deletedAt: null,
        },
        include: ROLE_WITH_PERMISSIONS_INCLUDE,
      });

      return apiResponse(role, "Permissions added successfully");
    });
  }

  async replaceRolePermissions(
    businessId: string,
    roleId: string,
    dto: UpdatePermissionDto,
  ) {
    await this.assertRoleBelongsToBusiness(businessId, roleId);

    const permissions = this.normalizePermissions(dto.permissions);

    return this.prisma.$transaction(async (tx) => {
      await tx.rbacRolePermission.deleteMany({
        where: {
          roleId,
        },
      });

      if (permissions.length > 0) {
        await tx.rbacRolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId,
            feature: permission.feature,
            action: permission.action,
          })),
        });
      }

      const role = await tx.rbacRole.findFirst({
        where: {
          id: roleId,
          businessId,
          deletedAt: null,
        },
        include: ROLE_WITH_PERMISSIONS_INCLUDE,
      });

      return apiResponse(role, "Permissions replaced successfully");
    });
  }

  async removeFromRole(
    businessId: string,
    roleId: string,
    feature: RbacFeature,
    action: PermissionAction,
  ) {
    await this.assertRoleBelongsToBusiness(businessId, roleId);

    const result = await this.prisma.rbacRolePermission.deleteMany({
      where: {
        roleId,
        feature,
        action,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException("Permission not found for this role");
    }

    const role = await this.getRoleWithPermissionsOrThrow(businessId, roleId);

    return apiResponse(role, "Permission removed successfully");
  }

  async hasPermission(
    currentUser: CurrentUserPayload,
    businessId: string,
    feature: RbacFeature,
    action: PermissionAction,
    options: PermissionCheckOptions = {},
  ) {
    if (currentUser.type === SystemUserType.ADMIN) {
      return true;
    }

    let isOwner = options.isOwner ?? false;

    if (!options.skipBusinessAccessCheck) {
      const businessContext = await this.businessAccess.assertCanAccessBusiness(
        currentUser,
        businessId,
      );

      isOwner = businessContext.isOwner;
    }

    if (isOwner) {
      return true;
    }

    const now = new Date();

    const roleMap = await this.prisma.rbacUserRoleMap.findFirst({
      where: {
        userId: currentUser.id,
        status: UserRoleMapStatus.ACTIVE,

        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: now,
            },
          },
        ],

        role: {
          businessId,
          status: CommonStatus.ACTIVE,
          deletedAt: null,
          permissions: {
            some: {
              feature,
              action,
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    return Boolean(roleMap);
  }

  async assertPermission(
    currentUser: CurrentUserPayload,
    businessId: string,
    feature: RbacFeature,
    action: PermissionAction,
    options: PermissionCheckOptions = {},
  ) {
    const hasPermission = await this.hasPermission(
      currentUser,
      businessId,
      feature,
      action,
      options,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `You do not have permission to ${action.toLowerCase()} ${feature.toLowerCase()}`,
      );
    }
  }

  private async getRoleWithPermissionsOrThrow(
    businessId: string,
    roleId: string,
  ) {
    const role = await this.prisma.rbacRole.findFirst({
      where: {
        id: roleId,
        businessId,
        deletedAt: null,
      },
      include: ROLE_WITH_PERMISSIONS_INCLUDE,
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    return role;
  }

  private async assertRoleBelongsToBusiness(
    businessId: string,
    roleId: string,
  ) {
    const role = await this.prisma.rbacRole.findFirst({
      where: {
        id: roleId,
        businessId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }
  }

  private normalizePermissions(permissions: PermissionItemDto[]) {
    const uniquePermissions = new Map<string, PermissionItemDto>();

    for (const permission of permissions) {
      const key = `${permission.feature}:${permission.action}`;

      if (uniquePermissions.has(key)) {
        throw new BadRequestException(
          `Duplicate permission: ${permission.feature}:${permission.action}`,
        );
      }

      uniquePermissions.set(key, permission);
    }

    return Array.from(uniquePermissions.values());
  }
}
