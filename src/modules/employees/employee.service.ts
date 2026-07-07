import * as argon2 from "argon2";
import {
  and,
  asc,
  count,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  ne,
  or,
} from "drizzle-orm";

import {
  BusinessMember,
  businessMember,
  BusinessMemberStatus,
  CommonStatus,
  RbacRole,
  rbacRole,
  RbacRolePermission,
  rbacRolePermission,
  RbacUserRoleMap,
  rbacUserRoleMap,
  SystemUser,
  systemUser,
  SystemUserProfile,
  systemUserProfile,
  SystemUserStatus,
  SystemUserType,
  UserRoleMapStatus,
} from "@/database/schema";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { isUniqueConstraintError } from "../../common/database/db-error.util";
import { buildOrderBy, resolveSortColumn } from "../../common/http/sort.util";
import {
  normalizeSearch,
  normalizeSearchUuid,
} from "../../common/http/search.util";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import { DatabaseService } from "../../database/database.service";
import { AssignEmployeeRolesDto } from "./dto/assign-employee-roles.dto";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { EmployeeProfileDto } from "./dto/employee-profile.dto";
import { EmployeeSortBy, QueryEmployeesDto } from "./dto/query-employees.dto";
import { UpdateEmployeeStatusDto } from "./dto/update-employee-status.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

type UserSummary = Pick<SystemUser, "id" | "name" | "email" | "type">;

type EmployeeRoleMap = RbacUserRoleMap & {
  role: Pick<
    RbacRole,
    "id" | "businessId" | "name" | "description" | "status"
  > & {
    permissions: Pick<RbacRolePermission, "id" | "feature" | "action">[];
  };
};

type EmployeeDetails = Pick<
  SystemUser,
  | "id"
  | "name"
  | "email"
  | "phone"
  | "type"
  | "status"
  | "emailVerifiedAt"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
> & {
  profile: SystemUserProfile | null;
  businessMembers: BusinessMember[];
  userRoleMaps: EmployeeRoleMap[];
  createdBy: UserSummary | null;
  updatedBy: UserSummary | null;
};

