import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

import { SystemUserStatus } from "@/database/schema";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { EmployeeProfileDto } from "./employee-profile.dto";

export class CreateEmployeeDto {
  @ApiProperty({ example: "John Doe" })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: "john@example.com" })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({ example: "+8801711111111" })
  @IsOptional()
  @IsPhoneNumber()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ example: "Password@123" })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    enum: SystemUserStatus,
    example: SystemUserStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SystemUserStatus)
  status?: SystemUserStatus;

  @ApiPropertyOptional({ type: EmployeeProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmployeeProfileDto)
  profile?: EmployeeProfileDto;

  @ApiPropertyOptional({
    example: [
      "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913",
      "817f7bc6-3c3b-4de8-b6df-05f9a9ab1e24",
    ],
    description: "Optional RBAC role IDs to assign after employee creation.",
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  roleIds?: string[];
}
