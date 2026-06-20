import { describe, expect, it, jest } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";

import {
  WebsiteStatus,
  WebsiteTemplate,
  website,
  websiteConfig,
  websiteSeoSetting,
  websiteThemeSetting,
} from "@/database/schema";

import { WebsiteService } from "./website.service";

const currentUser = { id: "user-1" } as never;

function createSelectQueue(rows: unknown[][]) {
  return jest.fn(() => {
    const result = rows.shift() ?? [];
    const builder = {
      from: () => builder,
      where: () => builder,
      limit: () => result,
      then: (
        resolve: (value: unknown[]) => unknown,
        reject?: (error: unknown) => unknown,
      ) => Promise.resolve(result).then(resolve, reject),
    };

    return builder;
  });
}

function createService(rows: unknown[][] = []) {
  const insertedValues: { table: unknown; values: Record<string, unknown> }[] =
    [];
  const tx = {
    insert: jest.fn((table) => ({
      values: jest.fn((values: Record<string, unknown>) => {
        insertedValues.push({ table, values });

        return table === website
          ? {
              returning: jest.fn(async () => [
                {
                  id: "website-1",
                  businessId: "business-1",
                  ...values,
                },
              ]),
            }
          : Promise.resolve(undefined);
      }),
    })),
  };
  const db = {
    select: createSelectQueue(rows),
    transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback(tx),
    ),
  };
  const packageLimits = {
    assertWithinLimit: jest.fn(async () => undefined),
  };
  const service = new WebsiteService({ db } as never, packageLimits as never);

  jest.spyOn(service as any, "findWebsiteDetails").mockResolvedValue({
    id: "website-1",
    businessId: "business-1",
    name: "Acme Store",
  });

  return { db, insertedValues, packageLimits, service, tx };
}

describe("WebsiteService", () => {
  it("creates a manual website using the business name", async () => {
    const { insertedValues, service } = createService([
      [{ id: "business-1", name: "Acme Store" }],
      [],
      [],
    ]);

    const result = await service.create(currentUser, "business-1", {
      template: WebsiteTemplate.ELECTRONIC,
    });

    expect(result.data).toMatchObject({
      id: "website-1",
      name: "Acme Store",
    });
    expect(insertedValues).toContainEqual({
      table: website,
      values: expect.objectContaining({
        businessId: "business-1",
        name: "Acme Store",
        status: WebsiteStatus.DRAFT,
        template: WebsiteTemplate.ELECTRONIC,
      }),
    });
    expect(insertedValues.some((item) => item.table === websiteConfig)).toBe(
      true,
    );
    expect(
      insertedValues.some((item) => item.table === websiteThemeSetting),
    ).toBe(true);
    expect(
      insertedValues.some((item) => item.table === websiteSeoSetting),
    ).toBe(true);
  });

  it("rejects a second active website for the same business", async () => {
    const { db, packageLimits, service, tx } = createService([
      [{ id: "business-1", name: "Acme Store" }],
      [{ id: "website-existing" }],
    ]);

    await expect(
      service.create(currentUser, "business-1", {
        template: WebsiteTemplate.ELECTRONIC,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(packageLimits.assertWithinLimit).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("requires the business to exist before creating a website", async () => {
    const { service } = createService([[]]);

    await expect(
      service.create(currentUser, "missing-business", {
        template: WebsiteTemplate.ELECTRONIC,
      }),
    ).rejects.toThrow("Business not found");
  });
});
