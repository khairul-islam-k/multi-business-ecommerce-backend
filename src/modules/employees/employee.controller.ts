import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PackageLimitKey, PermissionAction, RbacFeature } from "@prisma/client";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../business/guards/business.guard";
import { RequirePackageLimit } from "../packages/decorators/require-package-limit.decorator";
import { PackageLimitGuard } from "../packages/guards/package-limit.guard";
import { SubscriptionGuard } from "../packages/guards/subscription.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import { AssignEmployeeRolesDto } from "./dto/assign-employee-roles.dto";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { QueryEmployeesDto } from "./dto/query-employees.dto";
import { UpdateEmployeeStatusDto } from "./dto/update-employee-status.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { EmployeeService } from "./employee.service";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

@ApiTags("Employees")
@ApiBearerAuth()
@UseGuards(
  JwtAuthGuard,
  SubscriptionGuard,
  BusinessGuard,
  PermissionGuard,
  PackageLimitGuard,
)
@Controller("employees/businesses/:businessId")
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @RequirePermission(RbacFeature.EMPLOYEE_MANAGEMENT, PermissionAction.CREATE)
  @RequirePackageLimit(PackageLimitKey.MAX_EMPLOYEES)
  @Post()
  @ApiOperation({
    summary: "Create employee for a business",
  })
  create(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employeeService.create(currentUser, businessId, dto);
  }

  @RequirePermission(RbacFeature.EMPLOYEE_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get business employees",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryEmployeesDto,
  ) {
    return this.employeeService.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.EMPLOYEE_MANAGEMENT, PermissionAction.READ)
  @Get(":employeeId")
  @ApiOperation({
    summary: "Get single employee",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
  ) {
    return this.employeeService.findOne(businessId, employeeId);
  }

  @RequirePermission(RbacFeature.EMPLOYEE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":employeeId")
  @ApiOperation({
    summary: "Update employee",
  })
  update(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeeService.update(
      currentUser,
      businessId,
      employeeId,
      dto,
    );
  }

  @RequirePermission(RbacFeature.EMPLOYEE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":employeeId/status")
  @ApiOperation({
    summary: "Update employee status",
  })
  updateStatus(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
    @Body() dto: UpdateEmployeeStatusDto,
  ) {
    return this.employeeService.updateStatus(
      currentUser,
      businessId,
      employeeId,
      dto,
    );
  }

  @RequirePermission(RbacFeature.EMPLOYEE_MANAGEMENT, PermissionAction.UPDATE)
  @Put(":employeeId/roles")
  @ApiOperation({
    summary: "Replace employee roles for this business",
  })
  replaceRoles(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
    @Body() dto: AssignEmployeeRolesDto,
  ) {
    return this.employeeService.replaceRoles(
      currentUser,
      businessId,
      employeeId,
      dto,
    );
  }

  @RequirePermission(RbacFeature.EMPLOYEE_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":employeeId")
  @ApiOperation({
    summary: "Delete employee",
  })
  remove(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
  ) {
    return this.employeeService.remove(currentUser, businessId, employeeId);
  }
}
