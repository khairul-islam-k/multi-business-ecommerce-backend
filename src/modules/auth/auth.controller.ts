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

import { CurrentUser } from "./decorators/current-user.decorator";
import type { CurrentUserPayload } from "./decorators/current-user.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
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
import { AuthService } from "./auth.service";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiOperation({
    summary: "Create a new business owner account",
    description:
      "Creates a new tenant user account, creates the first business for that user, starts the default trial subscription, and sends an email verification OTP. The account must verify the email address before normal sign-in is allowed.",
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("verify-email/request")
  @ApiOperation({
    summary: "Send OTP for email verification",
    description:
      "Sends a fresh one-time password to the user's email address so they can verify ownership of that email. Use this when the first code expired or the user did not receive it.",
  })
  requestEmailVerification(@Body() dto: RequestEmailChangeOrVerificationDto) {
    return this.authService.requestEmailVerification(dto);
  }

  @Post("verify-email")
  @ApiOperation({
    summary: "Email verification",
    description:
      "Checks the email verification OTP submitted by the user. When the code is valid, the account email is marked as verified and the user account becomes active.",
  })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Get("validate-email")
  @ApiOperation({
    summary: "Check whether an email can be used",
    description:
      "Checks whether an email address is already used by another account. Use this before registration or email-change screens to tell the user if the email is available.",
  })
  validateEmail(@Query("email") email: string) {
    return this.authService.validateEmail(email);
  }

  @Post("login")
  @ApiOperation({
    summary: "Sign in with email and password",
    description:
      "Signs in a verified and active user with their email and password. A successful response includes access tokens, the user's profile, subscription details when applicable, and the business selected for the session.",
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("change-email/request")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Send OTP for email change",
    description:
      "Sends a one-time password to the new email address for the signed-in user. The email address is not changed until the user submits this code for verification.",
  })
  requestEmailChange(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RequestEmailChangeOrVerificationDto,
  ) {
    return this.authService.requestEmailChange(user.id, dto);
  }

  @Post("change-email/verify")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Verify email change",
    description:
      "Confirms the one-time password sent to the user's new email address. When the code is valid, the account email is updated and marked as verified.",
  })
  verifyEmailChange(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: VerifyChangeEmailDto,
  ) {
    return this.authService.verifyEmailChange(user.id, dto);
  }

  @Post("forgot-password")
  @ApiOperation({
    summary: "Send a password reset code",
    description:
      "Sends a password reset code to the user's registered email address. Use this when a user forgot their password and needs to prove they control the account email.",
  })
  requestForgotPasswordOtp(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestForgotPasswordOtp(dto);
  }

  @Post("reset-password/verify-otp")
  @ApiOperation({
    summary: "Verify reset password OTP",
    description:
      "Checks the password reset OTP before allowing a new password to be saved. A successful response returns a verification id that must be used in the final password reset step.",
  })
  verifyResetPassword(@Body() dto: VerifyResetOtpDto) {
    return this.authService.verifyResetPassword(dto);
  }

  @Post("forgot-password/reset")
  @ApiOperation({
    summary: "Save a new forgotten password",
    description:
      "Sets a new password after the user has successfully verified the password reset OTP. Existing sessions are revoked so old logged-in devices can no longer continue using the account.",
  })
  resetForgotPassword(@Body() dto: ResetForgotPasswordDto) {
    return this.authService.resetForgotPassword(dto);
  }

  @Post("reset")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Reset password",
    description:
      "Changes the password for the currently signed-in user after confirming their old password. Use this from account settings when the user knows the current password.",
  })
  resetPassword(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(user, dto);
  }

  @Post("refresh")
  @ApiOperation({
    summary: "Refresh the current access token",
    description:
      "Uses a valid refresh token to issue a new access token and a rotated refresh token. This keeps a signed-in session alive without asking the user to enter their password again.",
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post("select-business")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Select active business after login",
    description:
      "Switches the user's active business for the current session. The new access token is tied to the selected business so later requests know which business the user is working in.",
  })
  selectBusiness(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SelectBusinessDto,
  ) {
    return this.authService.selectBusiness(user.id, dto);
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Get the signed-in user's profile",
    description:
      "Shows the signed-in user's profile, accessible businesses, active subscription information, and currently selected business. Use this to restore the user's session context after opening the app.",
  })
  getUser(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getUser(user);
  }

  @Patch("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Update the signed-in user's profile",
    description:
      "Updates the signed-in user's personal profile details. Only the fields sent in the request are changed, so unchanged profile information stays as it was.",
  })
  updateUser(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateUserDto,
  ) {
    return this.authService.updateUser(user.id, dto);
  }

  @Post("logout")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Logout current session",
    description:
      "Ends the current session by revoking the refresh token provided in the request. Use this when the user signs out from the current browser or device.",
  })
  logout(@CurrentUser() user: CurrentUserPayload, @Body() dto: LogoutDto) {
    return this.authService.logout(dto, user.id);
  }

  @Post("logout-all")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Logout from all sessions",
    description:
      "Signs the user out everywhere by revoking all active sessions for the account. Use this after a password change, account security concern, or a manual sign-out from every device.",
  })
  logoutAll(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.logoutAll(user.id);
  }
}
