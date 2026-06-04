import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule, JwtSignOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { BusinessModule } from "../business/business.module";
import { MailModule } from "../mail/mail.module";
import { PackageModule } from "../packages/package.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [
    MailModule,
    PassportModule.register({
      defaultStrategy: "jwt",
    }),
    BusinessModule,
    PackageModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.getOrThrow<string>("JWT_ACCESS_SECRET");

        const expiresIn = configService.get<string>("JWT_ACCESS_EXPIRES_IN");

        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as JwtSignOptions["expiresIn"],
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
