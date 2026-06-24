import { describe, expect, it, jest } from "@jest/globals";

import {
  createCorsOrigin,
  parseCorsDomainBases,
  parseCorsOrigins,
} from "./cors.config";

describe("cors config", () => {
  it("parses comma-separated origins", () => {
    expect(parseCorsOrigins("http://a.test, http://b.test")).toEqual([
      "http://a.test",
      "http://b.test",
    ]);
  });

  it("parses comma-separated subdomain base domains", () => {
    expect(
      parseCorsDomainBases("https://onecomm.test, stores.example.com:443"),
    ).toEqual(["onecomm.test", "stores.example.com"]);
  });

  it("allows configured origins and rejects unknown origins", () => {
    const corsOrigin = createCorsOrigin({
      allowedOrigins: ["http://allowed.test"],
    });
    const allowedCallback = jest.fn();
    const rejectedCallback = jest.fn();

    corsOrigin("http://allowed.test", allowedCallback);
    corsOrigin("http://blocked.test", rejectedCallback);

    expect(allowedCallback).toHaveBeenCalledWith(null, true);
    expect(rejectedCallback.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(rejectedCallback.mock.calls[0][1]).toBe(false);
  });

  it("allows origins on configured platform subdomain bases", () => {
    const corsOrigin = createCorsOrigin({
      allowedOrigins: [],
      allowedSubdomainBases: ["onecomm.test"],
    });
    const apexCallback = jest.fn();
    const subdomainCallback = jest.fn();
    const rejectedCallback = jest.fn();

    corsOrigin("https://onecomm.test", apexCallback);
    corsOrigin("https://acme.onecomm.test", subdomainCallback);
    corsOrigin("https://onecomm.test.evil.test", rejectedCallback);

    expect(apexCallback).toHaveBeenCalledWith(null, true);
    expect(subdomainCallback).toHaveBeenCalledWith(null, true);
    expect(rejectedCallback.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it("uses custom-domain lookup as the last CORS check", async () => {
    const corsOrigin = createCorsOrigin({
      allowedOrigins: [],
      isAllowedCustomDomain: async (hostname) => hostname === "brand.test",
    });
    const allowedCallback = jest.fn();
    const rejectedCallback = jest.fn();

    corsOrigin("https://brand.test", allowedCallback);
    corsOrigin("https://blocked.test", rejectedCallback);
    await Promise.resolve();

    expect(allowedCallback).toHaveBeenCalledWith(null, true);
    expect(rejectedCallback.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});
