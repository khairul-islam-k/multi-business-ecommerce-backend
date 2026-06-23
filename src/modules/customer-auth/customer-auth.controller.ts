import {
  Body,
  Controller,
  Get,
  Headers,
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
@Controller("storefront/auth")
export class CustomerAuthController {
  constructor(private readonly auth: CustomerAuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Register storefront customer" })
  register(
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Body() dto: CustomerRegisterDto,
  ) {
    return this.auth.register(this.getRequestHost(host, forwardedHost), dto);
  }

  @Post("login")
  @ApiOperation({ summary: "Login storefront customer" })
  login(
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Body() dto: CustomerLoginDto,
  ) {
    return this.auth.login(this.getRequestHost(host, forwardedHost), dto);
  }

  @Post("refresh")
  @ApiOperation({ summary: "Refresh storefront customer session" })
  refresh(
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Body() dto: CustomerRefreshTokenDto,
  ) {
    return this.auth.refresh(this.getRequestHost(host, forwardedHost), dto);
  }

  @Post("logout")
  @ApiOperation({ summary: "Logout storefront customer" })
  logout(@Body() dto: CustomerLogoutDto) {
    return this.auth.logout(dto);
  }

  @Post("request-verification")
  @ApiOperation({ summary: "Request storefront customer email verification" })
  requestEmailVerification(
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Body() dto: CustomerRequestVerificationDto,
  ) {
    return this.auth.requestEmailVerification(
      this.getRequestHost(host, forwardedHost),
      dto,
    );
  }

  @Post("verify-email")
  @ApiOperation({ summary: "Verify storefront customer email" })
  verifyEmail(
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Body() dto: CustomerVerifyEmailDto,
  ) {
    return this.auth.verifyEmail(this.getRequestHost(host, forwardedHost), dto);
  }

  @Post("forgot-password")
  @ApiOperation({ summary: "Request storefront customer password reset" })
  forgotPassword(
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Body() dto: CustomerForgotPasswordDto,
  ) {
    return this.auth.forgotPassword(
      this.getRequestHost(host, forwardedHost),
      dto,
    );
  }

  @Post("verify-reset")
  @ApiOperation({ summary: "Verify storefront customer password reset OTP" })
  verifyResetOtp(
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Body() dto: CustomerVerifyResetOtpDto,
  ) {
    return this.auth.verifyResetOtp(
      this.getRequestHost(host, forwardedHost),
      dto,
    );
  }

  @Post("reset-password")
  @ApiOperation({ summary: "Reset storefront customer password" })
  resetPassword(
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Body() dto: CustomerResetPasswordDto,
  ) {
    return this.auth.resetPassword(
      this.getRequestHost(host, forwardedHost),
      dto,
    );
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(CustomerAuthGuard)
  @ApiOperation({ summary: "Get storefront customer profile" })
  me(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
  ) {
    return this.auth.me(customer, this.getRequestHost(host, forwardedHost));
  }

  private getRequestHost(host?: string, forwardedHost?: string) {
    return forwardedHost ?? host;
  }
}
