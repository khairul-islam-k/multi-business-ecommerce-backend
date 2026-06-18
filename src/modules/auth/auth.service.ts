import * as argon2 from "argon2";
import {
  and,
  desc,
  eq,
  exists,
  gt,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";

import {
  business,
  businessMember,
  BusinessMemberStatus,
  BusinessStatus,
  OtpPurpose,
  systemEmailVerification,
  systemPasswordReset,
  systemSession,
  SystemUser,
  systemUser,
  SystemUserProfile,
  systemUserProfile,
  SystemUserStatus,
  SystemUserType,
} from "@/database/schema";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import { normalizeEmail } from "../../common/text/normalizers";
import { apiResponse } from "../../common/utils/api-response.util";
import { DatabaseService } from "../../database/database.service";
import { BusinessService } from "../business/business.service";
import { MailService } from "../mail/mail.service";
import { PackageSubscriptionService } from "../packages/package-subscription.service";
import { SessionService } from "./application/session.service";
import { TokenService } from "./application/token.service";
import { OtpPolicy } from "./domain/otp.policy";
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

import type { CurrentUserPayload } from "./decorators/current-user.decorator";

type AuthBusiness = {
  id: string;
  name: string;
  ownerUserId: string;
  members: {
    id: string;
    userId: string;
  }[];
};

type UserWithProfile = SystemUser & {
  profile: SystemUserProfile | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger("Auth");

  constructor(
    private readonly database: DatabaseService,
    private readonly businessService: BusinessService,
    private readonly packageSubscriptionService: PackageSubscriptionService,
    private readonly tokenService: TokenService,
    private readonly otpPolicy: OtpPolicy,
    private readonly mailService: MailService,
    private readonly sessionService: SessionService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async register(dto: RegisterDto) {
    const email = normalizeEmail(dto.email);

    const existingUser = await this.findUserIdByEmail(email);

    if (existingUser) {
      throw new ConflictException(
        "This email address is already linked to an account. Please login or use another email address.",
      );
    }

    const otp = this.otpPolicy.generateOtp();
    const otpHash = await this.hashPassword(otp);
    const passwordHash = await this.hashPassword(dto.password);
    const expiresAt = this.otpPolicy.getExpiresAt();

    const data = await this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(systemUser)
        .values({
          name: dto.name,
          email,
          passwordHash,
          status: SystemUserStatus.INACTIVE,
          type: SystemUserType.TENANT,
          emailVerifiedAt: null,
        })
        .returning();

      await tx.insert(systemUserProfile).values({ userId: user.id });

      await tx.insert(systemEmailVerification).values({
        userId: user.id,
        otpHash,
        purpose: OtpPurpose.EMAIL_VERIFICATION,
        expiresAt,
        attemptCount: 0,
      });

      await this.packageSubscriptionService.assignDefaultTrial(user.id, tx);

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
    const user = await this.findUserByEmail(email, {
      id: true,
      email: true,
      status: true,
      emailVerifiedAt: true,
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

    const verification = await this.findLatestActiveVerification(
      user.id,
      OtpPurpose.EMAIL_VERIFICATION,
    );

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
      await this.incrementEmailVerificationAttempts(verification.id);

      throw new BadRequestException(
        "The one-time password is incorrect. Please check the code and try again.",
      );
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(systemEmailVerification)
        .set({ verifiedAt: new Date() })
        .where(eq(systemEmailVerification.id, verification.id));

      await tx
        .update(systemUser)
        .set({
          emailVerifiedAt: new Date(),
          status: SystemUserStatus.ACTIVE,
        })
        .where(eq(systemUser.id, user.id));
    });

    return apiResponse(
      { success: "true" },
      "Email has been verified successfully.",
    );
  }

  async requestEmailVerification(dto: RequestEmailChangeOrVerificationDto) {
    const email = normalizeEmail(dto.email);
    const user = await this.findUserByEmail(email);

    if (!user) {
      throw new BadRequestException(
        "User with the given email does not exist.",
      );
    }

    const otp = this.otpPolicy.generateOtp();
    const otpHash = await this.hashPassword(otp);
    const expiresAt = this.otpPolicy.getExpiresAt();
    const [verification] = await this.db
      .insert(systemEmailVerification)
      .values({
        userId: user.id,
        otpHash,
        purpose: OtpPurpose.EMAIL_VERIFICATION,
        expiresAt,
        attemptCount: 0,
      })
      .returning({
        id: systemEmailVerification.id,
        expiresAt: systemEmailVerification.expiresAt,
        createdAt: systemEmailVerification.createdAt,
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
    const user = await this.findUserByEmail(normalizedEmail, {
      id: true,
      status: true,
    });

    return apiResponse(
      {
        exists: Boolean(user),
        available: !user,
      },
      user
        ? "This email address is already linked to an account. Please login or use another email address."
        : "This email address is available and can be used for a new account.",
    );
  }

  async login(dto: LoginDto) {
    const email = normalizeEmail(dto.email);
    const user = await this.findUserWithProfileByEmail(email);

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
        "This account has not verified its email address yet. Please verify the email before logging in.",
      );
    }

    this.assertActiveUser(user);

    const { passwordHash: _, ...safeUser } = user;

    if (user.type === SystemUserType.ADMIN) {
      const tokens = await this.sessionService.issueTokenPair({
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
        "You have logged in successfully. Your administrator session is ready to use.",
      );
    }

    const activeSubscription =
      await this.packageSubscriptionService.findCurrentSubscription(
        user.tenantId ?? user.id,
      );

    const businesses = await this.findAccessibleBusinesses(user.id);

    if (businesses.length === 0) {
      throw new ForbiddenException("You are not assigned to any business");
    }

    const selectedBusiness = businesses[0];
    const tokens = await this.sessionService.issueTokenPair({
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
      "You have logged in successfully. Your workspace is ready with the selected business and subscription details.",
    );
  }

  async requestEmailChange(
    userId: string,
    dto: RequestEmailChangeOrVerificationDto,
  ) {
    const newEmail = normalizeEmail(dto.email);
    const user = await this.findActiveUserById(userId, {
      id: true,
      email: true,
    });

    if (!user) {
      throw new BadRequestException(
        "User with the given email does not exist.",
      );
    }

    if (user.email === newEmail) {
      throw new BadRequestException("New email must be different.");
    }

    const existingUser = await this.findOtherUserByEmail(newEmail, userId);

    if (existingUser) {
      throw new ConflictException(
        "This email address is already linked to another account. Please choose a different email address.",
      );
    }

    const otp = this.otpPolicy.generateOtp();
    const otpHash = await this.hashPassword(otp);
    const expiresAt = this.otpPolicy.getExpiresAt();
    const [verification] = await this.db
      .insert(systemEmailVerification)
      .values({
        userId,
        otpHash,
        purpose: OtpPurpose.EMAIL_CHANGE,
        expiresAt,
        attemptCount: 0,
      })
      .returning({
        id: systemEmailVerification.id,
        expiresAt: systemEmailVerification.expiresAt,
        createdAt: systemEmailVerification.createdAt,
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
    const user = await this.findActiveUserById(userId, {
      id: true,
      email: true,
    });

    if (!user) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    if (user.email === newEmail) {
      throw new BadRequestException("New email must be different.");
    }

    const existingUser = await this.findOtherUserByEmail(newEmail, userId);

    if (existingUser) {
      throw new ConflictException(
        "This email address is already linked to another account. Please choose a different email address.",
      );
    }

    const verification = await this.findLatestActiveVerification(
      userId,
      OtpPurpose.EMAIL_CHANGE,
    );

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

    const updatedUser = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(systemUser)
        .set({
          email: newEmail,
          emailVerifiedAt: new Date(),
        })
        .where(eq(systemUser.id, userId))
        .returning();

      await tx
        .update(systemEmailVerification)
        .set({ verifiedAt: new Date() })
        .where(eq(systemEmailVerification.id, verification.id));

      return this.attachProfile(updated);
    });

    return apiResponse(
      this.pickUserWithProfile(updatedUser),
      "Your email address has been updated successfully and is now verified for this account.",
    );
  }

  async requestForgotPasswordOtp(dto: ForgotPasswordDto) {
    const email = normalizeEmail(dto.email);
    const user = await this.findUserByEmail(email, {
      id: true,
      email: true,
      status: true,
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

    await this.db.insert(systemPasswordReset).values({
      userId: user.id,
      otpHash,
      expiresAt,
      attemptCount: 0,
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
    const user = await this.findUserByEmail(email, {
      id: true,
      passwordHash: true,
      status: true,
    });

    if (!user) {
      throw new BadRequestException(
        "User with the given email does not exist.",
      );
    }

    this.assertActiveUser(user);

    const [resetRecord] = await this.db
      .select()
      .from(systemPasswordReset)
      .where(
        and(
          eq(systemPasswordReset.id, dto.resetRequestId),
          eq(systemPasswordReset.userId, user.id),
          isNull(systemPasswordReset.usedAt),
          isNotNull(systemPasswordReset.verifiedAt),
          gt(systemPasswordReset.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(systemPasswordReset.createdAt))
      .limit(1);

    if (!resetRecord) {
      throw new BadRequestException(
        "Password reset request is invalid or has been expired.",
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

    await this.db.transaction(async (tx) => {
      await tx
        .update(systemUser)
        .set({ passwordHash })
        .where(eq(systemUser.id, user.id));

      await tx
        .update(systemPasswordReset)
        .set({ usedAt: new Date() })
        .where(eq(systemPasswordReset.id, resetRecord.id));

      await tx
        .update(systemSession)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(systemSession.userId, user.id),
            isNull(systemSession.revokedAt),
          ),
        );
    });

    return apiResponse(
      { success: true },
      "Your password has been reset successfully.",
    );
  }

  async verifyResetPassword(dto: VerifyResetOtpDto) {
    const email = normalizeEmail(dto.email);
    const user = await this.findUserByEmail(email, {
      id: true,
      status: true,
    });

    if (!user) {
      throw new BadRequestException(
        "User with the given email does not exist.",
      );
    }

    this.assertActiveUser(user);

    const [resetRecord] = await this.db
      .select()
      .from(systemPasswordReset)
      .where(
        and(
          eq(systemPasswordReset.userId, user.id),
          isNull(systemPasswordReset.usedAt),
          gt(systemPasswordReset.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(systemPasswordReset.createdAt))
      .limit(1);

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
      await this.db
        .update(systemPasswordReset)
        .set({ attemptCount: sql`${systemPasswordReset.attemptCount} + 1` })
        .where(eq(systemPasswordReset.id, resetRecord.id));

      throw new BadRequestException(
        "The one-time password is incorrect. Please check the code and try again.",
      );
    }

    const [verifiedReset] = await this.db
      .update(systemPasswordReset)
      .set({ verifiedAt: new Date() })
      .where(eq(systemPasswordReset.id, resetRecord.id))
      .returning({ id: systemPasswordReset.id });

    return apiResponse(
      {
        resetRequestId: verifiedReset.id,
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

    const existingUser = await this.findUserById(user.id, {
      id: true,
      passwordHash: true,
      status: true,
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
    const [updatedUser] = await this.db
      .update(systemUser)
      .set({ passwordHash: newPasswordHash })
      .where(eq(systemUser.id, existingUser.id))
      .returning();
    const { passwordHash: _, ...safeUser } = updatedUser;

    return apiResponse(
      safeUser,
      "Your password has been changed successfully. Please use the new password the next time you login.",
    );
  }

  async refresh(dto: RefreshTokenDto) {
    const now = new Date();
    const session = await this.sessionService.findByRefreshToken(
      dto.refreshToken,
    );

    if (!session) {
      throw new UnauthorizedException(
        "This session could not be refreshed. Please login again.",
      );
    }

    if (session.revokedAt) {
      await this.sessionService.revokeAllUserSessions(session.userId);

      throw new UnauthorizedException(
        "This session token was already used. For your safety, all sessions have been logged out. Please  login again.",
      );
    }

    if (session.expiresAt <= now) {
      await this.sessionService.revokeSession(session.id, now);

      throw new UnauthorizedException(
        "This session has expired. Please login again to continue.",
      );
    }

    const user = session.user;

    this.assertActiveUser(user);
    await this.packageSubscriptionService.assertTenantSubscriptionActive(user);

    const requestedBusinessId = dto.businessId ?? session.businessId;
    const selectedBusiness = await this.resolveSelectedBusiness(
      user.id,
      user.type,
      requestedBusinessId,
    );
    const tokenBusinessId = selectedBusiness?.id ?? null;
    const accessToken = await this.tokenService.generateAccessToken({
      sub: user.id,
      type: user.type,
      businessId: tokenBusinessId,
    });
    const newRefreshToken = await this.sessionService.rotateRefreshSession({
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
      "Your session has been refreshed successfully. You can continue using the app without logging in again.",
    );
  }

  async selectBusiness(userId: string, dto: SelectBusinessDto) {
    const user = await this.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException("Invalid authenticated user");
    }

    this.assertActiveUser(user);
    await this.packageSubscriptionService.assertTenantSubscriptionActive(user);

    const business = await this.findAccessibleBusiness(userId, dto.businessId);

    if (!business) {
      throw new ForbiddenException("You do not have access to this business");
    }

    const accessToken = await this.tokenService.generateAccessToken({
      sub: user.id,
      type: user.type,
      businessId: business.id,
    });

    await this.sessionService.bindRefreshSessionToBusiness(
      user.id,
      dto.refreshToken,
      business.id,
    );

    const { passwordHash: _, ...safeUser } = user;

    return apiResponse(
      {
        accessToken,
        selectedBusiness: business,
        user: safeUser,
      },
      "The selected business is now active for your session. Future requests will use this business context.",
    );
  }

  async getUser(currentUserPayload: CurrentUserPayload) {
    const user = await this.findUserWithProfileById(currentUserPayload.id);

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
      await this.packageSubscriptionService.findCurrentSubscription(
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
    const user = await this.findActiveUserWithProfileById(userId);

    if (!user) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    if (dto.phone) {
      const [phoneExists] = await this.db
        .select({ id: systemUser.id })
        .from(systemUser)
        .where(
          and(
            eq(systemUser.phone, dto.phone),
            isNull(systemUser.deletedAt),
            ne(systemUser.id, userId),
          ),
        )
        .limit(1);

      if (phoneExists) {
        throw new ConflictException(
          "This phone number is already linked to another account. Please use a different phone number.",
        );
      }
    }

    const updatedUser = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(systemUser)
        .set({
          name: dto.name,
          phone: dto.phone,
        })
        .where(eq(systemUser.id, userId))
        .returning();

      if (dto.profile) {
        if (!user.profile) {
          throw new NotFoundException("User profile not found");
        }

        await tx
          .update(systemUserProfile)
          .set({
            ...dto.profile,
            dateOfBirth: dto.profile.dateOfBirth
              ? new Date(dto.profile.dateOfBirth)
              : undefined,
          })
          .where(eq(systemUserProfile.userId, userId));
      }

      return this.attachProfile(updated);
    });

    return apiResponse(
      this.pickUserWithProfile(updatedUser),
      "Your profile has been updated successfully. The latest saved profile information is included in this response.",
    );
  }

  async logout(dto: LogoutDto, userId?: string) {
    await this.sessionService.revokeByRefreshToken(dto.refreshToken, userId);

    return apiResponse(
      null,
      "You have been logged out from this session successfully.",
    );
  }

  async logoutAll(userId: string) {
    await this.sessionService.revokeAllUserSessions(userId);

    return apiResponse(
      null,
      "You have been logged out from all devices successfully. Any device will need to login again before using the account.",
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
    const [item] = await this.db
      .select({
        id: business.id,
        name: business.name,
        ownerUserId: business.ownerUserId,
      })
      .from(business)
      .where(
        and(
          eq(business.id, businessId),
          this.accessibleBusinessCondition(userId),
        ),
      )
      .limit(1);

    return item ? this.attachBusinessMembers(userId, item) : null;
  }

  private async findAccessibleBusinesses(
    userId: string,
  ): Promise<AuthBusiness[]> {
    const items = await this.db
      .select({
        id: business.id,
        name: business.name,
        ownerUserId: business.ownerUserId,
      })
      .from(business)
      .where(this.accessibleBusinessCondition(userId))
      .orderBy(business.id);

    return Promise.all(
      items.map((item) => this.attachBusinessMembers(userId, item)),
    );
  }

  private accessibleBusinessCondition(userId: string) {
    return and(
      isNull(business.deletedAt),
      eq(business.status, BusinessStatus.ACTIVE),
      or(
        eq(business.ownerUserId, userId),
        exists(
          this.db
            .select({ id: businessMember.id })
            .from(businessMember)
            .where(
              and(
                eq(businessMember.businessId, business.id),
                eq(businessMember.userId, userId),
                eq(businessMember.status, BusinessMemberStatus.ACTIVE),
                isNull(businessMember.deletedAt),
              ),
            ),
        ),
      ),
    );
  }

  private async attachBusinessMembers(
    userId: string,
    item: Pick<AuthBusiness, "id" | "name" | "ownerUserId">,
  ): Promise<AuthBusiness> {
    const members = await this.db
      .select({
        id: businessMember.id,
        userId: businessMember.userId,
      })
      .from(businessMember)
      .where(
        and(
          eq(businessMember.businessId, item.id),
          eq(businessMember.userId, userId),
          eq(businessMember.status, BusinessMemberStatus.ACTIVE),
          isNull(businessMember.deletedAt),
        ),
      );

    return {
      ...item,
      members,
    };
  }

  private async findUserIdByEmail(email: string) {
    return this.db
      .select({ id: systemUser.id })
      .from(systemUser)
      .where(eq(systemUser.email, email))
      .limit(1)
      .then(([user]) => user ?? null);
  }

  private async findUserByEmail<
    T extends Partial<Record<keyof SystemUser, true>>,
  >(email: string, _select?: T) {
    return this.db
      .select()
      .from(systemUser)
      .where(eq(systemUser.email, email))
      .limit(1)
      .then(([user]) => user ?? null);
  }

  private async findUserById<T extends Partial<Record<keyof SystemUser, true>>>(
    userId: string,
    _select?: T,
  ) {
    return this.db
      .select()
      .from(systemUser)
      .where(eq(systemUser.id, userId))
      .limit(1)
      .then(([user]) => user ?? null);
  }

  private async findActiveUserById<
    T extends Partial<Record<keyof SystemUser, true>>,
  >(userId: string, _select?: T) {
    return this.db
      .select()
      .from(systemUser)
      .where(and(eq(systemUser.id, userId), isNull(systemUser.deletedAt)))
      .limit(1)
      .then(([user]) => user ?? null);
  }

  private async findOtherUserByEmail(email: string, userId: string) {
    return this.db
      .select({ id: systemUser.id })
      .from(systemUser)
      .where(and(eq(systemUser.email, email), ne(systemUser.id, userId)))
      .limit(1)
      .then(([user]) => user ?? null);
  }

  private async findUserWithProfileByEmail(email: string) {
    const user = await this.findUserByEmail(email);

    return user ? this.attachProfile(user) : null;
  }

  private async findUserWithProfileById(userId: string) {
    const user = await this.findUserById(userId);

    return user ? this.attachProfile(user) : null;
  }

  private async findActiveUserWithProfileById(userId: string) {
    const user = await this.findActiveUserById(userId);

    return user ? this.attachProfile(user) : null;
  }

  private async attachProfile(user: SystemUser): Promise<UserWithProfile> {
    const [profile] = await this.db
      .select()
      .from(systemUserProfile)
      .where(eq(systemUserProfile.userId, user.id))
      .limit(1);

    return {
      ...user,
      profile: profile ?? null,
    };
  }

  private pickUserWithProfile(user: UserWithProfile) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      type: user.type,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      profile: user.profile,
    };
  }

  private async findLatestActiveVerification(
    userId: string,
    purpose: OtpPurpose,
  ) {
    return this.db
      .select()
      .from(systemEmailVerification)
      .where(
        and(
          eq(systemEmailVerification.userId, userId),
          eq(systemEmailVerification.purpose, purpose),
          isNull(systemEmailVerification.verifiedAt),
          gt(systemEmailVerification.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(systemEmailVerification.createdAt))
      .limit(1)
      .then(([verification]) => verification ?? null);
  }

  private incrementEmailVerificationAttempts(verificationId: string) {
    return this.db
      .update(systemEmailVerification)
      .set({
        attemptCount: sql`${systemEmailVerification.attemptCount} + 1`,
      })
      .where(eq(systemEmailVerification.id, verificationId));
  }

  private assertActiveUser(user: Pick<SystemUser, "status">) {
    if (user.status === SystemUserStatus.SUSPENDED) {
      throw new ForbiddenException(
        "Your account has been suspended. Please contact support or an administrator for help.",
      );
    }

    if (user.status === SystemUserStatus.INACTIVE) {
      throw new ForbiddenException(
        "Your account is inactive. Please complete the required activation steps before logging in.",
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
