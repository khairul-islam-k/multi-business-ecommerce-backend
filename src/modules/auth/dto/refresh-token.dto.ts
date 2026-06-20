import { IsOptional, IsString, IsUUID } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class RefreshTokenDto {
  @ApiProperty({
    example: "798f27ac991c6ce5b7c0c40f8246b156d6eec9a10a177d283e19c6254adf038b",
  })
  @IsString()
  refreshToken!: string;

  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  businessId?: string;
}
