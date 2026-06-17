import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsUUID, MaxLength, IsStrongPassword } from "class-validator";

export class ResetForgotPasswordDto {
  @ApiProperty({ example: "john@example.com" })
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  resetRequestId!: string;

  @ApiProperty({ example: "Password@123" })
  @IsStrongPassword({
    minLength: 8,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
    minLowercase: 1,
  })
  password!: string;
}
