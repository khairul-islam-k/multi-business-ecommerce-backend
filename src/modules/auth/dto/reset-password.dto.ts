import { IsString, MinLength } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class ResetPasswordDto {
  @ApiProperty({ example: "Password@123" })
  @IsString()
  @MinLength(6)
  oldPassword!: string;

  @ApiProperty({ example: "Password@123" })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
