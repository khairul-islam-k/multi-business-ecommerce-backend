import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, jest } from "@jest/globals";
import { Reflector } from "@nestjs/core";
import { PackageLimitKey } from "@prisma/client";

import type { PackageLimitRequirement } from "../../decorators/require-package-limit.decorator";
import { PackageLimitGuard } from "../package-limit.guard";

function createContext(user?: unknown): ExecutionContext {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function createGuard(requirement?: PackageLimitRequirement) {
  const reflector = {
    getAllAndOverride: jest.fn(() => requirement),
  } as unknown as Reflector;

  const packageLimits = {
    assertWithinLimit: jest.fn(),
  };

  return {
    guard: new PackageLimitGuard(reflector, packageLimits as never),
    packageLimits,
  };
}

describe("PackageLimitGuard", () => {
  it("allows routes without package-limit metadata", async () => {
    const { guard, packageLimits } = createGuard();

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(packageLimits.assertWithinLimit).not.toHaveBeenCalled();
  });

  it("throws when package-limit metadata exists without an authenticated user", async () => {
    const { guard } = createGuard({
      limitKey: PackageLimitKey.MAX_PRODUCTS,
    });

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
