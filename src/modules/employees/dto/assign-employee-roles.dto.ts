import { ApiProperty } from "@nestjs/swagger";
import { ArrayUnique, IsArray, IsUUID } from "class-validator";

export class AssignEmployeeRolesDto {
  @ApiProperty({
    example: [
      "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913",
      "817f7bc6-3c3b-4de8-b6df-05f9a9ab1e24",
    ],
    description: "This replaces the employee's active roles for this business.",
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  roleIds!: string[];
}
