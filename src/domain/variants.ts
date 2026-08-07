import { ProductVariant, VariantAttribute, VariantSelection } from './types';

export type VariantAttributes = Record<string, string>;

export type VariantOptionGroup = {
  name: string;
  values: Array<{ value: string; disabled: boolean }>;
};

export function getVariantOptionGroups(variants: ProductVariant[]): VariantOptionGroup[] {
  const names = uniqueAttributeNames(variants);

  return names.map((name) => {
    const values = uniqueAttributeValues(variants, name);
    return {
      name,
      values: values.map((value) => ({
        value,
        disabled: !variants.some((variant) =>
          variant.availability === 'in_stock' &&
          getAttributeValue(variant.attributes, name) === value
        )
      }))
    };
  });
}

export function updateSelectedVariantAttributes(
  variants: ProductVariant[],
  selected: VariantAttributes,
  name: string,
  value: string
): VariantAttributes {
  const next = { ...selected, [name]: value };

  for (const attributeName of uniqueAttributeNames(variants)) {
    if (attributeName === name || !next[attributeName]) {
      continue;
    }

    const matchesCurrentSelection = variants.some(
      (variant) => variant.availability === 'in_stock' && matchesAttributes(variant.attributes, next)
    );
    if (!matchesCurrentSelection) {
      delete next[attributeName];
    }
  }

  return next;
}

export function resolveSelectedVariant(variants: ProductVariant[], selected: VariantAttributes): ProductVariant | undefined {
  return variants.find(
    (variant) =>
      variant.availability === 'in_stock' &&
      variant.attributes.length === Object.keys(selected).length &&
      matchesAttributes(variant.attributes, selected)
  );
}

export function findTrackedVariant(variants: ProductVariant[], selection: VariantSelection): ProductVariant | undefined {
  return variants.find((variant) => variant.id === selection.id);
}

export function toVariantSelection(variant: ProductVariant): VariantSelection {
  return {
    id: variant.id,
    label: variant.label,
    attributes: variant.attributes,
    ...(variant.url ? { url: variant.url } : {})
  };
}

export function toAttributes(attributes: VariantAttribute[]): VariantAttributes {
  return Object.fromEntries(attributes.map((attribute) => [attribute.name, attribute.value]));
}

function uniqueAttributeNames(variants: ProductVariant[]): string[] {
  return Array.from(new Set(variants.flatMap((variant) => variant.attributes.map((attribute) => attribute.name))));
}

function uniqueAttributeValues(variants: ProductVariant[], name: string): string[] {
  return Array.from(
    new Set(
      variants
        .map((variant) => getAttributeValue(variant.attributes, name))
        .filter((value): value is string => Boolean(value))
    )
  );
}

function getAttributeValue(attributes: VariantAttribute[], name: string): string | undefined {
  return attributes.find((attribute) => attribute.name === name)?.value;
}

function matchesAttributes(attributes: VariantAttribute[], selected: VariantAttributes): boolean {
  return Object.entries(selected).every(([name, value]) => getAttributeValue(attributes, name) === value);
}
