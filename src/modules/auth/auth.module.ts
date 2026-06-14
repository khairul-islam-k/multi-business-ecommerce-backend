import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule, JwtSignOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { OtpPolicy } from "./domain/otp.policy";
import { SessionService } from "./application/session.service";
import { TokenService } from "./application/token.service";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { BusinessModule } from "../business/business.module";
import { MailModule } from "../mail/mail.module";
import { PackageModule } from "../packages/package.module";
import { JwtStrategy } from "./strategies/jwt.strategy";

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
