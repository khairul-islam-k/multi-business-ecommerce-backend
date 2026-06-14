import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class CancelTenantSubscriptionDto {
  @ApiPropertyOptional({ example: "Moving to another plan later" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
