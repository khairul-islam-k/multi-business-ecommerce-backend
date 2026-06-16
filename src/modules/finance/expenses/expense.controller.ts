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
import { PermissionAction, RbacFeature } from "@/database/schema";

import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { RequirePermission } from "../../permissions/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../../business/guards/business.guard";
import { SubscriptionGuard } from "../../packages/guards/subscription.guard";
import { PermissionGuard } from "../../permissions/guards/permission.guard";
import {
  CreateExpenseDto,
  QueryExpenseDto,
  UpdateExpenseDto,
} from "./dto/finance-expense.dto";
import { ExpenseService } from "./expense.service";

@ApiTags("Finance Expenses")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("finance/businesses/:businessId/expenses")
export class ExpenseController {
  constructor(private readonly expenses: ExpenseService) {}

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({
    summary: "Create expense",
    description:
      "Creates expense using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expenses.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get expenses",
    description:
      "Shows expenses that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryExpenseDto,
  ) {
    return this.expenses.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get(":expenseId")
  @ApiOperation({
    summary: "Get expense",
    description:
      "Shows expense that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("expenseId", ParseUUIDPipe) expenseId: string,
  ) {
    return this.expenses.findOne(businessId, expenseId);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":expenseId")
  @ApiOperation({
    summary: "Update expense",
    description:
      "Updates expense with the new information provided. Only the fields sent in the request are changed.",
  })
  update(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("expenseId", ParseUUIDPipe) expenseId: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expenses.update(businessId, expenseId, dto);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":expenseId/pay")
  @ApiOperation({
    summary: "Pay expense",
    description:
      "Records payment for expense and updates the related finance status.",
  })
  pay(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("expenseId", ParseUUIDPipe) expenseId: string,
  ) {
    return this.expenses.pay(user, businessId, expenseId);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":expenseId/cancel")
  @ApiOperation({
    summary: "Cancel expense",
    description:
      "Cancels expense when it should not continue. The system also updates related records that depend on this status.",
  })
  cancel(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("expenseId", ParseUUIDPipe) expenseId: string,
  ) {
    return this.expenses.cancel(businessId, expenseId);
  }
}
