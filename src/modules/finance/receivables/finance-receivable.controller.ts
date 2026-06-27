import { PermissionAction, RbacFeature } from "@/database/schema";
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

import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import {
  QueryFinanceReceivableDto,
  ReceiveFinanceReceivableDto,
} from "./dto/finance-receivable.dto";
import { FinanceReceivableService } from "./finance-receivable.service";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@ApiTags("Finance Receivables")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("finance/businesses/:businessId/receivables")
export class FinanceReceivableController {
  constructor(private readonly receivables: FinanceReceivableService) {}

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get finance receivables",
    description:
      "Shows finance receivables that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryFinanceReceivableDto,
  ) {
    return this.receivables.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get(":receivableId")
  @ApiOperation({
    summary: "Get finance receivable",
    description:
      "Shows finance receivable that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("receivableId", ParseUUIDPipe) receivableId: string,
  ) {
    return this.receivables.findOne(businessId, receivableId);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":receivableId/receive")
  @ApiOperation({
    summary: "Receive finance receivable",
    description:
      "Records finance receivable as received so stock, supplier, and finance information can be brought up to date.",
  })
  receive(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("receivableId", ParseUUIDPipe) receivableId: string,
    @Body() dto: ReceiveFinanceReceivableDto,
  ) {
    return this.receivables.receive(user, businessId, receivableId, dto);
  }
}
