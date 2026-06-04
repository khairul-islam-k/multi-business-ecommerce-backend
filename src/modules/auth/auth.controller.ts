import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { LogoutDto } from "./dto/logout.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { RequestEmailChangeOrVerificationDto } from "./dto/request-email-change-or-verification.dto";
import { ResetForgotPasswordDto } from "./dto/reset-forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { SelectBusinessDto } from "./dto/select-business.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { VerifyChangeEmailDto } from "./dto/verify-email-change.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { VerifyResetOtpDto } from "./dto/verify-reset-email.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

import type { CurrentUserPayload } from "./decorators/current-user.decorator";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Register tenant" })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("verify-email/request")
  @ApiOperation({ summary: "Send otp for email verification" })
  requestEmailVerification(@Body() dto: RequestEmailChangeOrVerificationDto) {
    return this.authService.requestEmailVerification(dto);
  }

  @Post("verify-email")
  @ApiOperation({ summary: "Email verification" })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Get("validate-email")
  @ApiOperation({ summary: "Email Validation" })
  validateEmail(@Query("email") email: string) {
    return this.authService.validateEmail(email);
  }

  @Post("login")
  @ApiOperation({ summary: "Login user" })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("change-email/request")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Send otp for email change" })
  requestEmailChange(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RequestEmailChangeOrVerificationDto,
  ) {
    return this.authService.requestEmailChange(user.id, dto);
  }

  @Post("change-email/verify")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Verify email for email change" })
  verifyEmailChange(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: VerifyChangeEmailDto,
  ) {
    return this.authService.verifyEmailChange(user.id, dto);
  }

  @Post("forgot-password")
  @ApiOperation({ summary: "Send otp for forget password" })
  requestForgotPasswordOtp(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestForgotPasswordOtp(dto);
  }

  @Post("reset-password/verify-otp")
  @ApiOperation({ summary: "Verify reset password OTP" })
  verifyResetPassword(@Body() dto: VerifyResetOtpDto) {
    return this.authService.verifyResetPassword(dto);
  }

  @Post("forgot-password/reset")
  @ApiOperation({ summary: "Reset forget password" })
  resetForgotPassword(@Body() dto: ResetForgotPasswordDto) {
    return this.authService.resetForgotPassword(dto);
  }

  @Post("reset")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Reset password" })
  resetPassword(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(user, dto);
  }

  @Post("refresh")
  @ApiOperation({ summary: "Refresh the current access token" })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post("select-business")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Select active business after login" })
  selectBusiness(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SelectBusinessDto,
  ) {
    return this.authService.selectBusiness(user.id, dto);
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get authenticated user's profile" })
  getUser(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getUser(user);
  }

  @Patch("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Update authenticated user's profile" })
  updateUser(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateUserDto,
  ) {
    return this.authService.updateUser(user.id, dto);
  }

  @Post("logout")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Logout current session" })
  logout(@CurrentUser() user: CurrentUserPayload, @Body() dto: LogoutDto) {
    return this.authService.logout(dto, user.id);
  }

  @Post("logout-all")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Logout from all sessions" })
  logoutAll(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.logoutAll(user.id);
  }
}
