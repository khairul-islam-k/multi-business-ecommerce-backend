import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type PermissionAction,
  type RbacFeature,
  type RbacRole,
  type RbacRolePermission,
  type RbacUserRoleMap,
  type SystemUser,
  BusinessMemberStatus,
  BusinessStatus,
  CommonStatus,
  SystemUserStatus,
  SystemUserType,
  UserRoleMapStatus,
  business,
  businessMember,
  rbacRole,
  rbacRolePermission,
  rbacUserRoleMap,
  systemUser,
} from "@/database/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  ne,
  or,
} from "drizzle-orm";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { AssignRoleDto } from "./dto/assign-role.dto";
import { CreateRoleDto } from "./dto/create-role.dto";
import { QueryRoleAssignmentsDto } from "./dto/query-role-assignment.dto";
import { QueryRoleDto } from "./dto/query-role.dto";
import { RolePermissionDto } from "./dto/role-permission.dto";
import { UpdateRoleAssignmentDto } from "./dto/update-role-assignment.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { DatabaseService } from "../../database/database.service";
import { isUniqueConstraintError } from "../../common/database/db-error.util";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";

const ACCESSIBLE_BUSINESS_STATUSES = [
  BusinessStatus.ACTIVE,
] satisfies BusinessStatus[];

type UserSummary = Pick<
  SystemUser,
  "id" | "name" | "email" | "type" | "status"
>;

type RoleWithDetails = RbacRole & {
  createdBy: UserSummary | null;
  updatedBy: UserSummary | null;
  permissions: RbacRolePermission[];
  _count: {
    userRoleMaps: number;
  };
};

type AssignmentWithDetails = RbacUserRoleMap & {
  user: UserSummary | null;
  role: Pick<
    RbacRole,
    "id" | "businessId" | "name" | "description" | "status"
  > & {
    permissions: RbacRolePermission[];
  };
  assignedByUser: UserSummary | null;
};

