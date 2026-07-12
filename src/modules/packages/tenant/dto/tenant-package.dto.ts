import { IsOptional, IsString, MaxLength } from "class-validator";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class CancelTenantSubscriptionDto {
  @ApiPropertyOptional({ example: "Moving to another plan later" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class CheckoutPackagePlanDto {
  @ApiPropertyOptional({ example: "https://app.example.com/billing/success" })
  @IsOptional()
  @IsString()
  successRedirectUrl?: string;

  @ApiPropertyOptional({ example: "https://app.example.com/billing/failed" })
  @IsOptional()
  @IsString()
  failRedirectUrl?: string;

  @ApiPropertyOptional({ example: "https://app.example.com/billing/cancelled" })
  @IsOptional()
  @IsString()
  cancelRedirectUrl?: string;
}
