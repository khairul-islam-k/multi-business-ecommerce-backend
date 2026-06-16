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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { PackageLimitKey, PermissionAction, RbacFeature } from "@/database/schema";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { RequirePackageLimit } from "../packages/decorators/require-package-limit.decorator";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PackageLimitGuard } from "../packages/guards/package-limit.guard";
import { SubscriptionGuard } from "../packages/guards/subscription.guard";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import { BusinessGuard } from "./guards/business.guard";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { QueryBusinessDto } from "./dto/query-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";
import { BusinessService } from "./business.service";

@ApiTags("Business")
@ApiBearerAuth()
@UseGuards(
  JwtAuthGuard,
  SubscriptionGuard,
  BusinessGuard,
  PermissionGuard,
  PackageLimitGuard,
)
@Controller("businesses")
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @RequirePermission(RbacFeature.BUSINESS_MANAGEMENT, PermissionAction.CREATE)
  @RequirePackageLimit(PackageLimitKey.MAX_BUSINESSES)
  @Post()
  @ApiOperation({
    summary: "Create business",
    description:
      "Creates business using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateBusinessDto,
  ) {
    return this.businessService.create(user.id, dto);
  }

  @RequirePermission(RbacFeature.BUSINESS_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get businesses",
    description:
      "Shows businesses that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryBusinessDto,
  ) {
    return this.businessService.findAll(user, query);
  }

  @RequirePermission(RbacFeature.BUSINESS_MANAGEMENT, PermissionAction.READ)
  @Get(":businessId")
  @ApiOperation({
    summary: "Get business details",
    description:
      "Shows business details that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  @ApiParam({
    name: "businessId",
    example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913",
  })
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
  ) {
    return this.businessService.findOne(user, businessId);
  }

  @RequirePermission(RbacFeature.BUSINESS_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":businessId")
  @ApiOperation({
    summary: "Update business",
    description:
      "Updates business with the new information provided. Only the fields sent in the request are changed.",
  })
  @ApiParam({
    name: "businessId",
    example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913",
  })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.businessService.update(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.BUSINESS_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":businessId")
  @ApiOperation({
    summary: "Delete business",
    description:
      "Deletes business from normal day-to-day use. Records may be kept internally when the system needs history for reporting or auditing.",
  })
  @ApiParam({
    name: "businessId",
    example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913",
  })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
  ) {
    return this.businessService.remove(user, businessId);
  }
}
