import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CustomerAuthService } from "./customer-auth.service";
import { CurrentCustomer } from "./decorators/current-customer.decorator";
import {
  CustomerForgotPasswordDto,
  CustomerLoginDto,
  CustomerLogoutDto,
  CustomerRefreshTokenDto,
  CustomerRegisterDto,
  CustomerRequestVerificationDto,
  CustomerResetPasswordDto,
  CustomerVerifyEmailDto,
  CustomerVerifyResetOtpDto,
} from "./dto/customer-auth.dto";
import { CustomerAuthGuard } from "./guards/customer-auth.guard";

import type { CurrentCustomerPayload } from "./strategies/customer-jwt.strategy";

@ApiTags("Storefront Customer Auth")
@Controller("storefront/:websiteId/auth")
export class CustomerAuthController {
  constructor(private readonly auth: CustomerAuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Register storefront customer" })
  register(
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Body() dto: CustomerRegisterDto,
  ) {
    return this.auth.register(websiteId, dto);
  }

  @Post("login")
  @ApiOperation({ summary: "Login storefront customer" })
  login(
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Body() dto: CustomerLoginDto,
  ) {
    return this.auth.login(websiteId, dto);
  }

  @Post("refresh")
  @ApiOperation({ summary: "Refresh storefront customer session" })
  refresh(
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Body() dto: CustomerRefreshTokenDto,
  ) {
    return this.auth.refresh(websiteId, dto);
  }

  @Post("logout")
  @ApiOperation({ summary: "Logout storefront customer" })
  logout(@Body() dto: CustomerLogoutDto) {
    return this.auth.logout(dto);
  }

  @Post("request-verification")
  @ApiOperation({ summary: "Request storefront customer email verification" })
  requestEmailVerification(
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Body() dto: CustomerRequestVerificationDto,
  ) {
    return this.auth.requestEmailVerification(websiteId, dto);
  }

  @Post("verify-email")
  @ApiOperation({ summary: "Verify storefront customer email" })
  verifyEmail(
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Body() dto: CustomerVerifyEmailDto,
  ) {
    return this.auth.verifyEmail(websiteId, dto);
  }

  @Post("forgot-password")
  @ApiOperation({ summary: "Request storefront customer password reset" })
  forgotPassword(
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Body() dto: CustomerForgotPasswordDto,
  ) {
    return this.auth.forgotPassword(websiteId, dto);
  }

  @Post("verify-reset")
  @ApiOperation({ summary: "Verify storefront customer password reset OTP" })
  verifyResetOtp(
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Body() dto: CustomerVerifyResetOtpDto,
  ) {
    return this.auth.verifyResetOtp(websiteId, dto);
  }

  @Post("reset-password")
  @ApiOperation({ summary: "Reset storefront customer password" })
  resetPassword(
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Body() dto: CustomerResetPasswordDto,
  ) {
    return this.auth.resetPassword(websiteId, dto);
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(CustomerAuthGuard)
  @ApiOperation({ summary: "Get storefront customer profile" })
  me(@CurrentCustomer() customer: CurrentCustomerPayload) {
    return this.auth.me(customer);
  }
}
