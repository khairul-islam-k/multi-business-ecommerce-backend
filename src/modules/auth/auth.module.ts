import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { JwtModule, JwtSignOptions } from "@nestjs/jwt";

import { AuthService } from "./auth.service";
import { OtpPolicy } from "./domain/otp.policy";
import { MailModule } from "../mail/mail.module";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { PackageModule } from "../packages/package.module";
import { TokenService } from "./application/token.service";
import { BusinessModule } from "../business/business.module";
import { SessionService } from "./application/session.service";

@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: "jwt",
    }),
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

    BusinessModule,
    PackageModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    OtpPolicy,
    AuthService,
    TokenService,
    SessionService,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
