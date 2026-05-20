import * as argon2 from "argon2";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes, randomInt } from "node:crypto";
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

import { LoginDto } from "./dto/login.dto";
import { LogoutDto } from "./dto/logout.dto";
import { RegisterDto } from "./dto/register.dto";
import { MailService } from "../mail/mail.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { JwtPayload } from "./strategies/jwt.strategy";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { SelectBusinessDto } from "./dto/select-business.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { BusinessService } from "../business/business.service";
import { VerifyResetOtpDto } from "./dto/verify-reset-email.dto";
import { apiResponse } from "../../common/utils/api-response.util";
import { VerifyChangeEmailDto } from "./dto/verify-email-change.dto";
import { ResetForgotPasswordDto } from "./dto/reset-forgot-password.dto";
import type { CurrentUserPayload } from "./decorators/current-user.decorator";
import { PackageSubscriptionService } from "../packages/package-subscription.service";
import { RequestEmailChangeOrVerificationDto } from "./dto/request-email-change-or-verification.dto";

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
  private readonly otpMaxAttempt: number;
  private readonly optExpiresIn: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly businessService: BusinessService,
    private readonly packageSubscriptions: PackageSubscriptionService,
    private readonly mailService: MailService,
  ) {
    this.otpMaxAttempt = configService.getOrThrow<number>("OTP_MAX_ATTEMPT");
    this.optExpiresIn = this.configService.getOrThrow<number>(
      "OTP_EXPIRES_IN_MINS",
    );
  }

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);

    const existingUser = await this.prisma.systemUser.findUnique({
      where: { email },
      select: {
        id: true,
        status: true,
        ownedBusinesses: {
          select: {
            id: true,
          },
        },
      },
    });

    if (existingUser) {
      throw new ConflictException("Email already exists.");
    }

    const otp = this.generateOtp();
    const otpHash = await this.hashPassword(otp);
    const passwordHash = await this.hashPassword(dto.password);
    const expiresAt = this.getOtpExpiresAt();

    const data = await this.prisma.$transaction(async (tx) => {
      const user = await tx.systemUser.create({
        data: {
          name: dto.name,
          email,
          passwordHash,
          status: SystemUserStatus.INACTIVE,
          type: SystemUserType.TENANT,
          emailVerifiedAt: null,
          profile: { create: {} },
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
          user.type,
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
    const email = this.normalizeEmail(dto.email);

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
      return apiResponse(null, "Email is already verified.");
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
      throw new BadRequestException("OTP is invalid or has been expired.");
    }

    if (verification.attemptCount >= this.otpMaxAttempt) {
      throw new BadRequestException(
        "Too many attempts. Please request a new OTP",
      );
    }

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

      throw new BadRequestException("Invalid OTP.");
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
    const email = this.normalizeEmail(dto.email);

    const user = await this.prisma.systemUser.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException(
        "User with the given email does not exist.",
      );
    }

    const otp = this.generateOtp();
    const otpHash = await this.hashPassword(otp);
    const expiresAt = this.getOtpExpiresAt();

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
      "A new OTP has been sent to email address.",
    );
  }

  async validateEmail(email: string) {
    const normalizedEmail = this.normalizeEmail(email);

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
      user ? "Email already exists." : "Email is available.",
    );
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);

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
      throw new UnauthorizedException("Invalid email or password.");
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException(
        "Unverified account. Verify your account to access.",
      );
    }

    this.assertActiveUser(user);

    const { passwordHash, ...safeUser } = user;

    if (user.type === SystemUserType.ADMIN) {
      const tokens = await this.issueTokenPair({
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
        "Authenticated.",
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

    const tokens = await this.issueTokenPair({
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
      "Authenticated.",
    );
  }

  async requestEmailChange(
    userId: string,
    dto: RequestEmailChangeOrVerificationDto,
  ) {
    const newEmail = this.normalizeEmail(dto.email);

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
      throw new ConflictException("Email already exists.");
    }

    const otp = this.generateOtp();
    const otpHash = await this.hashPassword(otp);
    const expiresAt = this.getOtpExpiresAt();

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
      "An OPT has been sent to your email address.",
    );
  }

  async verifyEmailChange(userId: string, dto: VerifyChangeEmailDto) {
    const newEmail = this.normalizeEmail(dto.email);

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
      throw new ConflictException("Email already exists.");
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
      throw new BadRequestException("OTP is invalid or has been expired.");
    }

    const isOtpValid = await this.verifyPassword(verification.otpHash, dto.otp);

    if (!isOtpValid) {
      throw new BadRequestException("Invalid OTP.");
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

    return apiResponse(updatedUser, "Email has been updated.");
  }

  async requestForgotPasswordOtp(dto: ForgotPasswordDto) {
    const email = this.normalizeEmail(dto.email);

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

    const otp = this.generateOtp();
    const otpHash = await this.hashPassword(otp);
    const expiresAt = this.getOtpExpiresAt();

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
      "An OPT has been sent to your email.",
    );
  }

  async resetForgotPassword(dto: ResetForgotPasswordDto) {
    const email = this.normalizeEmail(dto.email);

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
      throw new BadRequestException("OTP is invalid or has been expired.");
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
    const email = this.normalizeEmail(dto.email);

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
      throw new BadRequestException("OTP is invalid or has been expired.");
    }

    if (resetRecord.attemptCount >= this.otpMaxAttempt) {
      throw new BadRequestException(
        "Too many attempts. Please request a new OTP.",
      );
    }

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

      throw new BadRequestException("Invalid OTP.");
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

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.optExpiresIn);

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

    return apiResponse(updatedUser, "Password has been reset successfully.");
  }

  async refresh(dto: RefreshTokenDto) {
    const now = new Date();
    const refreshTokenHash = this.hashRefreshToken(dto.refreshToken);

    const session = await this.prisma.systemSession.findUnique({
      where: {
        refreshTokenHash,
      },
      include: {
        user: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (session.revokedAt) {
      await this.revokeAllUserSessions(session.userId);

      throw new UnauthorizedException("Refresh token reuse detected");
    }

    if (session.expiresAt <= now) {
      await this.prisma.systemSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      throw new UnauthorizedException("Refresh token has expired");
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

    const accessToken = await this.generateAccessToken({
      sub: user.id,
      type: user.type,
      businessId: tokenBusinessId,
    });

    const newRefreshToken = this.generateRefreshToken();
    const newRefreshTokenHash = this.hashRefreshToken(newRefreshToken);
    const newRefreshTokenExpiresAt = this.getRefreshTokenExpiresAt();

    await this.prisma.$transaction(async (tx) => {
      const revokedSession = await tx.systemSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      if (revokedSession.count !== 1) {
        throw new UnauthorizedException("Refresh token has already been used");
      }

      await tx.systemSession.create({
        data: {
          userId: user.id,
          businessId: tokenBusinessId,
          refreshTokenHash: newRefreshTokenHash,
          expiresAt: newRefreshTokenExpiresAt,
        },
      });
    });

    const { passwordHash, ...safeUser } = user;

    return apiResponse({
      accessToken,
      refreshToken: newRefreshToken,
      selectedBusiness,
      user: safeUser,
    });
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

    const accessToken = await this.generateAccessToken({
      sub: user.id,
      type: user.type,
      businessId: business.id,
    });

    await this.bindRefreshSessionToBusiness(
      user.id,
      dto.refreshToken,
      business.id,
    );

    return apiResponse({
      accessToken,
      selectedBusiness: business,
      user,
    });
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

    const { passwordHash, ...safeUser } = user;

    if (user.type === SystemUserType.ADMIN) {
      return apiResponse({
        user: safeUser,
        activeSubscription: null,
        selectedBusiness: null,
        businesses: [],
      });
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

    return apiResponse({
      user: safeUser,
      activeSubscription,
      selectedBusiness,
      businesses,
    });
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
        throw new ConflictException("Phone already exists.");
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

    return apiResponse(updatedUser, "Profile has been updated successfully.");
  }

  async logout(dto: LogoutDto, userId?: string) {
    const refreshTokenHash = this.hashRefreshToken(dto.refreshToken);

    await this.prisma.systemSession.updateMany({
      where: {
        refreshTokenHash,
        revokedAt: null,
        ...(userId !== undefined ? { userId } : {}),
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return apiResponse(null, "Logged out successfully");
  }

  async logoutAll(userId: string) {
    await this.revokeAllUserSessions(userId);

    return apiResponse(null, "Logged out from all devices successfully");
  }

  private generateOtp() {
    return String(randomInt(100000, 1000000));
  }

  private getOtpExpiresAt() {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.optExpiresIn);

    return expiresAt;
  }

  private async issueTokenPair(payload: JwtPayload) {
    const accessToken = await this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken();

    await this.prisma.systemSession.create({
      data: {
        userId: payload.sub,
        businessId: payload.businessId ?? null,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: this.getRefreshTokenExpiresAt(),
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async generateAccessToken(payload: JwtPayload) {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  private generateRefreshToken() {
    return randomBytes(64).toString("hex");
  }

  private hashRefreshToken(refreshToken: string) {
    return createHash("sha256").update(refreshToken).digest("hex");
  }

  private getRefreshTokenExpiresAt() {
    const rawDays = this.configService.getOrThrow<string>(
      "JWT_REFRESH_EXPIRES_IN_DAYS",
    );

    const days = Number(rawDays);

    if (!Number.isInteger(days) || days <= 0) {
      throw new Error("JWT_REFRESH_EXPIRES_IN_DAYS must be a positive integer");
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    return expiresAt;
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

  private async bindRefreshSessionToBusiness(
    userId: string,
    refreshToken: string,
    businessId: string,
  ) {
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    const result = await this.prisma.systemSession.updateMany({
      where: {
        userId,
        refreshTokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        businessId,
      },
    });

    if (result.count !== 1) {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  private async revokeAllUserSessions(userId: string) {
    await this.prisma.systemSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
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
      throw new ForbiddenException("Your account has been suspended");
    }

    if (user.status === SystemUserStatus.INACTIVE) {
      throw new ForbiddenException("Your account is inactive");
    }

    if (user.status !== SystemUserStatus.ACTIVE) {
      throw new ForbiddenException("User account is not active");
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
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
