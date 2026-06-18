import {
  IsEmail,
  IsOptional,
  IsString,
  IsStrongPassword,
  MaxLength,
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
  @IsStrongPassword({
    minLength: 8,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
    minLowercase: 1,
  })
  password!: string;

  @ApiProperty({ example: "My Business" })
  @IsString()
  @IsOptional()
  businessName: string = "My Business";
}
