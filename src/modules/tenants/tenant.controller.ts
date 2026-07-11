import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AdminGuard } from "../auth/guards/admin.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { QueryTenantDto } from "./dto/query-tenant.dto";
import { UpdateTenantStatusDto } from "./dto/update-tenant-status.dto";
import { TenantService } from "./tenant.service";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

@ApiTags("Tenants")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("tenants")
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get(":tenantId")
  @ApiOperation({
    summary: "Get a tenant",
    description:
      "Shows a tenant that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  @ApiParam({
    name: "tenantId",
    example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913",
  })
  findOne(@Param("tenantId", ParseUUIDPipe) tenantId: string) {
    return this.tenantService.findOne(tenantId);
  }

  @Get()
  @ApiOperation({
    summary: "Get tenants",
    description:
      "Shows tenants that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(@Query() query: QueryTenantDto) {
    return this.tenantService.findAll(query);
  }

  @Patch(":tenantId/status")
  @ApiOperation({
    summary: "Update tenant status",
    description:
      "Updates tenant status with the new information provided. Only the fields sent in the request are changed.",
  })
  @ApiParam({
    name: "tenantId",
    example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913",
  })
  updateStatus(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Body() dto: UpdateTenantStatusDto,
  ) {
    return this.tenantService.updateStatus(currentUser, tenantId, dto);
  }
}
