import { PartialType } from "@nestjs/swagger";

import {
  CreateBusinessBrandingDto,
  CreateBusinessDto,
  CreateBusinessSettingDto,
} from "./create-business.dto";

export class UpdateBusinessSettingDto extends PartialType(
  CreateBusinessSettingDto,
) {}

export class UpdateBusinessBrandingDto extends PartialType(
  CreateBusinessBrandingDto,
) {}

export class UpdateBusinessDto extends PartialType(CreateBusinessDto) {}
