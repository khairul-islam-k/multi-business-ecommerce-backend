import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({ example: "John" })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: "john@example.com" })
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @ApiProperty({ example: "Password@123" })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: "My Business" })
  @IsString()
  @IsOptional()
  businessName: string = "My Business";
}
