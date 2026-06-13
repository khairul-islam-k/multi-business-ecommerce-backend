import { describe, expect, it, jest } from "@jest/globals";

import { createCorsOrigin, parseCorsOrigins } from "./cors.config";

describe("cors config", () => {
  it("parses comma-separated origins", () => {
    expect(parseCorsOrigins("http://a.test, http://b.test")).toEqual([
      "http://a.test",
      "http://b.test",
    ]);
  });

  it("allows configured origins and rejects unknown origins", () => {
    const corsOrigin = createCorsOrigin(["http://allowed.test"]);
    const allowedCallback = jest.fn();
    const rejectedCallback = jest.fn();

    corsOrigin("http://allowed.test", allowedCallback);
    corsOrigin("http://blocked.test", rejectedCallback);

    expect(allowedCallback).toHaveBeenCalledWith(null, true);
    expect(rejectedCallback.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(rejectedCallback.mock.calls[0][1]).toBe(false);
  });
});
