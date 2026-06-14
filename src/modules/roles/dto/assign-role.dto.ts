import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDate, IsOptional, IsUUID } from "class-validator";

export class AssignRoleDto {
  @ApiProperty({
    example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913",
  })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({
    example: "2026-12-31T23:59:59.000Z",
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}
