import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

import { EmployeeProfileDto } from "./employee-profile.dto";

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: "John Doe" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: "john@example.com" })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: "+8801711111111" })
  @IsOptional()
  @IsPhoneNumber()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ example: "Password@123" })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ type: EmployeeProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmployeeProfileDto)
  profile?: EmployeeProfileDto;
}
