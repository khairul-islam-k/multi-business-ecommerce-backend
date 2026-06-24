import { Module } from "@nestjs/common";
import { JwtModule, JwtSignOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { AppConfigService } from "@/common/config/app-config.service";
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
      inject: [AppConfigService],
      useFactory: (appConfig: AppConfigService) => {
        return {
          secret: appConfig.jwtAccessSecret,
          signOptions: {
            expiresIn:
              appConfig.jwtAccessExpiresIn as JwtSignOptions["expiresIn"],
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
