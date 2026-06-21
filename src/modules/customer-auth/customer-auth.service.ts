import * as argon2 from "argon2";
import { and, desc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";

import {
  customer,
  customerAccount,
  customerEmailVerification,
  CustomerOtpPurpose,
  customerPasswordReset,
  customerSession,
  CustomerStatus,
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

import { isUniqueConstraintError } from "../../common/database/db-error.util";
import {
  normalizeEmail,
  normalizeOptionalText,
} from "../../common/text/normalizers";
import { apiResponse } from "../../common/utils/api-response.util";
import { DatabaseService } from "../../database/database.service";
import { OtpPolicy } from "../auth/domain/otp.policy";
import { MailService } from "../mail/mail.service";
import { WebsiteService } from "../website/website.service";
import { CustomerSessionService } from "./application/customer-session.service";
import { CustomerTokenService } from "./application/customer-token.service";

import type {
  CustomerForgotPasswordDto,
  CustomerLoginDto,
  CustomerRefreshTokenDto,
  CustomerRegisterDto,
  CustomerRequestVerificationDto,
  CustomerResetPasswordDto,
  CustomerVerifyEmailDto,
  CustomerVerifyResetOtpDto,
} from "./dto/customer-auth.dto";
import type { CurrentCustomerPayload } from "./strategies/customer-jwt.strategy";

type PublishedWebsite = Awaited<
  ReturnType<WebsiteService["findPublishedById"]>
>;

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger("CustomerAuth");

  constructor(
    private readonly database: DatabaseService,
    private readonly websites: WebsiteService,
    private readonly sessions: CustomerSessionService,
    private readonly tokens: CustomerTokenService,
    private readonly otpPolicy: OtpPolicy,
    private readonly mail: MailService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async register(websiteId: string, dto: CustomerRegisterDto) {
    const storefront = await this.getPublishedStorefrontOrThrow(websiteId);
    const email = normalizeEmail(dto.email);
    const phone = normalizeOptionalText(dto.phone);
    const passwordHash = await this.hashPassword(dto.password);
    const otp = this.otpPolicy.generateOtp();
    const otpHash = await this.hashPassword(otp);
    const expiresAt = this.otpPolicy.getExpiresAt();

    try {
      const registered = await this.db.transaction(async (tx) => {
        const existingAccount = await tx
          .select({ id: customerAccount.id })
          .from(customerAccount)
          .where(
            and(
              eq(customerAccount.websiteId, storefront.id),
              eq(customerAccount.email, email),
              isNull(customerAccount.deletedAt),
            ),
          )
          .limit(1)
          .then(([row]) => row ?? null);

        if (existingAccount) {
          throw new ConflictException(
            "A customer account already exists for this email",
          );
        }

        const customerRow =
          (await tx
            .select()
            .from(customer)
            .where(
              and(
                eq(customer.businessId, storefront.businessId),
                eq(customer.email, email),
                isNull(customer.deletedAt),
              ),
            )
            .limit(1)
            .then(([row]) => row ?? null)) ??
          (await tx
            .insert(customer)
            .values({
              businessId: storefront.businessId,
              name: dto.name.trim(),
              email,
              phone,
              status: CustomerStatus.ACTIVE,
            })
            .returning()
            .then(([row]) => row));

        if (customerRow.status !== CustomerStatus.ACTIVE) {
          throw new ForbiddenException("Customer is not active");
        }

        const [account] = await tx
          .insert(customerAccount)
          .values({
            customerId: customerRow.id,
            websiteId: storefront.id,
            email,
            passwordHash,
          })
          .returning();

        await tx.insert(customerEmailVerification).values({
          accountId: account.id,
          otpHash,
          purpose: CustomerOtpPurpose.EMAIL_VERIFICATION,
          attemptCount: 0,
          expiresAt,
        });

        return {
          account: this.toSafeAccount(account),
          customer: customerRow,
        };
      });

      void this.mail
        .sendCustomerEmailVerificationOtp(email, otp, storefront.name)
        .catch((error) => {
          this.logger.error(
            `Failed to send customer verification email to ${email}`,
            error,
          );
        });

      return apiResponse(
        registered,
        "Customer registration successful. A verification email has been sent.",
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          "A customer account or contact already exists for this storefront",
        );
      }

      throw error;
    }
  }

  async login(websiteId: string, dto: CustomerLoginDto) {
    const storefront = await this.getPublishedStorefrontOrThrow(websiteId);
    const email = normalizeEmail(dto.email);
    const account = await this.findAccountByEmail(storefront.id, email);

    if (!account) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isPasswordMatched = await this.verifyPassword(
      account.passwordHash,
      dto.password,
    );

    if (!isPasswordMatched) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (!account.emailVerifiedAt) {
      throw new UnauthorizedException(
        "Please verify your email before logging in",
      );
    }

    const customerRow = await this.getActiveCustomerOrThrow(
      storefront.businessId,
      account.customerId,
    );

    const tokens = await this.sessions.issueTokenPair({
      sub: account.id,
      customerId: customerRow.id,
      websiteId: storefront.id,
      businessId: storefront.businessId,
      scope: "storefront",
    });

    return apiResponse(
      {
        ...tokens,
        account: this.toSafeAccount(account),
        customer: customerRow,
      },
      "Customer logged in successfully",
    );
  }

  async refresh(websiteId: string, dto: CustomerRefreshTokenDto) {
    const storefront = await this.getPublishedStorefrontOrThrow(websiteId);
    const session = await this.sessions.findByRefreshToken(dto.refreshToken);

    if (!session) {
      throw new UnauthorizedException("Invalid customer refresh token");
    }

    this.sessions.assertRefreshSessionActive(session);

    if (
      session.websiteId !== storefront.id ||
      session.account.websiteId !== storefront.id ||
      session.customer.businessId !== storefront.businessId
    ) {
      throw new UnauthorizedException("Invalid customer refresh token");
    }

    if (
      session.account.deletedAt ||
      session.customer.deletedAt ||
      session.customer.status !== CustomerStatus.ACTIVE
    ) {
      throw new UnauthorizedException("Customer account is not active");
    }

    const payload = {
      sub: session.account.id,
      customerId: session.customer.id,
      websiteId: storefront.id,
      businessId: storefront.businessId,
      scope: "storefront" as const,
    };
    const accessToken = await this.tokens.generateAccessToken(payload);
    const refreshToken = await this.sessions.rotateRefreshSession({
      sessionId: session.id,
      payload,
      revokedAt: new Date(),
    });

    return apiResponse(
      {
        accessToken,
        refreshToken,
        account: this.toSafeAccount(session.account),
        customer: session.customer,
      },
      "Customer session refreshed successfully",
    );
  }

  async logout(
    dto: CustomerRefreshTokenDto,
    currentCustomer?: CurrentCustomerPayload,
  ) {
    await this.sessions.revokeByRefreshToken(
      dto.refreshToken,
      currentCustomer?.accountId,
    );

    return apiResponse(null, "Customer logged out successfully");
  }

  async me(currentCustomer: CurrentCustomerPayload) {
    const [accountRow, customerRow] = await Promise.all([
      this.db
        .select()
        .from(customerAccount)
        .where(eq(customerAccount.id, currentCustomer.accountId))
        .limit(1)
        .then(([row]) => row ?? null),
      this.getActiveCustomerOrThrow(
        currentCustomer.businessId,
        currentCustomer.customerId,
      ),
    ]);

    if (!accountRow) {
      throw new NotFoundException("Customer account not found");
    }

    return apiResponse({
      account: this.toSafeAccount(accountRow),
      customer: customerRow,
    });
  }

  async requestEmailVerification(
    websiteId: string,
    dto: CustomerRequestVerificationDto,
  ) {
    const storefront = await this.getPublishedStorefrontOrThrow(websiteId);
    const account = await this.findAccountByEmail(
      storefront.id,
      normalizeEmail(dto.email),
    );

    if (!account) {
      throw new NotFoundException("Customer account not found");
    }

    if (account.emailVerifiedAt) {
      return apiResponse(null, "Customer email is already verified");
    }

    const otp = this.otpPolicy.generateOtp();
    const otpHash = await this.hashPassword(otp);
    const expiresAt = this.otpPolicy.getExpiresAt();

    await this.db.insert(customerEmailVerification).values({
      accountId: account.id,
      otpHash,
      purpose: CustomerOtpPurpose.EMAIL_VERIFICATION,
      attemptCount: 0,
      expiresAt,
    });

    void this.mail
      .sendCustomerEmailVerificationOtp(account.email, otp, storefront.name)
      .catch((error) => {
        this.logger.error(
          `Failed to send customer verification email to ${account.email}`,
          error,
        );
      });

    return apiResponse(null, "A verification code has been sent");
  }

  async verifyEmail(websiteId: string, dto: CustomerVerifyEmailDto) {
    const storefront = await this.getPublishedStorefrontOrThrow(websiteId);
    const account = await this.findAccountByEmail(
      storefront.id,
      normalizeEmail(dto.email),
    );

    if (!account) {
      throw new NotFoundException("Customer account not found");
    }

    if (account.emailVerifiedAt) {
      return apiResponse(null, "Customer email is already verified");
    }

    const verification = await this.findLatestActiveVerification(
      account.id,
      CustomerOtpPurpose.EMAIL_VERIFICATION,
    );

    if (!verification) {
      throw new BadRequestException("Verification code is invalid or expired");
    }

    this.otpPolicy.assertCanAttempt(verification.attemptCount);

    const isOtpMatched = await this.verifyPassword(
      verification.otpHash,
      dto.otp,
    );

    if (!isOtpMatched) {
      await this.incrementVerificationAttempts(verification.id);
      throw new BadRequestException("Verification code is incorrect");
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(customerEmailVerification)
        .set({ verifiedAt: new Date() })
        .where(eq(customerEmailVerification.id, verification.id));

      await tx
        .update(customerAccount)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(customerAccount.id, account.id));
    });

    return apiResponse(null, "Customer email verified successfully");
  }

  async forgotPassword(websiteId: string, dto: CustomerForgotPasswordDto) {
    const storefront = await this.getPublishedStorefrontOrThrow(websiteId);
    const account = await this.findAccountByEmail(
      storefront.id,
      normalizeEmail(dto.email),
    );

    if (!account) {
      throw new NotFoundException("Customer account not found");
    }

    const otp = this.otpPolicy.generateOtp();
    const otpHash = await this.hashPassword(otp);
    const expiresAt = this.otpPolicy.getExpiresAt();

    await this.db.insert(customerPasswordReset).values({
      accountId: account.id,
      otpHash,
      attemptCount: 0,
      expiresAt,
    });

    void this.mail
      .sendCustomerForgotPasswordOtp(account.email, otp, storefront.name)
      .catch((error) => {
        this.logger.error(
          `Failed to send customer password reset email to ${account.email}`,
          error,
        );
      });

    return apiResponse(null, "A password reset code has been sent");
  }

  async verifyResetOtp(websiteId: string, dto: CustomerVerifyResetOtpDto) {
    const storefront = await this.getPublishedStorefrontOrThrow(websiteId);
    const account = await this.findAccountByEmail(
      storefront.id,
      normalizeEmail(dto.email),
    );

    if (!account) {
      throw new NotFoundException("Customer account not found");
    }

    const reset = await this.findLatestActivePasswordReset(account.id);

    if (!reset) {
      throw new BadRequestException(
        "Password reset code is invalid or expired",
      );
    }

    this.otpPolicy.assertCanAttempt(reset.attemptCount);

    const isOtpMatched = await this.verifyPassword(reset.otpHash, dto.otp);

    if (!isOtpMatched) {
      await this.incrementPasswordResetAttempts(reset.id);
      throw new BadRequestException("Password reset code is incorrect");
    }

    await this.db
      .update(customerPasswordReset)
      .set({ verifiedAt: new Date() })
      .where(eq(customerPasswordReset.id, reset.id));

    return apiResponse({ resetRequestId: reset.id }, "OTP verified");
  }

  async resetPassword(websiteId: string, dto: CustomerResetPasswordDto) {
    const storefront = await this.getPublishedStorefrontOrThrow(websiteId);
    const account = await this.findAccountByEmail(
      storefront.id,
      normalizeEmail(dto.email),
    );

    if (!account) {
      throw new NotFoundException("Customer account not found");
    }

    const [reset] = await this.db
      .select()
      .from(customerPasswordReset)
      .where(
        and(
          eq(customerPasswordReset.id, dto.resetRequestId),
          eq(customerPasswordReset.accountId, account.id),
          isNull(customerPasswordReset.usedAt),
          isNotNull(customerPasswordReset.verifiedAt),
          gt(customerPasswordReset.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!reset) {
      throw new BadRequestException("Password reset request is invalid");
    }

    const isSamePassword = await this.verifyPassword(
      account.passwordHash,
      dto.password,
    );

    if (isSamePassword) {
      throw new BadRequestException("New password must be different");
    }

    const passwordHash = await this.hashPassword(dto.password);

    await this.db.transaction(async (tx) => {
      await tx
        .update(customerAccount)
        .set({ passwordHash })
        .where(eq(customerAccount.id, account.id));

      await tx
        .update(customerPasswordReset)
        .set({ usedAt: new Date() })
        .where(eq(customerPasswordReset.id, reset.id));

      await tx
        .update(customerSession)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(customerSession.accountId, account.id),
            isNull(customerSession.revokedAt),
          ),
        );
    });

    return apiResponse(null, "Customer password reset successfully");
  }

  private async getPublishedStorefrontOrThrow(websiteId: string) {
    const storefront = await this.websites.findPublishedById(websiteId);

    if (!storefront) {
      throw new NotFoundException("Published storefront not found");
    }

    return storefront as NonNullable<PublishedWebsite>;
  }

  private async findAccountByEmail(websiteId: string, email: string) {
    return this.db
      .select()
      .from(customerAccount)
      .where(
        and(
          eq(customerAccount.websiteId, websiteId),
          eq(customerAccount.email, email),
          isNull(customerAccount.deletedAt),
        ),
      )
      .limit(1)
      .then(([row]) => row ?? null);
  }

  private async getActiveCustomerOrThrow(
    businessId: string,
    customerId: string,
  ) {
    const [customerRow] = await this.db
      .select()
      .from(customer)
      .where(
        and(
          eq(customer.id, customerId),
          eq(customer.businessId, businessId),
          isNull(customer.deletedAt),
        ),
      )
      .limit(1);

    if (!customerRow) {
      throw new NotFoundException("Customer not found");
    }

    if (customerRow.status !== CustomerStatus.ACTIVE) {
      throw new ForbiddenException("Customer is not active");
    }

    return customerRow;
  }

  private async findLatestActiveVerification(
    accountId: string,
    purpose: CustomerOtpPurpose,
  ) {
    return this.db
      .select()
      .from(customerEmailVerification)
      .where(
        and(
          eq(customerEmailVerification.accountId, accountId),
          eq(customerEmailVerification.purpose, purpose),
          isNull(customerEmailVerification.verifiedAt),
          gt(customerEmailVerification.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(customerEmailVerification.createdAt))
      .limit(1)
      .then(([row]) => row ?? null);
  }

  private async findLatestActivePasswordReset(accountId: string) {
    return this.db
      .select()
      .from(customerPasswordReset)
      .where(
        and(
          eq(customerPasswordReset.accountId, accountId),
          isNull(customerPasswordReset.usedAt),
          gt(customerPasswordReset.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(customerPasswordReset.createdAt))
      .limit(1)
      .then(([row]) => row ?? null);
  }

  private incrementVerificationAttempts(verificationId: string) {
    return this.db
      .update(customerEmailVerification)
      .set({
        attemptCount: sql`${customerEmailVerification.attemptCount} + 1`,
      })
      .where(eq(customerEmailVerification.id, verificationId));
  }

  private incrementPasswordResetAttempts(resetId: string) {
    return this.db
      .update(customerPasswordReset)
      .set({
        attemptCount: sql`${customerPasswordReset.attemptCount} + 1`,
      })
      .where(eq(customerPasswordReset.id, resetId));
  }

  private toSafeAccount(account: typeof customerAccount.$inferSelect) {
    const { passwordHash: _, ...safeAccount } = account;

    return safeAccount;
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
