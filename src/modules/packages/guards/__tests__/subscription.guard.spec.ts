import { describe, expect, it, jest } from "@jest/globals";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { SystemUserType } from "@/database/schema";

import { SubscriptionGuard } from "../subscription.guard";

function createContext(user?: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe("SubscriptionGuard", () => {
  it("throws when a protected route has no authenticated user", async () => {
    const guard = new SubscriptionGuard({
      assertTenantSubscriptionActive: jest.fn(),
    } as never);

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("allows admin users without checking tenant subscription", async () => {
    const subscriptions = {
      assertTenantSubscriptionActive: jest.fn(),
    };
    const guard = new SubscriptionGuard(subscriptions as never);

    await expect(
      guard.canActivate(
        createContext({ id: "admin-id", type: SystemUserType.ADMIN }),
      ),
    ).resolves.toBe(true);
    expect(subscriptions.assertTenantSubscriptionActive).not.toHaveBeenCalled();
  });
});
