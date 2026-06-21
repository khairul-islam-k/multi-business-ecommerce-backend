import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule, JwtSignOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { OtpPolicy } from "../auth/domain/otp.policy";
import { MailModule } from "../mail/mail.module";
import { WebsiteModule } from "../website/website.module";
import { CustomerSessionService } from "./application/customer-session.service";
import { CustomerTokenService } from "./application/customer-token.service";
import { CustomerAuthController } from "./customer-auth.controller";
import { CustomerAuthService } from "./customer-auth.service";
import { CustomerJwtStrategy } from "./strategies/customer-jwt.strategy";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.getOrThrow<string>("JWT_ACCESS_SECRET");
        const expiresIn = configService.getOrThrow<string>(
          "JWT_ACCESS_EXPIRES_IN",
        );

        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as JwtSignOptions["expiresIn"],
          },
        };
      },
    }),
    WebsiteModule,
    MailModule,
  ],
  controllers: [CustomerAuthController],
  providers: [
    CustomerJwtStrategy,
    OtpPolicy,
    CustomerTokenService,
    CustomerSessionService,
    CustomerAuthService,
  ],
  exports: [CustomerAuthService],
})
export class CustomerAuthModule {}
