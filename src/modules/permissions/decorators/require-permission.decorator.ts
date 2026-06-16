import { SetMetadata } from "@nestjs/common";
import { PermissionAction, RbacFeature } from "@/database/schema";

export const REQUIRED_PERMISSION_KEY = "required_permission";

export type RequiredPermissionMeta = {
  feature: RbacFeature;
  action: PermissionAction;
  businessIdParam: string;
};

export const RequirePermission = (
  feature: RbacFeature,
  action: PermissionAction,
  options?: {
    businessIdParam?: string;
  },
) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, {
    feature,
    action,
    businessIdParam: options?.businessIdParam ?? "businessId",
  } satisfies RequiredPermissionMeta);
