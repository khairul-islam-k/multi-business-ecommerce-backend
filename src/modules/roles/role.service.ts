import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BusinessMemberStatus,
  BusinessStatus,
  CommonStatus,
  Prisma,
  SystemUserStatus,
  SystemUserType,
  UserRoleMapStatus,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";

import { AssignRoleDto } from "./dto/assign-role.dto";
import { CreateRoleDto } from "./dto/create-role.dto";
import { QueryRoleAssignmentsDto } from "./dto/query-role-assignment.dto";
import { QueryRoleDto } from "./dto/query-role.dto";
import { RolePermissionDto } from "./dto/role-permission.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { UpdateRoleAssignmentDto } from "./dto/update-role-assignment.dto";

const ACCESSIBLE_BUSINESS_STATUSES = [
  BusinessStatus.TRIAL,
  BusinessStatus.ACTIVE,
] satisfies BusinessStatus[];

const RBAC_ROLE_INCLUDE = {
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      type: true,
      status: true,
    },
  },
  updatedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      type: true,
      status: true,
    },
  },
  permissions: {
    orderBy: [{ feature: "asc" }, { action: "asc" }],
  },
  _count: {
    select: {
      userRoleMaps: true,
    },
  },
} satisfies Prisma.RbacRoleInclude;

const RBAC_ROLE_ASSIGNMENT_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      type: true,
      status: true,
    },
  },
  role: {
    select: {
      id: true,
      businessId: true,
      name: true,
      description: true,
      status: true,
      permissions: {
        orderBy: [{ feature: "asc" }, { action: "asc" }],
      },
    },
  },
  assignedByUser: {
    select: {
      id: true,
      name: true,
      email: true,
      type: true,
      status: true,
    },
  },
} satisfies Prisma.RbacUserRoleMapInclude;

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateRoleDto,
  ) {
    const name = this.normalizeRoleName(dto.name);
    await this.ensureRoleNameAvailable(businessId, name);

    const permissions = this.normalizePermissions(dto.permissions ?? []);

    try {
      const role = await this.prisma.rbacRole.create({
        data: {
          businessId,
          name,
          description: this.normalizeNullableText(dto.description),
          status: dto.status ?? CommonStatus.ACTIVE,

          createdById: currentUser.id,
          updatedById: currentUser.id,

          ...(permissions.length > 0 && {
            permissions: {
              create: permissions.map((permission) => ({
                feature: permission.feature,
                action: permission.action,
              })),
            },
          }),
        },
        include: RBAC_ROLE_INCLUDE,
      });

      return apiResponse(role, "Role created successfully");
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(
    currentUser: CurrentUserPayload,
    businessId: string,
    query: QueryRoleDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder ?? "desc";

    const canIncludeDeleted =
      currentUser.type === SystemUserType.ADMIN && query.includeDeleted;

    const where: Prisma.RbacRoleWhereInput = {
      businessId,

      ...(!canIncludeDeleted && {
        deletedAt: null,
      }),

      ...(query.status && {
        status: query.status,
      }),

      ...(query.search && {
        OR: [
          {
            name: {
              contains: query.search,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: query.search,
              mode: "insensitive",
            },
          },
        ],
      }),
    };

    const orderBy: Prisma.RbacRoleOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const items = await this.prisma.rbacRole.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: RBAC_ROLE_INCLUDE,
    });

    const total = await this.prisma.rbacRole.count({
      where,
    });

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, roleId: string) {
    const role = await this.getRoleOrThrow(businessId, roleId);

    return apiResponse(role);
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    roleId: string,
    dto: UpdateRoleDto,
  ) {
    await this.assertRoleBelongsToBusiness(businessId, roleId);

    let name: string | undefined;

    if (dto.name !== undefined) {
      name = this.normalizeRoleName(dto.name);
      await this.ensureRoleNameAvailable(businessId, name, roleId);
    }

    const shouldReplacePermissions = dto.permissions !== undefined;
    const permissions = shouldReplacePermissions
      ? this.normalizePermissions(dto.permissions ?? [])
      : [];

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.rbacRole.update({
          where: {
            id: roleId,
          },
          data: {
            ...(name !== undefined && {
              name,
            }),

            ...(dto.description !== undefined && {
              description: this.normalizeNullableText(dto.description),
            }),

            ...(dto.status !== undefined && {
              status: dto.status,
            }),

            updatedById: currentUser.id,
          },
        });

        if (shouldReplacePermissions) {
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
        }

        const role = await tx.rbacRole.findFirst({
          where: {
            id: roleId,
            businessId,
            deletedAt: null,
          },
          include: RBAC_ROLE_INCLUDE,
        });

        return apiResponse(role, "Role updated successfully");
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    roleId: string,
  ) {
    await this.assertRoleBelongsToBusiness(businessId, roleId);

    await this.prisma.$transaction(async (tx) => {
      const activeAssignmentCount = await tx.rbacUserRoleMap.count({
        where: {
          roleId,
          status: UserRoleMapStatus.ACTIVE,
        },
      });

      if (activeAssignmentCount > 0) {
        throw new BadRequestException(
          "Role cannot be deleted while assigned to active users",
        );
      }

      await tx.rbacRole.update({
        where: {
          id: roleId,
        },
        data: {
          status: CommonStatus.INACTIVE,
          deletedAt: new Date(),
          updatedById: currentUser.id,
        },
      });
    });

    return apiResponse(null, "Role deleted successfully");
  }

  async assignRole(
    currentUser: CurrentUserPayload,
    businessId: string,
    roleId: string,
    dto: AssignRoleDto,
  ) {
    await this.assertRoleBelongsToBusiness(businessId, roleId);
    await this.assertUserBelongsToBusiness(dto.userId, businessId);
    this.assertValidExpiryDate(dto.expiresAt);

    const existingMap = await this.prisma.rbacUserRoleMap.findUnique({
      where: {
        userId_roleId: {
          userId: dto.userId,
          roleId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingMap) {
      const assignment = await this.prisma.rbacUserRoleMap.update({
        where: {
          id: existingMap.id,
        },
        data: {
          status: UserRoleMapStatus.ACTIVE,
          assignedBy: currentUser.id,
          assignedAt: new Date(),
          expiresAt: dto.expiresAt ?? null,
        },
        include: RBAC_ROLE_ASSIGNMENT_INCLUDE,
      });

      return apiResponse(assignment, "Role assigned successfully");
    }

    const assignment = await this.prisma.rbacUserRoleMap.create({
      data: {
        userId: dto.userId,
        roleId,
        status: UserRoleMapStatus.ACTIVE,
        assignedBy: currentUser.id,
        expiresAt: dto.expiresAt ?? null,
      },
      include: RBAC_ROLE_ASSIGNMENT_INCLUDE,
    });

    return apiResponse(assignment, "Role assigned successfully");
  }

  async findAssignments(businessId: string, query: QueryRoleAssignmentsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.RbacUserRoleMapWhereInput = {
      role: {
        businessId,
        deletedAt: null,
      },

      ...(query.userId !== undefined && {
        userId: query.userId,
      }),

      ...(query.roleId !== undefined && {
        roleId: query.roleId,
      }),

      ...(query.status !== undefined && {
        status: query.status,
      }),
    };

    const items = await this.prisma.rbacUserRoleMap.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        assignedAt: "desc",
      },
      include: RBAC_ROLE_ASSIGNMENT_INCLUDE,
    });

    const total = await this.prisma.rbacUserRoleMap.count({
      where,
    });

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async updateAssignment(
    businessId: string,
    assignmentId: string,
    dto: UpdateRoleAssignmentDto,
  ) {
    await this.assertAssignmentBelongsToBusiness(businessId, assignmentId);
    this.assertValidExpiryDate(dto.expiresAt ?? undefined);

    const assignment = await this.prisma.rbacUserRoleMap.update({
      where: {
        id: assignmentId,
      },
      data: {
        ...(dto.status !== undefined && {
          status: dto.status,
        }),

        ...(dto.expiresAt !== undefined && {
          expiresAt: dto.expiresAt,
        }),
      },
      include: RBAC_ROLE_ASSIGNMENT_INCLUDE,
    });

    return apiResponse(assignment, "Role assignment updated successfully");
  }

  async revokeAssignment(businessId: string, assignmentId: string) {
    await this.assertAssignmentBelongsToBusiness(businessId, assignmentId);

    const assignment = await this.prisma.rbacUserRoleMap.update({
      where: {
        id: assignmentId,
      },
      data: {
        status: UserRoleMapStatus.REVOKED,
      },
      include: RBAC_ROLE_ASSIGNMENT_INCLUDE,
    });

    return apiResponse(assignment, "Role assignment revoked successfully");
  }

  private async getRoleOrThrow(businessId: string, roleId: string) {
    const role = await this.prisma.rbacRole.findFirst({
      where: {
        id: roleId,
        businessId,
        deletedAt: null,
      },
      include: RBAC_ROLE_INCLUDE,
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

  private async assertAssignmentBelongsToBusiness(
    businessId: string,
    assignmentId: string,
  ) {
    const assignment = await this.prisma.rbacUserRoleMap.findFirst({
      where: {
        id: assignmentId,
        role: {
          businessId,
          deletedAt: null,
        },
      },
      select: {
        id: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException("Role assignment not found");
    }
  }

  private async assertUserBelongsToBusiness(
    userId: string,
    businessId: string,
  ) {
    const user = await this.prisma.systemUser.findFirst({
      where: {
        id: userId,
        status: SystemUserStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const business = await this.prisma.business.findFirst({
      where: {
        id: businessId,
        deletedAt: null,
        status: {
          in: ACCESSIBLE_BUSINESS_STATUSES,
        },

        OR: [
          {
            ownerUserId: userId,
          },
          {
            members: {
              some: {
                userId,
                status: BusinessMemberStatus.ACTIVE,
                deletedAt: null,
              },
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (!business) {
      throw new ForbiddenException("User does not belong to this business");
    }
  }

  private async ensureRoleNameAvailable(
    businessId: string,
    name: string,
    ignoreRoleId?: string,
  ) {
    const existingRole = await this.prisma.rbacRole.findFirst({
      where: {
        businessId,
        name,
        deletedAt: null,

        ...(ignoreRoleId && {
          id: {
            not: ignoreRoleId,
          },
        }),
      },
      select: {
        id: true,
      },
    });

    if (existingRole) {
      throw new ConflictException("Role name already exists");
    }
  }

  private normalizeRoleName(name: string) {
    const normalizedName = name.trim();

    if (!normalizedName) {
      throw new BadRequestException("Role name is required");
    }

    if (normalizedName.length > 100) {
      throw new BadRequestException(
        "Role name must be less than 100 characters",
      );
    }

    return normalizedName;
  }

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }

  private normalizePermissions(permissions: RolePermissionDto[]) {
    const uniquePermissions = new Map<string, RolePermissionDto>();

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

  private assertValidExpiryDate(expiresAt?: Date | null) {
    if (!expiresAt) {
      return;
    }

    if (expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("Expiry date must be in the future");
    }
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("Role name already exists");
    }

    throw error;
  }
}
