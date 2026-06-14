import { Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

import { AppConfigService } from "../../common/config/app-config.service";

type OtpEmailOptions = {
  to: string;
  subject: string;
  title: string;
  description: string;
  otp: string;
};

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly appName: string;
  private readonly optExpiresIn: number;

  constructor(appConfig: AppConfigService) {
    const mail = appConfig.mail;

    this.from = mail.from;
    this.appName = appConfig.appName;
    this.optExpiresIn = appConfig.otp.expiresInMinutes;

    this.transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: false,
      auth: {
        user: mail.user,
        pass: mail.pass,
      },
    });
  }

  async sendForgotPasswordOtpEmail(to: string, otp: string) {
    await this.sendOtpEmail({
      to,
      otp,
      subject: "Reset your password",
      title: "Reset your password",
      description:
        "Use the verification code below to reset your account password.",
    });
  }

  async sendChangeEmailOtpEmail(to: string, otp: string) {
    await this.sendOtpEmail({
      to,
      otp,
      subject: "Confirm your new email",
      title: "Confirm your new email",
      description:
        "Use the verification code below to confirm your new email address.",
    });
  }

  async sendEmailVerificationOtp(to: string, otp: string) {
    await this.sendOtpEmail({
      to,
      otp,
      subject: "Verify your email",
      title: "Verify your email",
      description:
        "Use the verification code below to complete your account registration.",
    });
  }

  private async sendOtpEmail(options: OtpEmailOptions) {
    await this.transporter.sendMail({
      from: this.from,
      to: options.to,
      subject: options.subject,
      text: `${options.title}

${options.description}

Your verification code is: ${options.otp}

This code will expire in ${this.optExpiresIn} minutes.

If you did not request this, you can safely ignore this email.`,
      html: this.buildOtpEmailHtml({
        ...options,
      }),
    });
  }

  private buildOtpEmailHtml(options: Required<Omit<OtpEmailOptions, "to">>) {
    const safeTitle = this.escapeHtml(options.title);
    const safeDescription = this.escapeHtml(options.description);
    const safeOtp = this.escapeHtml(options.otp);
    const safeAppName = this.escapeHtml(this.appName);

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${safeTitle}</title>
        </head>

        <body style="margin:0; padding:0; background-color:#f4f7fb; font-family:Arial, Helvetica, sans-serif; color:#111827;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f4f7fb; padding:32px 16px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px; background-color:#ffffff; border-radius:18px; overflow:hidden; border:1px solid #e5e7eb;">
                  
                  <tr>
                    <td style="padding:28px 32px; background-color:#111827;">
                      <h1 style="margin:0; font-size:22px; line-height:1.3; color:#ffffff; font-weight:700;">
                        ${safeAppName}
                      </h1>
                      <p style="margin:6px 0 0; font-size:14px; color:#d1d5db;">
                        Secure account verification
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:36px 32px 16px;">
                      <h2 style="margin:0 0 12px; font-size:24px; line-height:1.35; color:#111827; font-weight:700;">
                        ${safeTitle}
                      </h2>

                      <p style="margin:0; font-size:15px; line-height:1.7; color:#4b5563;">
                        ${safeDescription}
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:20px 32px;">
                      <div style="background-color:#f9fafb; border:1px dashed #cbd5e1; border-radius:14px; padding:24px; text-align:center;">
                        <p style="margin:0 0 10px; font-size:13px; line-height:1.4; color:#6b7280; text-transform:uppercase; letter-spacing:0.08em; font-weight:700;">
                          Verification Code
                        </p>

                        <div style="font-size:36px; line-height:1.2; color:#111827; font-weight:800; letter-spacing:10px;">
                          ${safeOtp}
                        </div>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:4px 32px 32px;">
                      <p style="margin:0; font-size:14px; line-height:1.7; color:#4b5563;">
                        This code will expire in 
                        <strong style="color:#111827;">${this.optExpiresIn} minutes</strong>.
                      </p>

                      <p style="margin:16px 0 0; font-size:14px; line-height:1.7; color:#6b7280;">
                        If you did not request this code, you can safely ignore this email. Please do not share this code with anyone.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:20px 32px; background-color:#f9fafb; border-top:1px solid #e5e7eb;">
                      <p style="margin:0; font-size:12px; line-height:1.6; color:#9ca3af; text-align:center;">
                        © ${new Date().getFullYear()} ${safeAppName}. All rights reserved.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}
