import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID } from "class-validator";

export class SelectBusinessDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  businessId!: string;

  @ApiProperty({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." })
  @IsString()
  refreshToken!: string;
}
