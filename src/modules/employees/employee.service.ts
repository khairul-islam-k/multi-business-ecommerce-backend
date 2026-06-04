import * as argon2 from "argon2";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BusinessMemberStatus,
  CommonStatus,
  Prisma,
  SystemUserStatus,
  SystemUserType,
  UserRoleMapStatus,
} from "@prisma/client";

import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import { PrismaService } from "../../prisma/prisma.service";
import { AssignEmployeeRolesDto } from "./dto/assign-employee-roles.dto";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { EmployeeProfileDto } from "./dto/employee-profile.dto";
import { QueryEmployeesDto } from "./dto/query-employees.dto";
import { UpdateEmployeeStatusDto } from "./dto/update-employee-status.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateEmployeeDto,
  ) {
    const email = this.normalizeEmail(dto.email);
    const phone = this.normalizeNullableText(dto.phone);

    await this.assertEmailAvailable(email);

    if (phone) {
      await this.assertPhoneAvailable(phone);
    }

    const roleIds = this.normalizeRoleIds(dto.roleIds ?? []);

    if (roleIds.length > 0) {
      await this.assertRolesBelongToBusiness(businessId, roleIds);
    }

    const passwordHash = await this.hashPassword(dto.password);
    const profileData = this.buildProfileData(dto.profile, {
      createEmpty: true,
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        const employee = await tx.systemUser.create({
          data: {
            name: dto.name.trim(),
            email,
            phone,
            passwordHash,
            type: SystemUserType.EMPLOYEE,
            status: dto.status ?? SystemUserStatus.ACTIVE,

            tenantId:
              currentUser.type === SystemUserType.TENANT
                ? currentUser.id
                : currentUser.tenantId,

            createdById: currentUser.id,
            updatedById: currentUser.id,

            profile: {
              create: profileData,
            },

            businessMembers: {
              create: {
                businessId,
              },
            },
          },
          select: this.getEmployeeSelect(businessId),
        });

        if (roleIds.length > 0) {
          await tx.rbacUserRoleMap.createMany({
            data: roleIds.map((roleId) => ({
              userId: employee.id,
              roleId,
              status: UserRoleMapStatus.ACTIVE,
              assignedBy: currentUser.id,
            })),
            skipDuplicates: true,
          });
        }

        const createdEmployee = await this.getEmployeeByIdOrThrow(
          tx,
          businessId,
          employee.id,
        );

        return apiResponse(createdEmployee, "Employee created successfully");
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(businessId: string, query: QueryEmployeesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder ?? "desc";

    const where: Prisma.SystemUserWhereInput = {
      type: SystemUserType.EMPLOYEE,

      businessMembers: {
        some: {
          businessId,
          status: BusinessMemberStatus.ACTIVE,
          deletedAt: null,
        },
      },

      ...(!query.includeDeleted && {
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
        ],
      }),
    };

    const orderBy: Prisma.SystemUserOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const items = await this.prisma.systemUser.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: this.getEmployeeSelect(businessId),
    });

    const total = await this.prisma.systemUser.count({
      where,
    });

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, employeeId: string) {
    const employee = await this.getEmployeeByIdOrThrow(
      this.prisma,
      businessId,
      employeeId,
    );

    return apiResponse(employee);
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    employeeId: string,
    dto: UpdateEmployeeDto,
  ) {
    await this.assertEmployeeBelongsToBusiness(businessId, employeeId);

    const email =
      dto.email !== undefined ? this.normalizeEmail(dto.email) : undefined;

    const phone =
      dto.phone !== undefined
        ? this.normalizeNullableText(dto.phone)
        : undefined;

    if (email !== undefined) {
      await this.assertEmailAvailable(email, employeeId);
    }

    if (phone) {
      await this.assertPhoneAvailable(phone, employeeId);
    }

    const passwordHash = dto.password
      ? await this.hashPassword(dto.password)
      : undefined;

    const profileData = this.buildProfileData(dto.profile);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.systemUser.update({
          where: {
            id: employeeId,
          },
          data: {
            ...(dto.name !== undefined && {
              name: dto.name.trim(),
            }),

            ...(email !== undefined && {
              email,
            }),

            ...(phone !== undefined && {
              phone,
            }),

            ...(passwordHash !== undefined && {
              passwordHash,
            }),

            updatedById: currentUser.id,

            ...(profileData && {
              profile: {
                upsert: {
                  create: profileData,
                  update: profileData,
                },
              },
            }),
          },
        });

        const employee = await this.getEmployeeByIdOrThrow(
          tx,
          businessId,
          employeeId,
        );

        return apiResponse(employee, "Employee updated successfully");
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async updateStatus(
    currentUser: CurrentUserPayload,
    businessId: string,
    employeeId: string,
    dto: UpdateEmployeeStatusDto,
  ) {
    await this.assertEmployeeBelongsToBusiness(businessId, employeeId);

    await this.prisma.systemUser.update({
      where: {
        id: employeeId,
      },
      data: {
        status: dto.status,
        updatedById: currentUser.id,
      },
    });

    const employee = await this.getEmployeeByIdOrThrow(
      this.prisma,
      businessId,
      employeeId,
    );

    return apiResponse(employee, "Employee status updated successfully");
  }

  async replaceRoles(
    currentUser: CurrentUserPayload,
    businessId: string,
    employeeId: string,
    dto: AssignEmployeeRolesDto,
  ) {
    await this.assertEmployeeBelongsToBusiness(businessId, employeeId);

    const roleIds = this.normalizeRoleIds(dto.roleIds);

    if (roleIds.length > 0) {
      await this.assertRolesBelongToBusiness(businessId, roleIds);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rbacUserRoleMap.updateMany({
        where: {
          userId: employeeId,
          role: {
            businessId,
          },
          status: UserRoleMapStatus.ACTIVE,
        },
        data: {
          status: UserRoleMapStatus.REVOKED,
        },
      });

      if (roleIds.length > 0) {
        await tx.rbacUserRoleMap.createMany({
          data: roleIds.map((roleId) => ({
            userId: employeeId,
            roleId,
            status: UserRoleMapStatus.ACTIVE,
            assignedBy: currentUser.id,
          })),
          skipDuplicates: true,
        });

        await tx.rbacUserRoleMap.updateMany({
          where: {
            userId: employeeId,
            roleId: {
              in: roleIds,
            },
            status: {
              not: UserRoleMapStatus.ACTIVE,
            },
          },
          data: {
            status: UserRoleMapStatus.ACTIVE,
            assignedBy: currentUser.id,
            assignedAt: new Date(),
            expiresAt: null,
          },
        });
      }
    });

    const employee = await this.getEmployeeByIdOrThrow(
      this.prisma,
      businessId,
      employeeId,
    );

    return apiResponse(employee, "Employee roles updated successfully");
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    employeeId: string,
  ) {
    if (currentUser.id === employeeId) {
      throw new BadRequestException("You cannot delete your own account here");
    }

    await this.assertEmployeeBelongsToBusiness(businessId, employeeId);

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.businessMember.updateMany({
        where: {
          businessId,
          userId: employeeId,
          deletedAt: null,
        },
        data: {
          status: BusinessMemberStatus.INACTIVE,
          deletedAt: now,
        },
      });

      await tx.rbacUserRoleMap.updateMany({
        where: {
          userId: employeeId,
          role: {
            businessId,
          },
          status: UserRoleMapStatus.ACTIVE,
        },
        data: {
          status: UserRoleMapStatus.REVOKED,
        },
      });

      const activeMemberships = await tx.businessMember.count({
        where: {
          userId: employeeId,
          status: BusinessMemberStatus.ACTIVE,
          deletedAt: null,
        },
      });

      if (activeMemberships > 0) {
        return;
      }

      await tx.systemUserProfile.updateMany({
        where: {
          userId: employeeId,
          deletedAt: null,
        },
        data: {
          deletedAt: now,
        },
      });

      await tx.systemUser.update({
        where: {
          id: employeeId,
        },
        data: {
          status: SystemUserStatus.INACTIVE,
          deletedAt: now,
          deletedById: currentUser.id,
          updatedById: currentUser.id,
        },
      });
    });

    return apiResponse(null, "Employee deleted successfully");
  }

  private getEmployeeSelect(businessId: string): Prisma.SystemUserSelect {
    return {
      id: true,
      name: true,
      email: true,
      phone: true,
      type: true,
      status: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,

      profile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          imageUrl: true,
          dateOfBirth: true,
          gender: true,
          address: true,
          city: true,
          country: true,
          bio: true,
        },
      },

      businessMembers: {
        where: {
          businessId,
          status: BusinessMemberStatus.ACTIVE,
          deletedAt: null,
        },
        select: {
          id: true,
          businessId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      },

      userRoleMaps: {
        where: {
          role: {
            businessId,
            deletedAt: null,
          },
        },
        select: {
          id: true,
          status: true,
          assignedAt: true,
          expiresAt: true,
          role: {
            select: {
              id: true,
              businessId: true,
              name: true,
              description: true,
              status: true,
              permissions: {
                orderBy: [{ feature: "asc" }, { action: "asc" }],
                select: {
                  id: true,
                  feature: true,
                  action: true,
                },
              },
            },
          },
        },
      },

      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          type: true,
        },
      },

      updatedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          type: true,
        },
      },
    };
  }

  private async getEmployeeByIdOrThrow(
    prisma: Prisma.TransactionClient | PrismaService,
    businessId: string,
    employeeId: string,
  ) {
    const employee = await prisma.systemUser.findFirst({
      where: {
        id: employeeId,
        type: SystemUserType.EMPLOYEE,
        deletedAt: null,
        businessMembers: {
          some: {
            businessId,
            status: BusinessMemberStatus.ACTIVE,
            deletedAt: null,
          },
        },
      },
      select: this.getEmployeeSelect(businessId),
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    return employee;
  }

  private async assertEmployeeBelongsToBusiness(
    businessId: string,
    employeeId: string,
  ) {
    const employee = await this.prisma.systemUser.findFirst({
      where: {
        id: employeeId,
        type: SystemUserType.EMPLOYEE,
        deletedAt: null,
        businessMembers: {
          some: {
            businessId,
            status: BusinessMemberStatus.ACTIVE,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found in this business");
    }
  }

  private async assertRolesBelongToBusiness(
    businessId: string,
    roleIds: string[],
  ) {
    const roles = await this.prisma.rbacRole.findMany({
      where: {
        id: {
          in: roleIds,
        },
        businessId,
        status: CommonStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (roles.length !== roleIds.length) {
      throw new BadRequestException(
        "One or more selected roles are invalid for this business",
      );
    }
  }

  private async assertEmailAvailable(email: string, ignoreUserId?: string) {
    const existingUser = await this.prisma.systemUser.findFirst({
      where: {
        email,

        ...(ignoreUserId && {
          id: {
            not: ignoreUserId,
          },
        }),
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictException("Email already exists");
    }
  }

  private async assertPhoneAvailable(phone: string, ignoreUserId?: string) {
    const existingUser = await this.prisma.systemUser.findFirst({
      where: {
        phone,

        ...(ignoreUserId && {
          id: {
            not: ignoreUserId,
          },
        }),
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictException("Phone already exists");
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }

  private normalizeNullableDate(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    if (!value) {
      return null;
    }

    return new Date(value);
  }

  private normalizeRoleIds(roleIds: string[]) {
    const uniqueRoleIds = [...new Set(roleIds)];

    return uniqueRoleIds;
  }

  private buildProfileData(
    profile?: EmployeeProfileDto,
    options: { createEmpty?: boolean } = {},
  ) {
    if (!profile) {
      return options.createEmpty ? {} : undefined;
    }

    return {
      firstName: this.normalizeNullableText(profile.firstName),
      lastName: this.normalizeNullableText(profile.lastName),
      imageUrl: this.normalizeNullableText(profile.imageUrl),
      dateOfBirth: this.normalizeNullableDate(profile.dateOfBirth),
      gender: profile.gender ?? undefined,
      address: this.normalizeNullableText(profile.address),
      city: this.normalizeNullableText(profile.city),
      country: this.normalizeNullableText(profile.country),
      bio: this.normalizeNullableText(profile.bio),
    };
  }

  private async hashPassword(password: string) {
    return argon2.hash(password, {
      type: argon2.argon2id,
    });
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new ConflictException("Employee email or phone already exists");
      }

      if (error.code === "P2025") {
        throw new NotFoundException("Employee not found");
      }
    }

    throw error;
  }
}
