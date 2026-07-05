import * as argon2 from "argon2";
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";

import {
  customer,
  customerAccount,
  customerEmailVerification,
  CustomerOtpPurpose,
  customerPasswordReset,
  customerSession,
  CustomerStatus,
  website,
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

  async register(host: string | undefined, dto: CustomerRegisterDto) {
    const storefront = await this.getPublishedStorefrontOrThrow(host);
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
          throw new ForbiddenException(
            "Customer is not active. This customer profile cannot use the requested operation until it is restored to active status.",
          );
        }

        const staleCustomerAccounts = await tx
          .select({
            id: customerAccount.id,
          })
          .from(customerAccount)
          .innerJoin(website, eq(website.id, customerAccount.websiteId))
          .where(
            and(
              eq(customerAccount.customerId, customerRow.id),
              isNotNull(website.deletedAt),
              isNull(customerAccount.deletedAt),
            ),
          );

        if (staleCustomerAccounts.length > 0) {
          await tx
            .update(customerAccount)
            .set({ deletedAt: new Date() })
            .where(
              inArray(
                customerAccount.id,
                staleCustomerAccounts.map((account) => account.id),
              ),
            );
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

  async login(host: string | undefined, dto: CustomerLoginDto) {
    const storefront = await this.getPublishedStorefrontOrThrow(host);
    const email = normalizeEmail(dto.email);
    const account = await this.findAccountByEmail(storefront.id, email);

    if (!account) {
      throw new UnauthorizedException(
        "The email address or password is incorrect. Please check the credentials and try again. For security, this response does not reveal which field was wrong.",
      );
    }

    const isPasswordMatched = await this.verifyPassword(
      account.passwordHash,
      dto.password,
    );

    if (!isPasswordMatched) {
      throw new UnauthorizedException(
        "The email address or password is incorrect. Please check the credentials and try again. For security, this response does not reveal which field was wrong.",
      );
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
      "Customer logged in successfully. The response includes access and refresh tokens plus the customer profile needed for authenticated storefront requests.",
    );
  }

  async refresh(host: string | undefined, dto: CustomerRefreshTokenDto) {
    const storefront = await this.getPublishedStorefrontOrThrow(host);
    const session = await this.sessions.findByRefreshToken(dto.refreshToken);

    if (!session) {
      throw new UnauthorizedException(
        "The customer refresh token is missing, expired, malformed, revoked, or does not belong to this storefront session. Please sign in again to continue.",
      );
    }

    this.sessions.assertRefreshSessionActive(session);

    if (
      session.websiteId !== storefront.id ||
      session.account.websiteId !== storefront.id ||
      session.customer.businessId !== storefront.businessId
    ) {
      throw new UnauthorizedException(
        "The customer refresh token is missing, expired, malformed, revoked, or does not belong to this storefront session. Please sign in again to continue.",
      );
    }

    if (
      session.account.deletedAt ||
      session.customer.deletedAt ||
      session.customer.status !== CustomerStatus.ACTIVE
    ) {
      throw new UnauthorizedException(
        "Customer account is not active. The account may be unverified, blocked, deleted, or unavailable for this storefront.",
      );
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

    return apiResponse(
      null,
      "Customer logged out successfully. The submitted refresh token has been revoked and can no longer be used for this storefront session.",
    );
  }

  async me(currentCustomer: CurrentCustomerPayload, host?: string) {
    const storefront = await this.getPublishedStorefrontOrThrow(host);

    if (currentCustomer.websiteId !== storefront.id) {
      throw new ForbiddenException("Customer cannot access this storefront");
    }

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
      throw new NotFoundException(
        "Customer account could not be found for this storefront. Confirm the email address and storefront host, then try again.",
      );
    }

    return apiResponse({
      account: this.toSafeAccount(accountRow),
      customer: customerRow,
    });
  }

  async requestEmailVerification(
    host: string | undefined,
    dto: CustomerRequestVerificationDto,
  ) {
    const storefront = await this.getPublishedStorefrontOrThrow(host);
    const account = await this.findAccountByEmail(
      storefront.id,
      normalizeEmail(dto.email),
    );

    if (!account) {
      throw new NotFoundException(
        "Customer account could not be found for this storefront. Confirm the email address and storefront host, then try again.",
      );
    }

    if (account.emailVerifiedAt) {
      return apiResponse(
        null,
        "Customer email is already verified. No additional verification step is required for this storefront account.",
      );
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

    return apiResponse(
      null,
      "A verification code has been sent to the customer email address. Use the newest code before it expires to complete email verification.",
    );
  }

  async verifyEmail(host: string | undefined, dto: CustomerVerifyEmailDto) {
    const storefront = await this.getPublishedStorefrontOrThrow(host);
    const account = await this.findAccountByEmail(
      storefront.id,
      normalizeEmail(dto.email),
    );

    if (!account) {
      throw new NotFoundException(
        "Customer account could not be found for this storefront. Confirm the email address and storefront host, then try again.",
      );
    }

    if (account.emailVerifiedAt) {
      return apiResponse(
        null,
        "Customer email is already verified. No additional verification step is required for this storefront account.",
      );
    }

    const verification = await this.findLatestActiveVerification(
      account.id,
      CustomerOtpPurpose.EMAIL_VERIFICATION,
    );

    if (!verification) {
      throw new BadRequestException(
        "Verification code is invalid or expired. Request a new verification code and use the latest code before it expires.",
      );
    }

    this.otpPolicy.assertCanAttempt(verification.attemptCount);

    const isOtpMatched = await this.verifyPassword(
      verification.otpHash,
      dto.otp,
    );

    if (!isOtpMatched) {
      await this.incrementVerificationAttempts(verification.id);
      throw new BadRequestException(
        "Verification code is incorrect. Check the latest code sent to the email address and try again before it expires.",
      );
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

    return apiResponse(
      null,
      "Customer email was verified successfully. The storefront account can now use login and authenticated customer features.",
    );
  }

  async forgotPassword(
    host: string | undefined,
    dto: CustomerForgotPasswordDto,
  ) {
    const storefront = await this.getPublishedStorefrontOrThrow(host);
    const account = await this.findAccountByEmail(
      storefront.id,
      normalizeEmail(dto.email),
    );

    if (!account) {
      throw new NotFoundException(
        "Customer account could not be found for this storefront. Confirm the email address and storefront host, then try again.",
      );
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

    return apiResponse(
      null,
      "A password reset code has been sent to the customer email address. Use the newest code before it expires to continue resetting the password.",
    );
  }

  async verifyResetOtp(
    host: string | undefined,
    dto: CustomerVerifyResetOtpDto,
  ) {
    const storefront = await this.getPublishedStorefrontOrThrow(host);
    const account = await this.findAccountByEmail(
      storefront.id,
      normalizeEmail(dto.email),
    );

    if (!account) {
      throw new NotFoundException(
        "Customer account could not be found for this storefront. Confirm the email address and storefront host, then try again.",
      );
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
      throw new BadRequestException(
        "Password reset code is incorrect. Check the latest password reset code sent to the email address and try again before it expires.",
      );
    }

    await this.db
      .update(customerPasswordReset)
      .set({ verifiedAt: new Date() })
      .where(eq(customerPasswordReset.id, reset.id));

    return apiResponse(
      { resetRequestId: reset.id },
      "The one-time password was verified successfully. Use the returned reset request ID to complete the next step of this flow.",
    );
  }

  async resetPassword(host: string | undefined, dto: CustomerResetPasswordDto) {
    const storefront = await this.getPublishedStorefrontOrThrow(host);
    const account = await this.findAccountByEmail(
      storefront.id,
      normalizeEmail(dto.email),
    );

    if (!account) {
      throw new NotFoundException(
        "Customer account could not be found for this storefront. Confirm the email address and storefront host, then try again.",
      );
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
      throw new BadRequestException(
        "Password reset request is invalid. Verify the reset code again or request a new password reset code before setting a new password.",
      );
    }

    const isSamePassword = await this.verifyPassword(
      account.passwordHash,
      dto.password,
    );

    if (isSamePassword) {
      throw new BadRequestException(
        "New password must be different from the current password. Choose a password that has not just been used for this account.",
      );
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

    return apiResponse(
      null,
      "Customer password was reset successfully. Existing customer sessions were revoked, so the customer must sign in again with the new password.",
    );
  }

  private async getPublishedStorefrontOrThrow(host?: string) {
    return this.websites.findPublishedByHostOrThrow(host);
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
      throw new NotFoundException(
        "Customer could not be found. It may not exist, may have been deleted, or may not belong to the current business or storefront.",
      );
    }

    if (customerRow.status !== CustomerStatus.ACTIVE) {
      throw new ForbiddenException(
        "Customer is not active. This customer profile cannot use the requested operation until it is restored to active status.",
      );
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
    const { passwordHash, ...safeAccount } = account;
    void passwordHash;

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
