import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { PermissionAction, RbacFeature } from "@prisma/client";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { CurrentBusiness } from "../business/decorators/current-business.decorator";
import { SkipBusinessGuard } from "../business/decorators/skip-business-guard.decorator";
import { RequirePermission } from "./decorators/require-permission.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../business/guards/business.guard";
import { SubscriptionGuard } from "../packages/guards/subscription.guard";
import { PermissionGuard } from "./guards/permission.guard";
import { AddPermissionDto } from "./dto/add-permission";
import { PermissionItemDto } from "./dto/permission-item.dto";
import { QueryPermissionDto } from "./dto/query-permission.dto";
import { UpdatePermissionDto } from "./dto/update-permission.dto";
import { PermissionService } from "./permission.service";
import type { BusinessAccessContext } from "../../common/request-context/request-context.types";
import { apiResponse } from "../../common/utils/api-response.util";

@ApiTags("Permissions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("permissions")
export class PermissionController {
  constructor(private readonly permissionsService: PermissionService) {}

  @Get("available")
  @SkipBusinessGuard()
  @ApiOperation({
    summary: "Get all available RBAC features and actions",
    description:
      "Shows every permission feature and action that the system understands. Use this to build permission screens or explain what access can be granted.",
  })
  getAvailablePermissions() {
    return this.permissionsService.getAvailablePermissions();
  }

  @Post("has/businesses/:businessId")
  @ApiOperation({
    summary: "Check for permission",
    description:
      "Checks whether the current user has one specific permission for the selected business. The response clearly says whether the action is allowed.",
  })
  async hasPermission(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBusiness() businessContext: BusinessAccessContext | null,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: PermissionItemDto,
  ) {
    const canReuseBusinessContext = businessContext?.businessId === businessId;

    const hasPermission = await this.permissionsService.hasPermission(
      user,
      businessId,
      dto.feature,
      dto.action,
      {
        isOwner: canReuseBusinessContext ? businessContext.isOwner : undefined,
        skipBusinessAccessCheck: canReuseBusinessContext,
      },
    );

    return apiResponse({ hasPermission });
  }

  @Get("businesses/:businessId")
  @RequirePermission(
    RbacFeature.ROLE_PERMISSION_MANAGEMENT,
    PermissionAction.READ,
  )
  @ApiOperation({
    summary: "Get all role permissions for a business",
    description:
      "Shows the permission settings assigned to roles in the selected business. Use this to review who can perform important business actions.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryPermissionDto,
  ) {
    return this.permissionsService.findAll(businessId, query);
  }

  @Get("businesses/:businessId/roles/:roleId")
  @RequirePermission(
    RbacFeature.ROLE_PERMISSION_MANAGEMENT,
    PermissionAction.READ,
  )
  @ApiOperation({
    summary: "Get permissions of a specific role",
    description:
      "Shows the full permission list for one role in the selected business. Use this before changing a role or explaining what that role can do.",
  })
  findByRole(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("roleId", ParseUUIDPipe) roleId: string,
  ) {
    return this.permissionsService.findByRole(businessId, roleId);
  }

  @Post("businesses/:businessId/roles/:roleId")
  @RequirePermission(
    RbacFeature.ROLE_PERMISSION_MANAGEMENT,
    PermissionAction.UPDATE,
  )
  @ApiOperation({
    summary: "Add permissions to a role",
    description:
      "Adds new permissions to an existing role without removing its current permissions. Use this when a role needs a few additional abilities.",
  })
  addToRole(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("roleId", ParseUUIDPipe) roleId: string,
    @Body() dto: AddPermissionDto,
  ) {
    return this.permissionsService.addToRole(businessId, roleId, dto);
  }

  @Put("businesses/:businessId/roles/:roleId")
  @RequirePermission(
    RbacFeature.ROLE_PERMISSION_MANAGEMENT,
    PermissionAction.UPDATE,
  )
  @ApiOperation({
    summary: "Replace all permissions of a role",
    description:
      "This removes old permissions first, then inserts the new permission list.",
  })
  replaceRolePermissions(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("roleId", ParseUUIDPipe) roleId: string,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.permissionsService.replaceRolePermissions(
      businessId,
      roleId,
      dto,
    );
  }

  @Delete("businesses/:businessId/roles/:roleId/:feature/:action")
  @RequirePermission(
    RbacFeature.ROLE_PERMISSION_MANAGEMENT,
    PermissionAction.UPDATE,
  )
  @ApiOperation({
    summary: "Remove a single permission from a role",
    description:
      "Removes one selected permission from a role. Use this when a role should keep most of its access but lose one specific ability.",
  })
  @ApiParam({
    name: "feature",
    enum: RbacFeature,
  })
  @ApiParam({
    name: "action",
    enum: PermissionAction,
  })
  removeFromRole(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("roleId", ParseUUIDPipe) roleId: string,
    @Param("feature", new ParseEnumPipe(RbacFeature)) feature: RbacFeature,
    @Param("action", new ParseEnumPipe(PermissionAction))
    action: PermissionAction,
  ) {
    return this.permissionsService.removeFromRole(
      businessId,
      roleId,
      feature,
      action,
    );
  }
}
