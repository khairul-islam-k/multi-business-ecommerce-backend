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
  AddFinanceAccountMoneyDto,
  CreateFinanceAccountDto,
  QueryFinanceAccountDto,
  QueryFinanceTransactionDto,
  UpdateFinanceAccountDto,
} from "./dto/finance-account.dto";
import { FinanceAccountService } from "./finance-account.service";

@ApiTags("Finance Accounts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("finance/businesses/:businessId/accounts")
export class FinanceAccountController {
  constructor(private readonly accounts: FinanceAccountService) {}

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({ summary: "Create finance account" })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateFinanceAccountDto,
  ) {
    return this.accounts.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({ summary: "Get finance accounts" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryFinanceAccountDto,
  ) {
    return this.accounts.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get(":accountId")
  @ApiOperation({ summary: "Get finance account" })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("accountId", ParseUUIDPipe) accountId: string,
  ) {
    return this.accounts.findOne(businessId, accountId);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.READ)
  @Get(":accountId/transactions")
  @ApiOperation({ summary: "Get finance account transactions" })
  findTransactions(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("accountId", ParseUUIDPipe) accountId: string,
    @Query() query: QueryFinanceTransactionDto,
  ) {
    return this.accounts.findTransactions(businessId, accountId, query);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.UPDATE)
  @Post(":accountId/add-money")
  @ApiOperation({ summary: "Add money to finance account" })
  addMoney(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("accountId", ParseUUIDPipe) accountId: string,
    @Body() dto: AddFinanceAccountMoneyDto,
  ) {
    return this.accounts.addMoney(user, businessId, accountId, dto);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":accountId")
  @ApiOperation({ summary: "Update finance account" })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("accountId", ParseUUIDPipe) accountId: string,
    @Body() dto: UpdateFinanceAccountDto,
  ) {
    return this.accounts.update(user, businessId, accountId, dto);
  }

  @RequirePermission(RbacFeature.FINANCE_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":accountId")
  @ApiOperation({ summary: "Delete finance account" })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("accountId", ParseUUIDPipe) accountId: string,
  ) {
    return this.accounts.remove(user, businessId, accountId);
  }
}
