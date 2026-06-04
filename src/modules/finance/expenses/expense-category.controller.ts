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

@ApiTags("Finance Expense Categories")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("finance/businesses/:businessId/expense-categories")
export class ExpenseCategoryController {
  constructor(private readonly categories: ExpenseCategoryService) {}

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({ summary: "Create expense category" })
  create(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    return this.categories.create(businessId, dto);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({ summary: "Get expense categories" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryExpenseCategoryDto,
  ) {
    return this.categories.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":categoryId")
  @ApiOperation({ summary: "Update expense category" })
  update(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("categoryId", ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return this.categories.update(businessId, categoryId, dto);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":categoryId")
  @ApiOperation({ summary: "Delete expense category" })
  remove(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("categoryId", ParseUUIDPipe) categoryId: string,
  ) {
    return this.categories.remove(businessId, categoryId);
  }
}
