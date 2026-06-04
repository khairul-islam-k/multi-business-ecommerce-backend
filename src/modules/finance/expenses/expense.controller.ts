import {
  Body,
  Controller,
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
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import {
  CreateExpenseDto,
  QueryExpenseDto,
  UpdateExpenseDto,
} from "./dto/finance-expense.dto";
import { ExpenseService } from "./expense.service";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@ApiTags("Finance Expenses")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("finance/businesses/:businessId/expenses")
export class ExpenseController {
  constructor(private readonly expenses: ExpenseService) {}

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({ summary: "Create expense" })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expenses.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({ summary: "Get expenses" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryExpenseDto,
  ) {
    return this.expenses.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get(":expenseId")
  @ApiOperation({ summary: "Get expense" })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("expenseId", ParseUUIDPipe) expenseId: string,
  ) {
    return this.expenses.findOne(businessId, expenseId);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":expenseId")
  @ApiOperation({ summary: "Update expense" })
  update(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("expenseId", ParseUUIDPipe) expenseId: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expenses.update(businessId, expenseId, dto);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":expenseId/pay")
  @ApiOperation({ summary: "Pay expense" })
  pay(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("expenseId", ParseUUIDPipe) expenseId: string,
  ) {
    return this.expenses.pay(user, businessId, expenseId);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":expenseId/cancel")
  @ApiOperation({ summary: "Cancel expense" })
  cancel(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("expenseId", ParseUUIDPipe) expenseId: string,
  ) {
    return this.expenses.cancel(businessId, expenseId);
  }
}
