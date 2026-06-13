import { BadRequestException } from "@nestjs/common";

export type VariantAttributeSelection = {
  attributeId: string;
  attributeValueId: string;
};

export function buildAttributeCombinationKey(
  attributes: VariantAttributeSelection[] = [],
) {
  if (attributes.length === 0) {
    return null;
  }

  return attributes
    .map(
      (attribute) => `${attribute.attributeId}:${attribute.attributeValueId}`,
    )
    .sort()
    .join("|");
}

export function variantMatchesAttributes(
  variant: { attributes: VariantAttributeSelection[] },
  selectedAttributes: VariantAttributeSelection[],
) {
  return selectedAttributes.every((selectedAttribute) =>
    variant.attributes.some(
      (attribute) =>
        attribute.attributeId === selectedAttribute.attributeId &&
        attribute.attributeValueId === selectedAttribute.attributeValueId,
    ),
  );
}

export function assertUniqueAttributeCombinations(
  attributeSets: VariantAttributeSelection[][],
) {
  const seenKeys = new Set<string>();

  for (const attributes of attributeSets) {
    const key = buildAttributeCombinationKey(attributes);

    if (!key) {
      continue;
    }

    if (seenKeys.has(key)) {
      throw new BadRequestException(
        "Bulk variants cannot contain duplicate attribute combinations",
      );
    }

    seenKeys.add(key);
  }
}

export function assertBulkUpdateAttributeCombinations(
  existingVariants: {
    id: string;
    attributes: VariantAttributeSelection[];
  }[],
  updates: {
    variantId: string;
    attributes?: VariantAttributeSelection[];
  }[],
) {
  const nextAttributesByVariantId = new Map(
    updates
      .filter((update) => update.attributes !== undefined)
      .map((update) => [update.variantId, update.attributes ?? []]),
  );
  const keyToVariantIds = new Map<string, string[]>();

  for (const variant of existingVariants) {
    const attributes =
      nextAttributesByVariantId.get(variant.id) ?? variant.attributes;
    const key = buildAttributeCombinationKey(attributes);

    if (!key) {
      continue;
    }

    keyToVariantIds.set(key, [...(keyToVariantIds.get(key) ?? []), variant.id]);
  }

  for (const update of updates) {
    const variant = existingVariants.find(
      (existingVariant) => existingVariant.id === update.variantId,
    );
    const attributes =
      update.attributes !== undefined
        ? update.attributes
        : (variant?.attributes ?? []);
    const key = buildAttributeCombinationKey(attributes);

    if (!key) {
      continue;
    }

    const conflictingVariantIds = (keyToVariantIds.get(key) ?? []).filter(
      (variantId) => variantId !== update.variantId,
    );

    if (conflictingVariantIds.length > 0) {
      throw new BadRequestException(
        "One or more variant attribute combinations already exist",
      );
    }
  }
}
