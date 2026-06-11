import { PermissionAction, RbacFeature } from "@prisma/client";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
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

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { BusinessGuard } from "../business/guards/business.guard";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { SubscriptionGuard } from "../packages/guards/subscription.guard";

import { AssignRoleDto } from "./dto/assign-role.dto";
import { CreateRoleDto } from "./dto/create-role.dto";
import { QueryRoleAssignmentsDto } from "./dto/query-role-assignment.dto";
import { QueryRoleDto } from "./dto/query-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { UpdateRoleAssignmentDto } from "./dto/update-role-assignment.dto";
import { RoleService } from "./role.service";

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
  })
  revokeAssignment(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
  ) {
    return this.rolesService.revokeAssignment(businessId, assignmentId);
  }
}
