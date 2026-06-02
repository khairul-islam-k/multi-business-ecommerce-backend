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
import { PermissionAction, RbacFeature } from "@prisma/client";

import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
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

@ApiTags("Finance Taxes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("finance/businesses/:businessId/taxes")
export class FinanceTaxController {
  constructor(private readonly taxes: FinanceTaxService) {}

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({ summary: "Create tax" })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateFinanceTaxDto,
  ) {
    return this.taxes.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({ summary: "Get taxes" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryFinanceTaxDto,
  ) {
    return this.taxes.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get(":taxId")
  @ApiOperation({ summary: "Get tax" })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("taxId", ParseUUIDPipe) taxId: string,
  ) {
    return this.taxes.findOne(businessId, taxId);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":taxId")
  @ApiOperation({ summary: "Update tax" })
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
  @ApiOperation({ summary: "Delete tax" })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("taxId", ParseUUIDPipe) taxId: string,
  ) {
    return this.taxes.remove(user, businessId, taxId);
  }
}
