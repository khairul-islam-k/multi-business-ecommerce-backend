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
import { PackageLimitKey, PermissionAction, RbacFeature } from "@/database/schema";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { RequirePackageLimit } from "../packages/decorators/require-package-limit.decorator";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../business/guards/business.guard";
import { PackageLimitGuard } from "../packages/guards/package-limit.guard";
import { SubscriptionGuard } from "../packages/guards/subscription.guard";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import { AssignEmployeeRolesDto } from "./dto/assign-employee-roles.dto";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { QueryEmployeesDto } from "./dto/query-employees.dto";
import { UpdateEmployeeStatusDto } from "./dto/update-employee-status.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { EmployeeService } from "./employee.service";

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
    description:
      "Adds a new employee to the selected business. Use this when a staff member needs access to the business account and should appear in employee records.",
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
    description:
      "Shows the employees that belong to the selected business. The list can be filtered or paged so an administrator can quickly find the right person.",
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
    description:
      "Shows the saved profile and business access information for one employee. Use this before reviewing, editing, or changing that employee's access.",
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
    description:
      "Updates the selected employee's saved details. Use this when correcting profile information or changing business-specific employee data.",
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
    description:
      "Changes whether the selected employee is active for the business. Use this when temporarily disabling or restoring an employee's access.",
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
    description:
      "Replaces the employee's current roles for this business with the new role list in the request. Use this when an employee's responsibilities or access level changes.",
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
    description:
      "Removes the selected employee from the business records. Use this when the person should no longer be managed as an employee of this business.",
  })
  remove(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
  ) {
    return this.employeeService.remove(currentUser, businessId, employeeId);
  }
}
