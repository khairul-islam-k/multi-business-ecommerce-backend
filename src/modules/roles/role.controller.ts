import { PermissionAction, RbacFeature } from "@/database/schema";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../business/guards/business.guard";
import { SubscriptionGuard } from "../packages/guards/subscription.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import { AssignRoleDto } from "./dto/assign-role.dto";
import { CreateRoleDto } from "./dto/create-role.dto";
import { QueryRoleAssignmentsDto } from "./dto/query-role-assignment.dto";
import { QueryRoleDto } from "./dto/query-role.dto";
import { UpdateRoleAssignmentDto } from "./dto/update-role-assignment.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RoleService } from "./role.service";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

@ApiTags("Roles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("roles")
export class RoleController {
  constructor(private readonly rolesService: RoleService) {}

  @RequirePermission(
    RbacFeature.ROLE_PERMISSION_MANAGEMENT,
    PermissionAction.CREATE,
  )
  @Post("businesses/:businessId")
  @ApiOperation({
    summary: "Create a role for a business",
    description:
      "Creates a new role inside the selected business. Use this when people need a reusable set of responsibilities and access permissions.",
  })
  create(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rolesService.create(currentUser, businessId, dto);
  }

  @RequirePermission(
    RbacFeature.ROLE_PERMISSION_MANAGEMENT,
    PermissionAction.READ,
  )
  @Get("businesses/:businessId")
  @ApiOperation({
    summary: "Get business roles",
    description:
      "Shows the roles created for the selected business. Use this to review available access levels before assigning people to a role.",
  })
  findAll(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryRoleDto,
  ) {
    return this.rolesService.findAll(currentUser, businessId, query);
  }

  @RequirePermission(
    RbacFeature.ROLE_PERMISSION_MANAGEMENT,
    PermissionAction.READ,
  )
  @Get("businesses/:businessId/assignments")
  @ApiOperation({
    summary: "Get role assignments of a business",
    description:
      "Shows which users have been assigned to roles in the selected business. Use this to audit access and understand who has each responsibility.",
  })
  findAssignments(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryRoleAssignmentsDto,
  ) {
    return this.rolesService.findAssignments(businessId, query);
  }

  @RequirePermission(
    RbacFeature.ROLE_PERMISSION_MANAGEMENT,
    PermissionAction.READ,
  )
  @Get("businesses/:businessId/:roleId")
  @ApiOperation({
    summary: "Get single business role",
    description:
      "Shows the saved details for one role in the selected business. Use this before editing the role or reviewing its purpose.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("roleId", ParseUUIDPipe) roleId: string,
  ) {
    return this.rolesService.findOne(businessId, roleId);
  }

  @RequirePermission(
    RbacFeature.ROLE_PERMISSION_MANAGEMENT,
    PermissionAction.UPDATE,
  )
  @Patch("businesses/:businessId/:roleId")
  @ApiOperation({
    summary: "Update a business role",
    description:
      "Updates the selected role's saved details. Use this when a role name, description, or related setup needs to change.",
  })
  update(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("roleId", ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(currentUser, businessId, roleId, dto);
  }

  @RequirePermission(
    RbacFeature.ROLE_PERMISSION_MANAGEMENT,
    PermissionAction.DELETE,
  )
  @Delete("businesses/:businessId/:roleId")
  @ApiOperation({
    summary: "Delete a business role",
    description:
      "Deletes the selected role from the business. Use this when the role is no longer needed and should not be assigned going forward.",
  })
  remove(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("roleId", ParseUUIDPipe) roleId: string,
  ) {
    return this.rolesService.remove(currentUser, businessId, roleId);
  }

  @RequirePermission(
    RbacFeature.ROLE_PERMISSION_MANAGEMENT,
    PermissionAction.UPDATE,
  )
  @Post("businesses/:businessId/:roleId/assign")
  @ApiOperation({
    summary: "Assign role to user",
    description:
      "Assigns the selected role to a user in the business. Use this when a person needs the access and responsibilities provided by that role.",
  })
  assignRole(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("roleId", ParseUUIDPipe) roleId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.rolesService.assignRole(currentUser, businessId, roleId, dto);
  }

  @RequirePermission(
    RbacFeature.ROLE_PERMISSION_MANAGEMENT,
    PermissionAction.UPDATE,
  )
  @Patch("businesses/:businessId/assignments/:assignmentId")
  @ApiOperation({
    summary: "Update role assignment",
    description:
      "Updates an existing role assignment for a user. Use this when the assignment details need to be corrected or adjusted.",
  })
  updateAssignment(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Body() dto: UpdateRoleAssignmentDto,
  ) {
    return this.rolesService.updateAssignment(businessId, assignmentId, dto);
  }

  @RequirePermission(
    RbacFeature.ROLE_PERMISSION_MANAGEMENT,
    PermissionAction.UPDATE,
  )
  @Delete("businesses/:businessId/assignments/:assignmentId")
  @ApiOperation({
    summary: "Revoke role assignment",
    description:
      "Removes a user's role assignment from the selected business. Use this when the person should no longer have that role's access.",
  })
  revokeAssignment(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
  ) {
    return this.rolesService.revokeAssignment(businessId, assignmentId);
  }
}
