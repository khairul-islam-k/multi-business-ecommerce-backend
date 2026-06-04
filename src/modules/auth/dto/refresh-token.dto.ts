import { IsOptional, IsString, IsUUID } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class RefreshTokenDto {
  @ApiProperty({ example: "refresh-token" })
  @IsString()
  refreshToken!: string;

  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  businessId?: string;
}
