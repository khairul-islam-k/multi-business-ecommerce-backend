import { IsEmail, IsString, Length, MaxLength } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class VerifyResetOtpDto {
  @ApiProperty({ example: "john@example.com" })
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @ApiProperty({ example: "426911" })
  @IsString()
  @Length(6, 6)
  otp!: string;
}
