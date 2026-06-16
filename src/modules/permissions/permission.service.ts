import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type RbacRole,
  type RbacRolePermission,
  CommonStatus,
  PermissionAction,
  RbacFeature,
  SystemUserType,
  UserRoleMapStatus,
  rbacRole,
  rbacRolePermission,
  rbacUserRoleMap,
} from "@/database/schema";
import {
  and,
  asc,
  count,
  eq,
  exists,
  gt,
  isNull,
  or,
} from "drizzle-orm";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { AddPermissionDto } from "./dto/add-permission";
import { PermissionItemDto } from "./dto/permission-item.dto";
import { QueryPermissionDto } from "./dto/query-permission.dto";
import { UpdatePermissionDto } from "./dto/update-permission.dto";
import { DatabaseService } from "../../database/database.service";
import { BusinessAccessService } from "../access/services/business-access.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";

type RolePermissionWithRole = RbacRolePermission & {
  role: Pick<RbacRole, "id" | "businessId" | "name" | "status">;
};

type RoleWithPermissions = RbacRole & {
  permissions: RbacRolePermission[];
  _count: {
    userRoleMaps: number;
  };
};

type PermissionCheckOptions = {
  isOwner?: boolean;
  skipBusinessAccessCheck?: boolean;
};

@Injectable()
export class PermissionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly businessAccess: BusinessAccessService,
  ) {}

  private get db() {
    return this.database.db;
  }

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
    const where = and(
      exists(
        this.db
          .select({ id: rbacRole.id })
          .from(rbacRole)
          .where(
            and(
              eq(rbacRole.id, rbacRolePermission.roleId),
              eq(rbacRole.businessId, businessId),
              isNull(rbacRole.deletedAt),
            ),
          ),
      ),
      query.roleId !== undefined
        ? eq(rbacRolePermission.roleId, query.roleId)
        : undefined,
      query.feature !== undefined
        ? eq(rbacRolePermission.feature, query.feature)
        : undefined,
      query.action !== undefined
        ? eq(rbacRolePermission.action, query.action)
        : undefined,
    );

    const [permissions, total] = await Promise.all([
      this.db
        .select()
        .from(rbacRolePermission)
        .where(where)
        .orderBy(
          asc(rbacRolePermission.roleId),
          asc(rbacRolePermission.feature),
          asc(rbacRolePermission.action),
        )
        .limit(limit)
        .offset(skip)
        .then((rows) => this.withPermissionRoles(rows)),
      this.db
        .select({ value: count() })
        .from(rbacRolePermission)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(permissions, {
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

    return this.db.transaction(async (tx) => {
      if (permissions.length > 0) {
        await tx
          .insert(rbacRolePermission)
          .values(
            permissions.map((permission) => ({
              roleId,
              feature: permission.feature,
              action: permission.action,
            })),
          )
          .onConflictDoNothing();
      }

      const role = await this.getRoleWithPermissionsOrThrow(businessId, roleId);

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

    return this.db.transaction(async (tx) => {
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

      const role = await this.getRoleWithPermissionsOrThrow(businessId, roleId);

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

    const result = await this.db
      .delete(rbacRolePermission)
      .where(
        and(
          eq(rbacRolePermission.roleId, roleId),
          eq(rbacRolePermission.feature, feature),
          eq(rbacRolePermission.action, action),
        ),
      )
      .returning({ id: rbacRolePermission.id });

    if (result.length === 0) {
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
    const [roleMap] = await this.db
      .select({ id: rbacUserRoleMap.id })
      .from(rbacUserRoleMap)
      .where(
        and(
          eq(rbacUserRoleMap.userId, currentUser.id),
          eq(rbacUserRoleMap.status, UserRoleMapStatus.ACTIVE),
          or(isNull(rbacUserRoleMap.expiresAt), gt(rbacUserRoleMap.expiresAt, now)),
          exists(
            this.db
              .select({ id: rbacRole.id })
              .from(rbacRole)
              .where(
                and(
                  eq(rbacRole.id, rbacUserRoleMap.roleId),
                  eq(rbacRole.businessId, businessId),
                  eq(rbacRole.status, CommonStatus.ACTIVE),
                  isNull(rbacRole.deletedAt),
                  exists(
                    this.db
                      .select({ id: rbacRolePermission.id })
                      .from(rbacRolePermission)
                      .where(
                        and(
                          eq(rbacRolePermission.roleId, rbacRole.id),
                          eq(rbacRolePermission.feature, feature),
                          eq(rbacRolePermission.action, action),
                        ),
                      ),
                  ),
                ),
              ),
          ),
        ),
      )
      .limit(1);

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

    return this.withRolePermissions(role);
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

  private async withPermissionRoles(
    permissions: RbacRolePermission[],
  ): Promise<RolePermissionWithRole[]> {
    return Promise.all(
      permissions.map(async (permission) => {
        const [role] = await this.db
          .select({
            id: rbacRole.id,
            businessId: rbacRole.businessId,
            name: rbacRole.name,
            status: rbacRole.status,
          })
          .from(rbacRole)
          .where(eq(rbacRole.id, permission.roleId))
          .limit(1);

        return {
          ...permission,
          role,
        };
      }),
    );
  }

  private async withRolePermissions(role: RbacRole): Promise<RoleWithPermissions> {
    const [permissions, userRoleMapsCount] = await Promise.all([
      this.db
        .select()
        .from(rbacRolePermission)
        .where(eq(rbacRolePermission.roleId, role.id))
        .orderBy(asc(rbacRolePermission.feature), asc(rbacRolePermission.action)),
      this.db
        .select({ value: count() })
        .from(rbacUserRoleMap)
        .where(eq(rbacUserRoleMap.roleId, role.id))
        .then(([row]) => row?.value ?? 0),
    ]);

    return {
      ...role,
      permissions,
      _count: {
        userRoleMaps: userRoleMapsCount,
      },
    };
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
