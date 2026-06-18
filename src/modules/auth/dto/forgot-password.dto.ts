import { IsEmail, MaxLength } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class ForgotPasswordDto {
  @ApiProperty({ example: "john@example.com" })
  @IsEmail()
  @MaxLength(150)
  email!: string;
}
