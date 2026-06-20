import { describe, expect, it, jest } from "@jest/globals";

import { business, website } from "@/database/schema";

import { BusinessService } from "./business.service";

const currentUser = { id: "user-1" } as never;

function createService() {
  const updates: { table: unknown; values: Record<string, unknown> }[] = [];
  const tx = {
    update: jest.fn((table) => ({
      set: jest.fn((values: Record<string, unknown>) => {
        updates.push({ table, values });

        return { where: jest.fn(async () => undefined) };
      }),
    })),
  };
  const db = {
    transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback(tx),
    ),
  };
  const businessAccess = {
    assertCanAccessBusiness: jest.fn(async () => ({
      isAdmin: false,
      isOwner: true,
    })),
    getBusinessAccessCondition: jest.fn(),
  };
  const service = new BusinessService({ db } as never, businessAccess as never);

  jest
    .spyOn(service as any, "findBusinessById")
    .mockResolvedValue({ id: "business-1", name: "Renamed Store" });

  return { service, updates };
}

describe("BusinessService", () => {
  it("syncs the website name when business name changes", async () => {
    const { service, updates } = createService();

    await service.update(currentUser, "business-1", {
      name: " Renamed Store ",
    });

    expect(updates).toContainEqual({
      table: business,
      values: expect.objectContaining({
        name: "Renamed Store",
        updatedById: "user-1",
      }),
    });
    expect(updates).toContainEqual({
      table: website,
      values: expect.objectContaining({
        name: "Renamed Store",
        updatedBy: "user-1",
      }),
    });
  });
});