@Injectable()
export class RoleService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateRoleDto,
  ) {
    const name = this.normalizeRoleName(dto.name);
    await this.ensureRoleNameAvailable(businessId, name);

    const permissions = this.normalizePermissions(dto.permissions ?? []);

    try {
      const role = await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(rbacRole)
          .values({
            businessId,
            name,
            description: this.normalizeNullableText(dto.description),
            status: dto.status ?? CommonStatus.ACTIVE,
            createdById: currentUser.id,
            updatedById: currentUser.id,
          })
          .returning();

        if (permissions.length > 0) {
          await tx.insert(rbacRolePermission).values(
            permissions.map((permission) => ({
              roleId: created.id,
              feature: permission.feature,
              action: permission.action,
            })),
          );
        }

        return this.withRoleDetails(created);
      });

      return apiResponse(role, "Role created successfully");
    } catch (error) {
      this.handleDatabaseError(error);
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
    const where = and(
      eq(rbacRole.businessId, businessId),
      !canIncludeDeleted ? isNull(rbacRole.deletedAt) : undefined,
      query.status ? eq(rbacRole.status, query.status) : undefined,
      query.search
        ? or(
            ilike(rbacRole.name, `%${query.search}%`),
            ilike(rbacRole.description, `%${query.search}%`),
          )
        : undefined,
    );

    const [roles, total] = await Promise.all([
      this.db
        .select()
        .from(rbacRole)
        .where(where)
        .orderBy(this.roleOrderBy(sortBy, sortOrder))
        .limit(limit)
        .offset(skip)
        .then((rows) => this.withRolesDetails(rows)),
      this.db
        .select({ value: count() })
        .from(rbacRole)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(roles, {
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
      return await this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(rbacRole)
          .set({
            ...(name !== undefined && { name }),
            ...(dto.description !== undefined && {
              description: this.normalizeNullableText(dto.description),
            }),
            ...(dto.status !== undefined && { status: dto.status }),
            updatedById: currentUser.id,
          })
          .where(eq(rbacRole.id, roleId))
          .returning();

        if (shouldReplacePermissions) {
          await tx
            .delete(rbacRolePermission)
            .where(eq(rbacRolePermission.roleId, roleId));

          if (permissions.length > 0) {
            await tx.insert(rbacRolePermission).values(
              permissions.map((permission) => ({
                roleId,
                feature: permission.feature,
                action: permission.action,
              })),
            );
          }
        }

        return apiResponse(
          await this.withRoleDetails(updated),
          "Role updated successfully",
        );
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    roleId: string,
  ) {
    await this.assertRoleBelongsToBusiness(businessId, roleId);

    await this.db.transaction(async (tx) => {
      const [activeAssignmentCount] = await tx
        .select({ value: count() })
        .from(rbacUserRoleMap)
        .where(
          and(
            eq(rbacUserRoleMap.roleId, roleId),
            eq(rbacUserRoleMap.status, UserRoleMapStatus.ACTIVE),
          ),
        );

      if ((activeAssignmentCount?.value ?? 0) > 0) {
        throw new BadRequestException(
          "Role cannot be deleted while assigned to active users",
        );
      }

      await tx
        .update(rbacRole)
        .set({
          status: CommonStatus.INACTIVE,
          deletedAt: new Date(),
          updatedById: currentUser.id,
        })
        .where(eq(rbacRole.id, roleId));
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

    const [existingMap] = await this.db
      .select({ id: rbacUserRoleMap.id })
      .from(rbacUserRoleMap)
      .where(
        and(
          eq(rbacUserRoleMap.userId, dto.userId),
          eq(rbacUserRoleMap.roleId, roleId),
        ),
      )
      .limit(1);

    if (existingMap) {
      const [assignment] = await this.db
        .update(rbacUserRoleMap)
        .set({
          status: UserRoleMapStatus.ACTIVE,
          assignedBy: currentUser.id,
          assignedAt: new Date(),
          expiresAt: dto.expiresAt ?? null,
        })
        .where(eq(rbacUserRoleMap.id, existingMap.id))
        .returning();

      return apiResponse(
        await this.withAssignmentDetails(assignment),
        "Role assigned successfully",
      );
    }

    const [assignment] = await this.db
      .insert(rbacUserRoleMap)
      .values({
        userId: dto.userId,
        roleId,
        status: UserRoleMapStatus.ACTIVE,
        assignedBy: currentUser.id,
        expiresAt: dto.expiresAt ?? null,
      })
      .returning();

    return apiResponse(
      await this.withAssignmentDetails(assignment),
      "Role assigned successfully",
    );
  }

  async findAssignments(businessId: string, query: QueryRoleAssignmentsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
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
      query.userId !== undefined
        ? eq(rbacUserRoleMap.userId, query.userId)
        : undefined,
      query.roleId !== undefined
        ? eq(rbacUserRoleMap.roleId, query.roleId)
        : undefined,
      query.status !== undefined
        ? eq(rbacUserRoleMap.status, query.status)
        : undefined,
    );

    const [assignments, total] = await Promise.all([
      this.db
        .select()
        .from(rbacUserRoleMap)
        .where(where)
        .orderBy(desc(rbacUserRoleMap.assignedAt))
        .limit(limit)
        .offset(skip)
        .then((rows) => this.withAssignmentsDetails(rows)),
      this.db
        .select({ value: count() })
        .from(rbacUserRoleMap)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(assignments, {
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

    const [assignment] = await this.db
      .update(rbacUserRoleMap)
      .set({
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt }),
      })
      .where(eq(rbacUserRoleMap.id, assignmentId))
      .returning();

    return apiResponse(
      await this.withAssignmentDetails(assignment),
      "Role assignment updated successfully",
    );
  }

  async revokeAssignment(businessId: string, assignmentId: string) {
    await this.assertAssignmentBelongsToBusiness(businessId, assignmentId);

    const [assignment] = await this.db
      .update(rbacUserRoleMap)
      .set({ status: UserRoleMapStatus.REVOKED })
      .where(eq(rbacUserRoleMap.id, assignmentId))
      .returning();

    return apiResponse(
      await this.withAssignmentDetails(assignment),
      "Role assignment revoked successfully",
    );
  }

  private async getRoleOrThrow(businessId: string, roleId: string) {
    const [role] = await this.db
      .select()
      .from(rbacRole)
      .where(
        and(
          eq(rbacRole.id, roleId),
          eq(rbacRole.businessId, businessId),
          isNull(rbacRole.deletedAt),
        ),
      )
      .limit(1);

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    return this.withRoleDetails(role);
  }

  private async assertRoleBelongsToBusiness(
    businessId: string,
    roleId: string,
  ) {
    const [role] = await this.db
      .select({ id: rbacRole.id })
      .from(rbacRole)
      .where(
        and(
          eq(rbacRole.id, roleId),
          eq(rbacRole.businessId, businessId),
          isNull(rbacRole.deletedAt),
        ),
      )
      .limit(1);

    if (!role) {
      throw new NotFoundException("Role not found");
    }
  }

  private async assertAssignmentBelongsToBusiness(
    businessId: string,
    assignmentId: string,
  ) {
    const [assignment] = await this.db
      .select({ id: rbacUserRoleMap.id })
      .from(rbacUserRoleMap)
      .where(
        and(
          eq(rbacUserRoleMap.id, assignmentId),
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
      )
      .limit(1);

    if (!assignment) {
      throw new NotFoundException("Role assignment not found");
    }
  }

  private async assertUserBelongsToBusiness(
    userId: string,
    businessId: string,
  ) {
    const [user] = await this.db
      .select({ id: systemUser.id })
      .from(systemUser)
      .where(
        and(
          eq(systemUser.id, userId),
          eq(systemUser.status, SystemUserStatus.ACTIVE),
          isNull(systemUser.deletedAt),
        ),
      )
      .limit(1);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const [businessAccess] = await this.db
      .select({ id: business.id })
      .from(business)
      .where(
        and(
          eq(business.id, businessId),
          isNull(business.deletedAt),
          inArray(business.status, ACCESSIBLE_BUSINESS_STATUSES),
          or(
            eq(business.ownerUserId, userId),
            exists(
              this.db
                .select({ id: businessMember.id })
                .from(businessMember)
                .where(
                  and(
                    eq(businessMember.businessId, business.id),
                    eq(businessMember.userId, userId),
                    eq(businessMember.status, BusinessMemberStatus.ACTIVE),
                    isNull(businessMember.deletedAt),
                  ),
                ),
            ),
          ),
        ),
      )
      .limit(1);

    if (!businessAccess) {
      throw new ForbiddenException("User does not belong to this business");
    }
  }

  private async ensureRoleNameAvailable(
    businessId: string,
    name: string,
    ignoreRoleId?: string,
  ) {
    const [existingRole] = await this.db
      .select({ id: rbacRole.id })
      .from(rbacRole)
      .where(
        and(
          eq(rbacRole.businessId, businessId),
          eq(rbacRole.name, name),
          isNull(rbacRole.deletedAt),
          ignoreRoleId ? ne(rbacRole.id, ignoreRoleId) : undefined,
        ),
      )
      .limit(1);

    if (existingRole) {
      throw new ConflictException("Role name already exists");
    }
  }

  private async withRolesDetails(roles: RbacRole[]) {
    return Promise.all(roles.map((role) => this.withRoleDetails(role)));
  }

  private async withRoleDetails(role: RbacRole): Promise<RoleWithDetails> {
    const [createdBy, updatedBy, permissions, userRoleMapsCount] =
      await Promise.all([
        role.createdById ? this.findUserSummary(role.createdById) : null,
        role.updatedById ? this.findUserSummary(role.updatedById) : null,
        this.db
          .select()
          .from(rbacRolePermission)
          .where(eq(rbacRolePermission.roleId, role.id))
          .orderBy(
            asc(rbacRolePermission.feature),
            asc(rbacRolePermission.action),
          ),
        this.db
          .select({ value: count() })
          .from(rbacUserRoleMap)
          .where(eq(rbacUserRoleMap.roleId, role.id))
          .then(([row]) => row?.value ?? 0),
      ]);

    return {
      ...role,
      createdBy,
      updatedBy,
      permissions,
      _count: {
        userRoleMaps: userRoleMapsCount,
      },
    };
  }

  private async withAssignmentsDetails(assignments: RbacUserRoleMap[]) {
    return Promise.all(
      assignments.map((assignment) => this.withAssignmentDetails(assignment)),
    );
  }

  private async withAssignmentDetails(
    assignment: RbacUserRoleMap,
  ): Promise<AssignmentWithDetails> {
    const [user, role, assignedByUser] = await Promise.all([
      this.findUserSummary(assignment.userId),
      this.findAssignmentRole(assignment.roleId),
      assignment.assignedBy
        ? this.findUserSummary(assignment.assignedBy)
        : null,
    ]);

    return {
      ...assignment,
      user,
      role,
      assignedByUser,
    };
  }

  private async findAssignmentRole(roleId: string) {
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
      throw new NotFoundException("Role not found");
    }

    const permissions = await this.db
      .select()
      .from(rbacRolePermission)
      .where(eq(rbacRolePermission.roleId, role.id))
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
        status: systemUser.status,
      })
      .from(systemUser)
      .where(eq(systemUser.id, userId))
      .limit(1)
      .then(([user]) => user ?? null);
  }

  private roleOrderBy(
    sortBy: NonNullable<QueryRoleDto["sortBy"]>,
    sortOrder: NonNullable<QueryRoleDto["sortOrder"]>,
  ) {
    const column =
      sortBy === "name"
        ? rbacRole.name
        : sortBy === "status"
          ? rbacRole.status
          : sortBy === "updatedAt"
            ? rbacRole.updatedAt
            : rbacRole.createdAt;

    return sortOrder === "asc" ? asc(column) : desc(column);
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

  private handleDatabaseError(error: unknown): never {
    if (isUniqueConstraintError(error)) {
      throw new ConflictException("Role name already exists");
    }

    throw error;
  }
}
