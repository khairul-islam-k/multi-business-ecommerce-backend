import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

import { Gender } from "@/database/schema";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateUserProfileDto {
  @ApiPropertyOptional({ example: "John" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string | null;

  @ApiPropertyOptional({ example: "Doe" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string | null;

  @ApiPropertyOptional({ example: "https://cdn.example.com/avatar.jpg" })
  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @ApiPropertyOptional({ example: "1998-05-10" })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ enum: Gender, example: Gender.OTHER })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender | null;

  @ApiPropertyOptional({ example: "House 10, Road 5, Area X" })
  @IsOptional()
  @IsString()
  address?: string | null;

  @ApiPropertyOptional({ example: "Dhaka" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @ApiPropertyOptional({ example: "Bangladesh" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string | null;

  @ApiPropertyOptional({ example: "Senior sales employee." })
  @IsOptional()
  @IsString()
  bio?: string | null;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: "John Doe" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: "+8801711111111" })
  @IsOptional()
  @IsPhoneNumber()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ type: UpdateUserProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateUserProfileDto)
  profile?: UpdateUserProfileDto;
}
