import {
  website,
  websiteConfig,
  websiteDomain,
  WebsiteDomainSslStatus,
  WebsiteDomainType,
  WebsiteDomainVerificationStatus,
  websiteSeoSetting,
  WebsiteStatus,
  WebsiteTemplate,
  websiteThemeSetting,
} from "@/database/schema";
import { describe, expect, it, jest } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";

import { WebsiteService } from "./website.service";

const currentUser = { id: "user-1" } as never;

function createSelectQueue(rows: unknown[][]) {
  return jest.fn(() => {
    const result = rows.shift() ?? [];
    const builder = {
      from: () => builder,
      innerJoin: () => builder,
      where: () => builder,
      limit: () => result,
      orderBy: () => builder,
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
  const appConfig = { corsSubdomainBases: ["localhost"] };
  const service = new WebsiteService({ db } as never, appConfig as never);

  jest.spyOn(service as any, "findWebsiteDetails").mockImplementation(() => ({
    id: "website-1",
    businessId: "business-1",
    name: "Acme Store",
    domains: insertedValues
      .filter((item) => item.table === websiteDomain)
      .map((item) => item.values),
  }));

  return { db, insertedValues, service, tx };
}

describe("WebsiteService", () => {
  it("creates a manual website using the business name and a default subdomain", async () => {
    const { insertedValues, service } = createService([
      [{ id: "business-1", name: "Acme Store" }],
      [],
      [],
      [],
    ]);

    const result = await service.create(currentUser, "business-1", {
      template: WebsiteTemplate.FASHION,
    });

    expect(result.data).toMatchObject({
      id: "website-1",
      name: "Acme Store",
    });
    expect(result.data.domains).toContainEqual(
      expect.objectContaining({
        websiteId: "website-1",
        domain: null,
        subdomain: "acme-store.localhost",
        domainType: WebsiteDomainType.SUBDOMAIN,
        isPrimary: true,
        verificationStatus: WebsiteDomainVerificationStatus.VERIFIED,
        sslStatus: WebsiteDomainSslStatus.ACTIVE,
        verifiedAt: expect.any(Date),
      }),
    );
    expect(insertedValues).toContainEqual({
      table: website,
      values: expect.objectContaining({
        businessId: "business-1",
        name: "Acme Store",
        status: WebsiteStatus.DRAFT,
        template: WebsiteTemplate.FASHION,
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

  it("uses a readable numeric suffix when the default subdomain is taken", async () => {
    const { insertedValues, service } = createService([
      [{ id: "business-1", name: "Acme Store Ltd." }],
      [],
      [],
      [{ id: "domain-existing" }],
      [],
    ]);

    await service.create(currentUser, "business-1", {
      template: WebsiteTemplate.FASHION,
    });

    expect(insertedValues).toContainEqual({
      table: websiteDomain,
      values: expect.objectContaining({
        subdomain: "acme-store-ltd-2.localhost",
      }),
    });
  });

  it("resolves storefronts by exact subdomain only", async () => {
    const { service } = createService([
      [
        {
          site: {
            id: "website-1",
            status: WebsiteStatus.PUBLISHED,
            deletedAt: null,
          },
          domain: {
            verificationStatus: WebsiteDomainVerificationStatus.VERIFIED,
            sslStatus: WebsiteDomainSslStatus.ACTIVE,
          },
        },
      ],
      [],
    ]);

    jest
      .spyOn(service as any, "hydrateWebsite")
      .mockImplementation(async (item) => item);

    await expect(service.findPublishedByHost("acme")).resolves.toMatchObject({
      id: "website-1",
    });
    await expect(
      service.findPublishedByHost("acme.example.com"),
    ).resolves.toBeNull();
  });

  it("explains why a registered storefront domain is not ready", async () => {
    const { service } = createService([
      [
        {
          site: {
            id: "website-1",
            status: WebsiteStatus.PUBLISHED,
            deletedAt: null,
          },
          domain: {
            verificationStatus: WebsiteDomainVerificationStatus.PENDING,
            sslStatus: WebsiteDomainSslStatus.ACTIVE,
          },
        },
      ],
    ]);

    await expect(service.findPublishedByHostOrThrow("acme")).rejects.toThrow(
      'The storefront domain "acme" is registered but cannot be used yet because its verification status is PENDING.',
    );
  });

  it("rejects a second active website for the same business", async () => {
    const { db, service, tx } = createService([
      [{ id: "business-1", name: "Acme Store" }],
      [{ id: "website-existing" }],
    ]);

    await expect(
      service.create(currentUser, "business-1", {
        template: WebsiteTemplate.FASHION,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("requires the business to exist before creating a website", async () => {
    const { service } = createService([[]]);

    await expect(
      service.create(currentUser, "missing-business", {
        template: WebsiteTemplate.FASHION,
      }),
    ).rejects.toThrow(
      "Business could not be found. It may not exist, may have been deleted, or may not be accessible to the current user.",
    );
  });
});
