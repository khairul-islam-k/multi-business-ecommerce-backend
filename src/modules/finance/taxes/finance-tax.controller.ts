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

import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import {
  CreateFinanceTaxDto,
  QueryFinanceTaxDto,
  UpdateFinanceTaxDto,
} from "./dto/finance-tax.dto";
import { FinanceTaxService } from "./finance-tax.service";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@ApiTags("Finance Taxes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("finance/businesses/:businessId/taxes")
export class FinanceTaxController {
  constructor(private readonly taxes: FinanceTaxService) {}

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({
    summary: "Create tax",
    description:
      "Creates tax using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateFinanceTaxDto,
  ) {
    return this.taxes.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get taxes",
    description:
      "Shows taxes that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryFinanceTaxDto,
  ) {
    return this.taxes.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get(":taxId")
  @ApiOperation({
    summary: "Get tax",
    description:
      "Shows tax that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("taxId", ParseUUIDPipe) taxId: string,
  ) {
    return this.taxes.findOne(businessId, taxId);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":taxId")
  @ApiOperation({
    summary: "Update tax",
    description:
      "Updates tax with the new information provided. Only the fields sent in the request are changed.",
  })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("taxId", ParseUUIDPipe) taxId: string,
    @Body() dto: UpdateFinanceTaxDto,
  ) {
    return this.taxes.update(user, businessId, taxId, dto);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":taxId")
  @ApiOperation({
    summary: "Delete tax",
    description:
      "Deletes tax from normal day-to-day use. Records may be kept internally when the system needs history for reporting or auditing.",
  })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("taxId", ParseUUIDPipe) taxId: string,
  ) {
    return this.taxes.remove(user, businessId, taxId);
  }
}
