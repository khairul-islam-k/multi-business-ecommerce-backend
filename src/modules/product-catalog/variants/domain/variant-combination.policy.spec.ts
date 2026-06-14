import { describe, expect, it } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";

import {
  assertBulkUpdateAttributeCombinations,
  assertUniqueAttributeCombinations,
  buildAttributeCombinationKey,
  variantMatchesAttributes,
} from "./variant-combination.policy";

describe("variant combination policy", () => {
  it("builds the same key for the same attributes in different order", () => {
    const first = buildAttributeCombinationKey([
      { attributeId: "color", attributeValueId: "red" },
      { attributeId: "size", attributeValueId: "large" },
    ]);
    const second = buildAttributeCombinationKey([
      { attributeId: "size", attributeValueId: "large" },
      { attributeId: "color", attributeValueId: "red" },
    ]);

    expect(first).toBe(second);
  });

  it("rejects duplicate combinations in bulk create", () => {
    expect(() =>
      assertUniqueAttributeCombinations([
        [
          { attributeId: "color", attributeValueId: "red" },
          { attributeId: "size", attributeValueId: "large" },
        ],
        [
          { attributeId: "size", attributeValueId: "large" },
          { attributeId: "color", attributeValueId: "red" },
        ],
      ]),
    ).toThrow(BadRequestException);
  });

  it("allows distinct combinations", () => {
    expect(() =>
      assertUniqueAttributeCombinations([
        [{ attributeId: "color", attributeValueId: "red" }],
        [{ attributeId: "color", attributeValueId: "blue" }],
      ]),
    ).not.toThrow();
  });

  it("detects duplicate combinations during bulk update", () => {
    expect(() =>
      assertBulkUpdateAttributeCombinations(
        [
          {
            id: "variant-a",
            attributes: [{ attributeId: "color", attributeValueId: "red" }],
          },
          {
            id: "variant-b",
            attributes: [{ attributeId: "color", attributeValueId: "blue" }],
          },
        ],
        [
          {
            variantId: "variant-b",
            attributes: [{ attributeId: "color", attributeValueId: "red" }],
          },
        ],
      ),
    ).toThrow(BadRequestException);
  });

  it("matches variants that contain all selected attributes", () => {
    expect(
      variantMatchesAttributes(
        {
          attributes: [
            { attributeId: "color", attributeValueId: "red" },
            { attributeId: "size", attributeValueId: "large" },
          ],
        },
        [{ attributeId: "color", attributeValueId: "red" }],
      ),
    ).toBe(true);
  });
});
