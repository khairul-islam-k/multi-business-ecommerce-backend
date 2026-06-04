import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class ResetForgotPasswordDto {
  @ApiProperty({ example: "john@example.com" })
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @ApiProperty({ example: "verification_uuid_here" })
  @IsString()
  verificationId!: string;

  @ApiProperty({ example: "Password@123" })
  @IsString()
  @MinLength(6)
  password!: string;
}
