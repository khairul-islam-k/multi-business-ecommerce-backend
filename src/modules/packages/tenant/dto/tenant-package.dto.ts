import { IsOptional, IsString, MaxLength } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class CancelTenantSubscriptionDto {
  @ApiPropertyOptional({ example: "Moving to another plan later" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
