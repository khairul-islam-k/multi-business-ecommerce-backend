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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PermissionAction, RbacFeature } from "@prisma/client";

import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import {
  PayFinancePayableDto,
  QueryFinancePayableDto,
} from "./dto/finance-payable.dto";
import { FinancePayableService } from "./finance-payable.service";

@ApiTags("Finance Payables")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("finance/businesses/:businessId/payables")
export class FinancePayableController {
  constructor(private readonly payables: FinancePayableService) {}

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get finance payables",
    description:
      "Shows finance payables that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryFinancePayableDto,
  ) {
    return this.payables.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get(":payableId")
  @ApiOperation({
    summary: "Get finance payable",
    description:
      "Shows finance payable that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("payableId", ParseUUIDPipe) payableId: string,
  ) {
    return this.payables.findOne(businessId, payableId);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":payableId/pay")
  @ApiOperation({
    summary: "Pay finance payable",
    description:
      "Records payment for finance payable and updates the related finance status.",
  })
  pay(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("payableId", ParseUUIDPipe) payableId: string,
    @Body() dto: PayFinancePayableDto,
  ) {
    return this.payables.pay(user, businessId, payableId, dto);
  }
}
