import { ApiProperty } from "@nestjs/swagger";
import { IsStrongPassword } from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({ example: "OldPassword@123" })
  @IsStrongPassword({
    minLength: 8,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
    minLowercase: 1,
  })
  oldPassword!: string;

  @ApiProperty({ example: "NewPassword@123" })
  @IsStrongPassword({
    minLength: 8,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
    minLowercase: 1,
  })
  newPassword!: string;
}