@Injectable()
export class EmployeeService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

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
      const employee = await this.db.transaction(async (tx) => {
        const [employee] = await tx
          .insert(systemUser)
          .values({
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
          })
          .returning();

        await tx.insert(systemUserProfile).values({
          userId: employee.id,
          ...profileData,
        });

        await tx.insert(businessMember).values({
          businessId,
          userId: employee.id,
          status: BusinessMemberStatus.ACTIVE,
        });

        if (roleIds.length > 0) {
          await tx
            .insert(rbacUserRoleMap)
            .values(
              roleIds.map((roleId) => ({
                userId: employee.id,
                roleId,
                status: UserRoleMapStatus.ACTIVE,
                assignedBy: currentUser.id,
              })),
            )
            .onConflictDoNothing();
        }

        return employee;
      });

      const createdEmployee = await this.getEmployeeByIdOrThrow(
        businessId,
        employee.id,
      );

      return apiResponse(
        createdEmployee,
        "Employee was created successfully. The user account, employee membership, profile, and requested role assignments were saved for this business.",
      );
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findAll(businessId: string, query: QueryEmployeesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);
    const where = and(
      eq(systemUser.type, SystemUserType.EMPLOYEE),
      exists(
        this.db
          .select({ id: businessMember.id })
          .from(businessMember)
          .where(
            and(
              eq(businessMember.userId, systemUser.id),
              eq(businessMember.businessId, businessId),
              eq(businessMember.status, BusinessMemberStatus.ACTIVE),
              isNull(businessMember.deletedAt),
            ),
          ),
      ),
      !query.includeDeleted ? isNull(systemUser.deletedAt) : undefined,
      query.status ? eq(systemUser.status, query.status) : undefined,
      search
        ? or(
            searchUuid ? eq(systemUser.id, searchUuid) : undefined,
            ilike(systemUser.name, `%${search}%`),
            ilike(systemUser.email, `%${search}%`),
            ilike(systemUser.phone, `%${search}%`),
          )
        : undefined,
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(systemUser)
        .where(where)
        .orderBy(
          buildOrderBy(
            resolveSortColumn(
              query.sortBy,
              {
                [EmployeeSortBy.NAME]: systemUser.name,
                [EmployeeSortBy.EMAIL]: systemUser.email,
                [EmployeeSortBy.STATUS]: systemUser.status,
                [EmployeeSortBy.CREATED_AT]: systemUser.createdAt,
                [EmployeeSortBy.UPDATED_AT]: systemUser.updatedAt,
              },
              EmployeeSortBy.CREATED_AT,
            ),
            query.sortOrder,
          ),
        )
        .limit(limit)
        .offset(skip)
        .then((rows) => this.withEmployeesDetails(rows, businessId)),
      this.db
        .select({ value: count() })
        .from(systemUser)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      items,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Employees were loaded successfully. The response includes the requested page of employee accounts for this business and pagination metadata for browsing more results.",
    );
  }

  async findOne(businessId: string, employeeId: string) {
    const employee = await this.getEmployeeByIdOrThrow(businessId, employeeId);

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
      return await this.db.transaction(async (tx) => {
        await tx
          .update(systemUser)
          .set({
            ...(dto.name !== undefined && { name: dto.name.trim() }),
            ...(email !== undefined && { email }),
            ...(phone !== undefined && { phone }),
            ...(passwordHash !== undefined && { passwordHash }),
            updatedById: currentUser.id,
          })
          .where(eq(systemUser.id, employeeId));

        if (profileData) {
          await tx
            .insert(systemUserProfile)
            .values({
              userId: employeeId,
              ...profileData,
            })
            .onConflictDoUpdate({
              target: systemUserProfile.userId,
              set: profileData,
            });
        }

        const employee = await this.getEmployeeByIdOrThrow(
          businessId,
          employeeId,
        );

        return apiResponse(
          employee,
          "Employee was updated successfully. The latest account, profile, membership, and role details are included in the response.",
        );
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async updateStatus(
    currentUser: CurrentUserPayload,
    businessId: string,
    employeeId: string,
    dto: UpdateEmployeeStatusDto,
  ) {
    await this.assertEmployeeBelongsToBusiness(businessId, employeeId);

    await this.db
      .update(systemUser)
      .set({
        status: dto.status,
        updatedById: currentUser.id,
      })
      .where(eq(systemUser.id, employeeId));

    const employee = await this.getEmployeeByIdOrThrow(businessId, employeeId);

    return apiResponse(
      employee,
      "Employee status was updated successfully. The employee account and business membership now reflect the requested status change.",
    );
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

    await this.db.transaction(async (tx) => {
      await tx
        .update(rbacUserRoleMap)
        .set({ status: UserRoleMapStatus.REVOKED })
        .where(
          and(
            eq(rbacUserRoleMap.userId, employeeId),
            eq(rbacUserRoleMap.status, UserRoleMapStatus.ACTIVE),
            exists(
              this.db
                .select({ id: rbacRole.id })
                .from(rbacRole)
                .where(
                  and(
                    eq(rbacRole.id, rbacUserRoleMap.roleId),
                    eq(rbacRole.businessId, businessId),
                  ),
                ),
            ),
          ),
        );

      if (roleIds.length > 0) {
        await tx
          .insert(rbacUserRoleMap)
          .values(
            roleIds.map((roleId) => ({
              userId: employeeId,
              roleId,
              status: UserRoleMapStatus.ACTIVE,
              assignedBy: currentUser.id,
            })),
          )
          .onConflictDoNothing();

        await tx
          .update(rbacUserRoleMap)
          .set({
            status: UserRoleMapStatus.ACTIVE,
            assignedBy: currentUser.id,
            assignedAt: new Date(),
            expiresAt: null,
          })
          .where(
            and(
              eq(rbacUserRoleMap.userId, employeeId),
              inArray(rbacUserRoleMap.roleId, roleIds),
              ne(rbacUserRoleMap.status, UserRoleMapStatus.ACTIVE),
            ),
          );
      }
    });

    const employee = await this.getEmployeeByIdOrThrow(businessId, employeeId);

    return apiResponse(
      employee,
      "Employee roles were updated successfully. Previous active assignments were replaced with the selected roles for this business.",
    );
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

    await this.db.transaction(async (tx) => {
      const now = new Date();

      await tx
        .update(businessMember)
        .set({
          status: BusinessMemberStatus.INACTIVE,
          deletedAt: now,
          deletedById: currentUser.id,
        })
        .where(
          and(
            eq(businessMember.businessId, businessId),
            eq(businessMember.userId, employeeId),
            isNull(businessMember.deletedAt),
          ),
        );

      await tx
        .update(rbacUserRoleMap)
        .set({ status: UserRoleMapStatus.REVOKED })
        .where(
          and(
            eq(rbacUserRoleMap.userId, employeeId),
            eq(rbacUserRoleMap.status, UserRoleMapStatus.ACTIVE),
            exists(
              this.db
                .select({ id: rbacRole.id })
                .from(rbacRole)
                .where(
                  and(
                    eq(rbacRole.id, rbacUserRoleMap.roleId),
                    eq(rbacRole.businessId, businessId),
                  ),
                ),
            ),
          ),
        );

      const [activeMemberships] = await tx
        .select({ value: count() })
        .from(businessMember)
        .where(
          and(
            eq(businessMember.userId, employeeId),
            eq(businessMember.status, BusinessMemberStatus.ACTIVE),
            isNull(businessMember.deletedAt),
          ),
        );

      if ((activeMemberships?.value ?? 0) > 0) {
        return;
      }

      await tx
        .update(systemUserProfile)
        .set({ deletedAt: now, deletedById: currentUser.id })
        .where(
          and(
            eq(systemUserProfile.userId, employeeId),
            isNull(systemUserProfile.deletedAt),
          ),
        );

      await tx
        .update(systemUser)
        .set({
          status: SystemUserStatus.INACTIVE,
          deletedAt: now,
          deletedById: currentUser.id,
          updatedById: currentUser.id,
        })
        .where(eq(systemUser.id, employeeId));
    });

    return apiResponse(
      null,
      "Employee was deleted successfully. The employee membership, active role assignments, profile, and account were soft-deleted or deactivated as appropriate.",
    );
  }

  private async getEmployeeByIdOrThrow(businessId: string, employeeId: string) {
    const [employee] = await this.db
      .select()
      .from(systemUser)
      .where(
        and(
          eq(systemUser.id, employeeId),
          eq(systemUser.type, SystemUserType.EMPLOYEE),
          isNull(systemUser.deletedAt),
          exists(
            this.db
              .select({ id: businessMember.id })
              .from(businessMember)
              .where(
                and(
                  eq(businessMember.userId, systemUser.id),
                  eq(businessMember.businessId, businessId),
                  eq(businessMember.status, BusinessMemberStatus.ACTIVE),
                  isNull(businessMember.deletedAt),
                ),
              ),
          ),
        ),
      )
      .limit(1);

    if (!employee) {
      throw new NotFoundException(
        "Employee could not be found. The account may not exist, may have been deleted, or may not be assigned to the requested business.",
      );
    }

    return this.withEmployeeDetails(employee, businessId);
  }

  private async assertEmployeeBelongsToBusiness(
    businessId: string,
    employeeId: string,
  ) {
    const [employee] = await this.db
      .select({ id: systemUser.id })
      .from(systemUser)
      .where(
        and(
          eq(systemUser.id, employeeId),
          eq(systemUser.type, SystemUserType.EMPLOYEE),
          isNull(systemUser.deletedAt),
          exists(
            this.db
              .select({ id: businessMember.id })
              .from(businessMember)
              .where(
                and(
                  eq(businessMember.userId, systemUser.id),
                  eq(businessMember.businessId, businessId),
                  eq(businessMember.status, BusinessMemberStatus.ACTIVE),
                  isNull(businessMember.deletedAt),
                ),
              ),
          ),
        ),
      )
      .limit(1);

    if (!employee) {
      throw new NotFoundException(
        "Employee could not be found in this business. Confirm the employee ID and make sure the account is assigned to the selected business.",
      );
    }
  }

  private async assertRolesBelongToBusiness(
    businessId: string,
    roleIds: string[],
  ) {
    const roles = await this.db
      .select({ id: rbacRole.id })
      .from(rbacRole)
      .where(
        and(
          inArray(rbacRole.id, roleIds),
          eq(rbacRole.businessId, businessId),
          eq(rbacRole.status, CommonStatus.ACTIVE),
          isNull(rbacRole.deletedAt),
        ),
      );

    if (roles.length !== roleIds.length) {
      throw new BadRequestException(
        "One or more selected roles are invalid for this business",
      );
    }
  }

  private async assertEmailAvailable(email: string, ignoreUserId?: string) {
    const [existingUser] = await this.db
      .select({ id: systemUser.id })
      .from(systemUser)
      .where(
        and(
          eq(systemUser.email, email),
          ignoreUserId ? ne(systemUser.id, ignoreUserId) : undefined,
        ),
      )
      .limit(1);

    if (existingUser) {
      throw new ConflictException(
        "Email already exists. Please use a different email address or update the existing account that owns this email.",
      );
    }
  }

  private async assertPhoneAvailable(phone: string, ignoreUserId?: string) {
    const [existingUser] = await this.db
      .select({ id: systemUser.id })
      .from(systemUser)
      .where(
        and(
          eq(systemUser.phone, phone),
          ignoreUserId ? ne(systemUser.id, ignoreUserId) : undefined,
        ),
      )
      .limit(1);

    if (existingUser) {
      throw new ConflictException(
        "Phone number already exists. Please use a different phone number or update the existing account that owns this phone number.",
      );
    }
  }

  private async withEmployeesDetails(
    employees: SystemUser[],
    businessId: string,
  ) {
    return Promise.all(
      employees.map((employee) =>
        this.withEmployeeDetails(employee, businessId),
      ),
    );
  }

  private async withEmployeeDetails(
    employee: SystemUser,
    businessId: string,
  ): Promise<EmployeeDetails> {
    const [profile, businessMembers, userRoleMaps, createdBy, updatedBy] =
      await Promise.all([
        this.db
          .select()
          .from(systemUserProfile)
          .where(eq(systemUserProfile.userId, employee.id))
          .limit(1)
          .then(([item]) => item ?? null),
        this.db
          .select()
          .from(businessMember)
          .where(
            and(
              eq(businessMember.businessId, businessId),
              eq(businessMember.userId, employee.id),
              eq(businessMember.status, BusinessMemberStatus.ACTIVE),
              isNull(businessMember.deletedAt),
            ),
          ),
        this.getEmployeeRoleMaps(employee.id, businessId),
        employee.createdById
          ? this.findUserSummary(employee.createdById)
          : null,
        employee.updatedById
          ? this.findUserSummary(employee.updatedById)
          : null,
      ]);

    return {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      type: employee.type,
      status: employee.status,
      emailVerifiedAt: employee.emailVerifiedAt,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
      deletedAt: employee.deletedAt,
      profile,
      businessMembers,
      userRoleMaps,
      createdBy,
      updatedBy,
    };
  }

  private async getEmployeeRoleMaps(userId: string, businessId: string) {
    const maps = await this.db
      .select()
      .from(rbacUserRoleMap)
      .where(
        and(
          eq(rbacUserRoleMap.userId, userId),
          exists(
            this.db
              .select({ id: rbacRole.id })
              .from(rbacRole)
              .where(
                and(
                  eq(rbacRole.id, rbacUserRoleMap.roleId),
                  eq(rbacRole.businessId, businessId),
                  isNull(rbacRole.deletedAt),
                ),
              ),
          ),
        ),
      );

    return Promise.all(
      maps.map(async (map) => ({
        ...map,
        role: await this.getRoleSummaryWithPermissions(map.roleId),
      })),
    );
  }

  private async getRoleSummaryWithPermissions(roleId: string) {
    const [role] = await this.db
      .select({
        id: rbacRole.id,
        businessId: rbacRole.businessId,
        name: rbacRole.name,
        description: rbacRole.description,
        status: rbacRole.status,
      })
      .from(rbacRole)
      .where(eq(rbacRole.id, roleId))
      .limit(1);

    if (!role) {
      throw new NotFoundException(
        "Role could not be found. It may not exist, may have been deleted, or may not belong to the requested business.",
      );
    }

    const permissions = await this.db
      .select({
        id: rbacRolePermission.id,
        feature: rbacRolePermission.feature,
        action: rbacRolePermission.action,
      })
      .from(rbacRolePermission)
      .where(eq(rbacRolePermission.roleId, roleId))
      .orderBy(asc(rbacRolePermission.feature), asc(rbacRolePermission.action));

    return {
      ...role,
      permissions,
    };
  }

  private findUserSummary(userId: string) {
    return this.db
      .select({
        id: systemUser.id,
        name: systemUser.name,
        email: systemUser.email,
        type: systemUser.type,
      })
      .from(systemUser)
      .where(eq(systemUser.id, userId))
      .limit(1)
      .then(([user]) => user ?? null);
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
    return [...new Set(roleIds)];
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

  private handleDatabaseError(error: unknown): never {
    if (isUniqueConstraintError(error)) {
      throw new ConflictException("Employee email or phone already exists");
    }

    throw error;
  }
}
