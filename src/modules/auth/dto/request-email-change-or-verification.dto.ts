import { IsEmail, MaxLength } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class RequestEmailChangeOrVerificationDto {
  @ApiProperty({ example: "john@example.com" })
  @IsEmail()
  @MaxLength(150)
  email!: string;
}
