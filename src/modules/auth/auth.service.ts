import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  BusinessMemberStatus,
  BusinessStatus,
  OtpPurpose,
  SystemUser,
  SystemUserStatus,
  SystemUserType,
} from "@prisma/client";
import * as argon2 from "argon2";

import type { CurrentUserPayload } from "./decorators/current-user.decorator";
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
import { OtpPolicy } from "./domain/otp.policy";
import { SessionService } from "./application/session.service";
import { TokenService } from "./application/token.service";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessService } from "../business/business.service";
import { MailService } from "../mail/mail.service";
import { PackageSubscriptionService } from "../packages/package-subscription.service";
import { normalizeEmail } from "../../common/text/normalizers";
import { apiResponse } from "../../common/utils/api-response.util";

type AuthBusiness = {
  id: string;
  ownerUserId: string;
  members: {
    id: string;
    userId: string;
  }[];
};

const ACCESSIBLE_BUSINESS_STATUSES = [
  BusinessStatus.TRIAL,
  BusinessStatus.ACTIVE,
] satisfies BusinessStatus[];

@Injectable()
export class AuthService {
  private readonly logger = new Logger("Auth");

  constructor(
    private readonly prisma: PrismaService,
    private readonly businessService: BusinessService,
    private readonly packageSubscriptions: PackageSubscriptionService,
    private readonly tokens: TokenService,
    private readonly otpPolicy: OtpPolicy,
    private readonly mailService: MailService,
    private readonly sessions: SessionService,
  ) {}

