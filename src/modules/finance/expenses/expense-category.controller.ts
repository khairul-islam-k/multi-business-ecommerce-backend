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
  CreateExpenseCategoryDto,
  QueryExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from "./dto/finance-expense.dto";
import { ExpenseCategoryService } from "./expense-category.service";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@ApiTags("Finance Expense Categories")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("finance/businesses/:businessId/expense-categories")
export class ExpenseCategoryController {
  constructor(private readonly categories: ExpenseCategoryService) {}

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({
    summary: "Create expense category",
    description:
      "Creates expense category using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  create(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    return this.categories.create(businessId, dto);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get expense categories",
    description:
      "Shows expense categories that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryExpenseCategoryDto,
  ) {
    return this.categories.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":categoryId")
  @ApiOperation({
    summary: "Update expense category",
    description:
      "Updates expense category with the new information provided. Only the fields sent in the request are changed.",
  })
  update(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("categoryId", ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return this.categories.update(businessId, categoryId, dto);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":categoryId")
  @ApiOperation({
    summary: "Delete expense category",
    description:
      "Deletes expense category from normal day-to-day use. Records may be kept internally when the system needs history for reporting or auditing.",
  })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("categoryId", ParseUUIDPipe) categoryId: string,
  ) {
    return this.categories.remove(user, businessId, categoryId);
  }
}
