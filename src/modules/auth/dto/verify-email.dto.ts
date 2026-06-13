import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length, MaxLength } from "class-validator";

export class VerifyEmailDto {
  @ApiProperty({ example: "john@example.com" })
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @ApiProperty({ example: "426911" })
  @IsString()
  @Length(6, 6)
  otp!: string;
}