  async register(dto: RegisterDto) {
    const email = normalizeEmail(dto.email);

    const existingUser = await this.prisma.systemUser.findUnique({
      where: { email },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictException(
        "This email address is already linked to an account. Please sign in or use another email address.",
      );
    }

    const otp = this.otpPolicy.generateOtp();
    const otpHash = await this.hashPassword(otp);
    const passwordHash = await this.hashPassword(dto.password);
    const expiresAt = this.otpPolicy.getExpiresAt();

    const data = await this.prisma.$transaction(async (tx) => {
      const user = await tx.systemUser.create({
        data: {
          name: dto.name,
          email,
          passwordHash,
          status: SystemUserStatus.INACTIVE,
          type: SystemUserType.TENANT,
          emailVerifiedAt: null,
          profile: {
            create: {},
          },
        },
      });

      await tx.systemEmailVerification.create({
        data: {
          userId: user.id,
          otpHash,
          purpose: OtpPurpose.EMAIL_VERIFICATION,
          expiresAt,
        },
      });

      await this.packageSubscriptions.assignDefaultTrial(user.id, tx);

      const selectedBusiness = await this.businessService
        .create(
          user.id,
          {
            name: dto.businessName,
          },
          tx,
        )
        .then((res) => res.data);

      const { passwordHash: _, ...safeUser } = user;

      return {
        user: safeUser,
        selectedBusiness,
      };
    });

    void this.mailService
      .sendEmailVerificationOtp(email, otp)
      .catch((error) => {
        this.logger.error(
          `Failed to send verification email to ${email}`,
          error,
        );
      });

    return apiResponse(
      data,
      "Registration successful. A verification email has been sent to your email account.",
    );
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = normalizeEmail(dto.email);

    const user = await this.prisma.systemUser.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        status: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException(
        "User with the given email does not exist.",
      );
    }

    if (user.emailVerifiedAt) {
      return apiResponse(
        null,
        "This email address is already verified. No additional verification step is needed.",
      );
    }

    const verification = await this.prisma.systemEmailVerification.findFirst({
      where: {
        userId: user.id,
        purpose: OtpPurpose.EMAIL_VERIFICATION,
        verifiedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!verification) {
      throw new BadRequestException(
        "The one-time password is invalid or has expired. Please request a new code and try again.",
      );
    }

    this.otpPolicy.assertCanAttempt(verification.attemptCount);

    const isOtpMatched = await this.verifyPassword(
      verification.otpHash,
      dto.otp,
    );

    if (!isOtpMatched) {
      await this.prisma.systemEmailVerification.update({
        where: {
          id: verification.id,
        },
        data: {
          attemptCount: {
            increment: 1,
          },
        },
      });

      throw new BadRequestException(
        "The one-time password is incorrect. Please check the code and try again.",
      );
    }

    await this.prisma.$transaction([
      this.prisma.systemEmailVerification.update({
        where: {
          id: verification.id,
        },
        data: {
          verifiedAt: new Date(),
        },
      }),

      this.prisma.systemUser.update({
        where: {
          id: user.id,
        },
        data: {
          emailVerifiedAt: new Date(),
          status: SystemUserStatus.ACTIVE,
        },
      }),
    ]);

    return apiResponse(
      { success: "true" },
      "Email has been verified successfully.",
    );
  }

  async requestEmailVerification(dto: RequestEmailChangeOrVerificationDto) {
    const email = normalizeEmail(dto.email);

    const user = await this.prisma.systemUser.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException(
        "User with the given email does not exist.",
      );
    }

    const otp = this.otpPolicy.generateOtp();
    const otpHash = await this.hashPassword(otp);
    const expiresAt = this.otpPolicy.getExpiresAt();

    const verification = await this.prisma.systemEmailVerification.create({
      data: {
        userId: user.id,
        otpHash,
        purpose: OtpPurpose.EMAIL_VERIFICATION,
        expiresAt,
      },
      select: {
        id: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    void this.mailService
      .sendEmailVerificationOtp(email, otp)
      .catch((error) => {
        this.logger.error(
          `Failed to send verification email to ${email}`,
          error,
        );
      });

    return apiResponse(
      {
        verificationId: verification.id,
        email,
        expiresAt: verification.expiresAt,
      },
      "A new one-time password has been sent to this email address. Please use it before it expires.",
    );
  }

  async validateEmail(email: string) {
    const normalizedEmail = normalizeEmail(email);

    const user = await this.prisma.systemUser.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
        status: true,
      },
    });

    return apiResponse(
      {
        exists: Boolean(user),
        available: !user,
      },
      user
        ? "This email address is already linked to an account. Please sign in or use another email address."
        : "This email address is available and can be used for a new account.",
    );
  }

  async login(dto: LoginDto) {
    const email = normalizeEmail(dto.email);

    const user = await this.prisma.systemUser.findUnique({
      where: { email },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const isPasswordMatched = await this.verifyPassword(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordMatched) {
      throw new UnauthorizedException(
        "The email address or password is incorrect. Please check your details and try again.",
      );
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException(
        "This account has not verified its email address yet. Please verify the email before signing in.",
      );
    }

    this.assertActiveUser(user);

    const { passwordHash: _, ...safeUser } = user;

    if (user.type === SystemUserType.ADMIN) {
      const tokens = await this.sessions.issueTokenPair({
        sub: user.id,
        type: user.type,
        businessId: null,
      });

      return apiResponse(
        {
          ...tokens,
          selectedBusiness: null,
          activeSubscription: null,
          user: safeUser,
        },
        "You have signed in successfully. Your administrator session is ready to use.",
      );
    }

    // TODO: before removing this line completely, check if everything checks for it or not.
    // await this.packageSubscriptions.assertTenantSubscriptionActive(user);
    const activeSubscription =
      await this.packageSubscriptions.findCurrentSubscription(
        user.tenantId ?? user.id,
      );

    const businesses = await this.findAccessibleBusinesses(user.id);

    if (businesses.length === 0) {
      throw new ForbiddenException("You are not assigned to any business");
    }

    const selectedBusiness = businesses[0];

    const tokens = await this.sessions.issueTokenPair({
      sub: user.id,
      type: user.type,
      businessId: selectedBusiness.id,
    });

    return apiResponse(
      {
        ...tokens,
        selectedBusiness,
        businesses,
        activeSubscription,
        user: safeUser,
      },
      "You have signed in successfully. Your workspace is ready with the selected business and subscription details.",
    );
  }

  async requestEmailChange(
    userId: string,
    dto: RequestEmailChangeOrVerificationDto,
  ) {
    const newEmail = normalizeEmail(dto.email);

    const user = await this.prisma.systemUser.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      throw new BadRequestException(
        "User with the given email does not exist.",
      );
    }

    if (user.email === newEmail) {
      throw new BadRequestException("New email must be different.");
    }

    const existingUser = await this.prisma.systemUser.findFirst({
      where: {
        email: newEmail,
        id: {
          not: userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictException(
        "This email address is already linked to another account. Please choose a different email address.",
      );
    }

    const otp = this.otpPolicy.generateOtp();
    const otpHash = await this.hashPassword(otp);
    const expiresAt = this.otpPolicy.getExpiresAt();

    const verification = await this.prisma.systemEmailVerification.create({
      data: {
        userId,
        otpHash,
        purpose: OtpPurpose.EMAIL_CHANGE,
        expiresAt,
      },
      select: {
        id: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    void this.mailService
      .sendChangeEmailOtpEmail(newEmail, otp)
      .catch((error) => {
        this.logger.error(
          `Failed to send verification email to ${newEmail}`,
          error,
        );
      });

    return apiResponse(
      {
        verificationId: verification.id,
        email: newEmail,
        expiresAt: verification.expiresAt,
      },
      "A one-time password has been sent to your new email address. Please verify it before the email change can be completed.",
    );
  }

  async verifyEmailChange(userId: string, dto: VerifyChangeEmailDto) {
    const newEmail = normalizeEmail(dto.email);

    const user = await this.prisma.systemUser.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    if (user.email === newEmail) {
      throw new BadRequestException("New email must be different.");
    }

    const existingUser = await this.prisma.systemUser.findFirst({
      where: {
        email: newEmail,
        id: {
          not: userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictException(
        "This email address is already linked to another account. Please choose a different email address.",
      );
    }

    const verification = await this.prisma.systemEmailVerification.findFirst({
      where: {
        userId,
        purpose: OtpPurpose.EMAIL_CHANGE,
        verifiedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        otpHash: true,
        expiresAt: true,
        attemptCount: true,
        createdAt: true,
      },
    });

    if (!verification) {
      throw new BadRequestException(
        "The one-time password is invalid or has expired. Please request a new code and try again.",
      );
    }

    const isOtpValid = await this.verifyPassword(verification.otpHash, dto.otp);

    if (!isOtpValid) {
      throw new BadRequestException(
        "The one-time password is incorrect. Please check the code and try again.",
      );
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.systemUser.update({
        where: {
          id: userId,
        },
        data: {
          email: newEmail,
          emailVerifiedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          type: true,
          status: true,
          emailVerifiedAt: true,
          profile: true,
        },
      });

      await tx.systemEmailVerification.update({
        where: {
          id: verification.id,
        },
        data: {
          verifiedAt: new Date(),
        },
      });

      return updated;
    });

    return apiResponse(
      updatedUser,
      "Your email address has been updated successfully and is now verified for this account.",
    );
  }

  async requestForgotPasswordOtp(dto: ForgotPasswordDto) {
    const email = normalizeEmail(dto.email);

    const user = await this.prisma.systemUser.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });

    if (!user) {
      throw new BadRequestException(
        "User with the given email does not exist.",
      );
    }

    this.assertActiveUser(user);

    const otp = this.otpPolicy.generateOtp();
    const otpHash = await this.hashPassword(otp);
    const expiresAt = this.otpPolicy.getExpiresAt();

    await this.prisma.systemPasswordReset.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt,
      },
    });

    void this.mailService
      .sendForgotPasswordOtpEmail(email, otp)
      .catch((error) => {
        this.logger.error(
          `Failed to send verification email to ${email}`,
          error,
        );
      });

    return apiResponse(
      { success: true },
      "A password reset one-time password has been sent to your email address. Please use it before it expires.",
    );
  }

  async resetForgotPassword(dto: ResetForgotPasswordDto) {
    const email = normalizeEmail(dto.email);

    const user = await this.prisma.systemUser.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        status: true,
      },
    });

    if (!user) {
      throw new BadRequestException(
        "User with the given email does not exist.",
      );
    }

    this.assertActiveUser(user);

    const verification = await this.prisma.systemEmailVerification.findFirst({
      where: {
        id: dto.verificationId,
        userId: user.id,
        purpose: OtpPurpose.PASSWORD_RESET,
        verifiedAt: {
          not: null,
        },
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!verification) {
      throw new BadRequestException(
        "The one-time password is invalid or has expired. Please request a new code and try again.",
      );
    }

    const resetRecord = await this.prisma.systemPasswordReset.findFirst({
      where: {
        userId: user.id,
        otpHash: verification.otpHash,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!resetRecord) {
      throw new BadRequestException(
        "Reset request is invalid or has been expired.",
      );
    }

    const isSamePassword = await this.verifyPassword(
      user.passwordHash,
      dto.password,
    );

    if (isSamePassword) {
      throw new BadRequestException(
        "New password must be different from old password.",
      );
    }

    const passwordHash = await this.hashPassword(dto.password);

    await this.prisma.$transaction([
      this.prisma.systemUser.update({
        where: {
          id: user.id,
        },
        data: {
          passwordHash,
        },
      }),

      this.prisma.systemPasswordReset.update({
        where: {
          id: resetRecord.id,
        },
        data: {
          usedAt: new Date(),
        },
      }),

      this.prisma.systemSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    return apiResponse(
      { success: true },
      "Your password has been reset successfully.",
    );
  }

  async verifyResetPassword(dto: VerifyResetOtpDto) {
    const email = normalizeEmail(dto.email);

    const user = await this.prisma.systemUser.findUnique({
      where: { email },
      select: {
        id: true,
        status: true,
      },
    });

    if (!user) {
      throw new BadRequestException(
        "User with the given email does not exist.",
      );
    }

    this.assertActiveUser(user);

    const resetRecord = await this.prisma.systemPasswordReset.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!resetRecord) {
      throw new BadRequestException(
        "The one-time password is invalid or has expired. Please request a new password reset code.",
      );
    }

    this.otpPolicy.assertCanAttempt(
      resetRecord.attemptCount,
      "Too many attempts. Please request a new OTP.",
    );

    const isOtpMatched = await this.verifyPassword(
      resetRecord.otpHash,
      dto.otp,
    );

    if (!isOtpMatched) {
      await this.prisma.systemPasswordReset.update({
        where: {
          id: resetRecord.id,
        },
        data: {
          attemptCount: {
            increment: 1,
          },
        },
      });

      throw new BadRequestException(
        "The one-time password is incorrect. Please check the code and try again.",
      );
    }

    const verification = await this.prisma.systemEmailVerification.create({
      data: {
        userId: user.id,
        otpHash: resetRecord.otpHash,
        purpose: OtpPurpose.PASSWORD_RESET,
        expiresAt: resetRecord.expiresAt,
        verifiedAt: new Date(),
      },
      select: {
        id: true,
      },
    });

    return apiResponse(
      {
        verificationId: verification.id,
      },
      "OTP has been verified successfully.",
    );
  }

  async resetPassword(user: CurrentUserPayload, dto: ResetPasswordDto) {
    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException(
        "New password must be different from old password.",
      );
    }

    const existingUser = await this.prisma.systemUser.findUnique({
      where: {
        id: user.id,
      },
      select: {
        id: true,
        passwordHash: true,
        status: true,
      },
    });

    if (!existingUser) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    this.assertActiveUser(existingUser);

    const isOldPasswordMatched = await this.verifyPassword(
      existingUser.passwordHash,
      dto.oldPassword,
    );

    if (!isOldPasswordMatched) {
      throw new UnauthorizedException("Old password is incorrect.");
    }

    const newPasswordHash = await this.hashPassword(dto.newPassword);

    const updatedUser = await this.prisma.systemUser.update({
      where: {
        id: existingUser.id,
      },
      data: {
        passwordHash: newPasswordHash,
      },
      omit: {
        passwordHash: true,
      },
    });

    return apiResponse(
      updatedUser,
      "Your password has been changed successfully. Please use the new password the next time you sign in.",
    );
  }

  async refresh(dto: RefreshTokenDto) {
    const now = new Date();

    const session = await this.sessions.findByRefreshToken(dto.refreshToken);

    if (!session) {
      throw new UnauthorizedException(
        "This session could not be refreshed. Please sign in again.",
      );
    }

    if (session.revokedAt) {
      await this.sessions.revokeAllUserSessions(session.userId);

      throw new UnauthorizedException(
        "This session token was already used. For your safety, all sessions have been signed out. Please sign in again.",
      );
    }

    if (session.expiresAt <= now) {
      await this.sessions.revokeSession(session.id, now);

      throw new UnauthorizedException(
        "This session has expired. Please sign in again to continue.",
      );
    }

    const user = session.user;

    this.assertActiveUser(user);
    await this.packageSubscriptions.assertTenantSubscriptionActive(user);

    const requestedBusinessId = dto.businessId ?? session.businessId;

    const selectedBusiness = await this.resolveSelectedBusiness(
      user.id,
      user.type,
      requestedBusinessId,
    );

    const tokenBusinessId = selectedBusiness?.id ?? null;

    const accessToken = await this.tokens.generateAccessToken({
      sub: user.id,
      type: user.type,
      businessId: tokenBusinessId,
    });

    const newRefreshToken = await this.sessions.rotateRefreshSession({
      sessionId: session.id,
      userId: user.id,
      businessId: tokenBusinessId,
      revokedAt: now,
    });

    const { passwordHash, ...safeUser } = user;

    return apiResponse(
      {
        accessToken,
        refreshToken: newRefreshToken,
        selectedBusiness,
        user: safeUser,
      },
      "Your session has been refreshed successfully. You can continue using the app without signing in again.",
    );
  }

  async selectBusiness(userId: string, dto: SelectBusinessDto) {
    const user = await this.prisma.systemUser.findUnique({
      where: {
        id: userId,
      },
      omit: {
        passwordHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid authenticated user");
    }

    this.assertActiveUser(user);
    await this.packageSubscriptions.assertTenantSubscriptionActive(user);

    const business = await this.findAccessibleBusiness(userId, dto.businessId);

    if (!business) {
      throw new ForbiddenException("You do not have access to this business");
    }

    const accessToken = await this.tokens.generateAccessToken({
      sub: user.id,
      type: user.type,
      businessId: business.id,
    });

    await this.sessions.bindRefreshSessionToBusiness(
      user.id,
      dto.refreshToken,
      business.id,
    );

    return apiResponse(
      {
        accessToken,
        selectedBusiness: business,
        user,
      },
      "The selected business is now active for your session. Future requests will use this business context.",
    );
  }

  async getUser(currentUserPayload: CurrentUserPayload) {
    const user = await this.prisma.systemUser.findUnique({
      where: {
        id: currentUserPayload.id,
      },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User with the given id does not exist.");
    }

    const { passwordHash: _, ...safeUser } = user;

    if (user.type === SystemUserType.ADMIN) {
      return apiResponse(
        {
          user: safeUser,
          activeSubscription: null,
          selectedBusiness: null,
          businesses: [],
        },
        "Your administrator profile has been loaded successfully.",
      );
    }

    const businesses = await this.findAccessibleBusinesses(user.id);

    const activeSubscription =
      await this.packageSubscriptions.findCurrentSubscription(
        user.tenantId ?? user.id,
      );

    if (businesses.length === 0) {
      throw new ForbiddenException("You are not assigned to any business");
    }

    let selectedBusiness: AuthBusiness | null = null;

    if (currentUserPayload.businessId !== null) {
      selectedBusiness =
        businesses.find(
          (business) => business.id === currentUserPayload.businessId,
        ) ?? null;

      if (!selectedBusiness) {
        throw new ForbiddenException(
          "You no longer have access to this business",
        );
      }
    }

    return apiResponse(
      {
        user: safeUser,
        activeSubscription,
        selectedBusiness,
        businesses,
      },
      "Your profile and business access details have been loaded successfully.",
    );
  }

  async updateUser(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.systemUser.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        profile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    if (dto.phone) {
      const phoneExists = await this.prisma.systemUser.findFirst({
        where: {
          phone: dto.phone,
          deletedAt: null,
          id: {
            not: userId,
          },
        },
        select: {
          id: true,
        },
      });

      if (phoneExists) {
        throw new ConflictException(
          "This phone number is already linked to another account. Please use a different phone number.",
        );
      }
    }

    const updatedUser = await this.prisma.systemUser.update({
      where: {
        id: userId,
      },
      data: {
        name: dto.name,
        phone: dto.phone,

        profile: dto.profile
          ? {
              update: {
                ...dto.profile,
                dateOfBirth: dto.profile.dateOfBirth
                  ? new Date(dto.profile.dateOfBirth)
                  : undefined,
              },
            }
          : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        type: true,
        status: true,
        profile: true,
      },
    });

    return apiResponse(
      updatedUser,
      "Your profile has been updated successfully. The latest saved profile information is included in this response.",
    );
  }

  async logout(dto: LogoutDto, userId?: string) {
    await this.sessions.revokeByRefreshToken(dto.refreshToken, userId);

    return apiResponse(
      null,
      "You have been signed out from this session successfully.",
    );
  }

  async logoutAll(userId: string) {
    await this.sessions.revokeAllUserSessions(userId);

    return apiResponse(
      null,
      "You have been signed out from all devices successfully. Any device will need to sign in again before using the account.",
    );
  }

  private async resolveSelectedBusiness(
    userId: string,
    userType: SystemUserType,
    requestedBusinessId: string | null,
  ): Promise<AuthBusiness | null> {
    if (userType === SystemUserType.ADMIN) {
      return null;
    }

    if (requestedBusinessId !== null) {
      const business = await this.findAccessibleBusiness(
        userId,
        requestedBusinessId,
      );

      if (!business) {
        throw new ForbiddenException("You do not have access to this business");
      }

      return business;
    }

    const businesses = await this.findAccessibleBusinesses(userId);

    if (businesses.length === 0) {
      throw new ForbiddenException("You are not assigned to any business");
    }

    return businesses[0];
  }

  private async findAccessibleBusiness(
    userId: string,
    businessId: string,
  ): Promise<AuthBusiness | null> {
    return this.prisma.business.findFirst({
      where: {
        id: businessId,
        deletedAt: null,
        status: {
          in: ACCESSIBLE_BUSINESS_STATUSES,
        },
        OR: [
          {
            ownerUserId: userId,
          },
          {
            members: {
              some: {
                userId,
                status: BusinessMemberStatus.ACTIVE,
                deletedAt: null,
              },
            },
          },
        ],
      },
      select: this.getBusinessSelect(userId),
    });
  }

  private async findAccessibleBusinesses(
    userId: string,
  ): Promise<AuthBusiness[]> {
    return this.prisma.business.findMany({
      where: {
        deletedAt: null,
        status: {
          in: ACCESSIBLE_BUSINESS_STATUSES,
        },
        OR: [
          {
            ownerUserId: userId,
          },
          {
            members: {
              some: {
                userId,
                status: BusinessMemberStatus.ACTIVE,
                deletedAt: null,
              },
            },
          },
        ],
      },
      select: this.getBusinessSelect(userId),
      orderBy: {
        id: "asc",
      },
    });
  }

  private getBusinessSelect(userId: string) {
    return {
      id: true,
      name: true,
      ownerUserId: true,
      members: {
        where: {
          userId,
          status: BusinessMemberStatus.ACTIVE,
          deletedAt: null,
        },
      },
    } as const;
  }

  private assertActiveUser(user: Pick<SystemUser, "status">) {
    if (user.status === SystemUserStatus.SUSPENDED) {
      throw new ForbiddenException(
        "Your account has been suspended. Please contact support or an administrator for help.",
      );
    }

    if (user.status === SystemUserStatus.INACTIVE) {
      throw new ForbiddenException(
        "Your account is inactive. Please complete the required activation steps before signing in.",
      );
    }

    if (user.status !== SystemUserStatus.ACTIVE) {
      throw new ForbiddenException(
        "This user account is not active and cannot access the application yet.",
      );
    }
  }

  private async hashPassword(password: string) {
    return argon2.hash(password, {
      type: argon2.argon2id,
    });
  }

  private async verifyPassword(passwordHash: string, password: string) {
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}
