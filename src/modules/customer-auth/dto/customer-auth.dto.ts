import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CustomerRegisterDto {
  @ApiProperty({ example: "Jane Doe" })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: "jene@example.com" })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: "StrongPass123!" })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @ApiPropertyOptional({ example: "+8801712345678" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class CustomerLoginDto {
  @ApiProperty({ example: "customer@example.com" })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: "StrongPass123!" })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  password!: string;
}

export class CustomerRefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class CustomerLogoutDto extends CustomerRefreshTokenDto {}

export class CustomerVerifyEmailDto {
  @ApiProperty({ example: "customer@example.com" })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otp!: string;
}

export class CustomerRequestVerificationDto {
  @ApiProperty({ example: "customer@example.com" })
  @IsEmail()
  @MaxLength(255)
  email!: string;
}

export class CustomerForgotPasswordDto {
  @ApiProperty({ example: "customer@example.com" })
  @IsEmail()
  @MaxLength(255)
  email!: string;
}

export class CustomerVerifyResetOtpDto {
  @ApiProperty({ example: "customer@example.com" })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: "426911" })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otp!: string;
}

export class CustomerResetPasswordDto {
  @ApiProperty()
  @IsUUID()
  resetRequestId!: string;

  @ApiProperty({ example: "customer@example.com" })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: "NewStrongPass123!" })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;
}
