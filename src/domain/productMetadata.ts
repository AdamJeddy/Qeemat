import type { SiteKey, VariantSelection } from './types';

export type ProductMetadata = {
  /** Retailer's category labels, ordered from broadest to most specific. */
  categoryPath?: string[];
  /** Source category identifiers when the retailer provides codes instead of names. */
  categoryIds?: string[];
  /** Product type as explicitly supplied by the retailer. */
  productType?: string;
  /** A more descriptive product-page heading, when it matches the parsed product. */
  displayName?: string;
  brand?: string;
  attributes?: Record<string, string>;
};

type RecordValue = Record<string, unknown>;
const asRecord = (value: unknown): RecordValue | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : undefined;
const text = (value: unknown): string | undefined => {
  const result = typeof value === 'string' ? value : asRecord(value)?.name;
  return typeof result === 'string' && result.trim() ? result.replace(/\s+/g, ' ').trim().slice(0, 200) : undefined;
};
function typed(record: RecordValue, type: string): boolean {
  const value = record['@type'];
  return value === type || (Array.isArray(value) && value.includes(type));
}
function records(value: unknown): RecordValue[] {
  if (Array.isArray(value)) { return value.flatMap(records); }
  const record = asRecord(value);
  if (!record) { return []; }
  return [record, ...records(record['@graph'])];
}
function parseJson(value: string): unknown {
  try { return JSON.parse(value); } catch { return undefined; }
}
function categoryValues(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value]).flatMap((entry) => {
    const label = text(entry);
    return label ? label.split(/\s*>\s*/).map((part) => part.trim()).filter(Boolean) : [];
  });
}

/** Read only product-scoped structured data, never arbitrary recommendation payloads. */
export function extractProductMetadata(siteKey: SiteKey, html: string, title: string): ProductMetadata | undefined {
  const structured = [...html.matchAll(/<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => records(parseJson(match[1])));
  const normalizedName = (value: string) => value.toLowerCase().replace(/[\s.,/#!$%^&*;:{}=\-_`~()"'“”‘’]+/g, ' ').trim();
  const targetName = normalizedName(title);
  const product = structured.filter((record) => typed(record, 'Product') || typed(record, 'ProductGroup')).find((record) => {
    const name = text(record.name);
    if (!name || !targetName) { return false; }
    const candidate = normalizedName(name);
    return candidate === targetName || (Math.min(candidate.length, targetName.length) >= 6 && (` ${candidate} `.includes(` ${targetName} `) || ` ${targetName} `.includes(` ${candidate} `)));
  });
  const breadcrumb = structured.find((record) => typed(record, 'BreadcrumbList'));
  const items = Array.isArray(breadcrumb?.itemListElement) ? breadcrumb.itemListElement : [];
  const categoryPath = items.map(asRecord).filter((item): item is RecordValue => Boolean(item))
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((item) => text(item.name) ?? text(item.item))
    .filter((item): item is string => Boolean(item) && item!.toLowerCase() !== title.trim().toLowerCase() && item!.toLowerCase() !== 'home' && item!.toLowerCase() !== text(product?.brand)?.toLowerCase());
  const wooBreadcrumb = siteKey === 'ay_accessories' ? html.match(/<nav\b(?=[^>]*\bclass=["'][^"']*\bwoocommerce-breadcrumb\b[^"']*["'])[^>]*>([\s\S]*?)<\/nav>/i)?.[1] : undefined;
  const wooCategories = wooBreadcrumb ? [...wooBreadcrumb.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => text(match[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&')))
    .filter((value): value is string => Boolean(value) && value!.toLowerCase() !== 'home' && value!.toLowerCase() !== 'shop') : [];
  const sourceCategories = wooCategories.length ? wooCategories : [...categoryPath];
  for (const category of categoryValues(product?.category)) {
    if (!sourceCategories.some((value) => value.toLowerCase() === category.toLowerCase())) { sourceCategories.push(category); }
  }

  const heading = text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]*>/g, ' ').replace(/&#(?:x27|39);|&apos;/gi, "'").replace(/&amp;/gi, '&').replace(/&quot;/gi, '"'));
  const headingName = heading ? normalizedName(heading) : '';
  const displayName = heading && targetName.length >= 3 && headingName.length > targetName.length && ` ${headingName} `.includes(` ${targetName} `) ? heading : undefined;

  let productType = text(product?.productType) ?? text(product?.product_type);
  let brand = text(product?.brand);
  if (siteKey === 'decathlon_uae') {
    const raw = html.match(/<script\b(?=[^>]*\bid=["']ProductJson["'])[^>]*>([\s\S]*?)<\/script>/i)?.[1];
    const shopify = asRecord(raw ? parseJson(raw) : undefined);
    productType = text(shopify?.product_type) ?? productType;
    brand = text(shopify?.vendor) ?? brand;
  }
  const material = text(product?.material);
  const color = text(product?.color);
  const gender = text(asRecord(product?.audience)?.suggestedGender);
  const attributes: Record<string, string> = { ...(material ? { material } : {}), ...(color ? { color } : {}), ...(gender ? { gender } : {}) };
  if (siteKey === 'hm_uae') {
    const allowed = new Set(['age_group', 'garment_length', 'sleeve_length', 'fit', 'style']);
    for (const match of html.matchAll(/<li\b[^>]*class=["'][^"']*pdp-product-description__attribute--([a-z_]+)[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)) {
      const key = match[1].toLowerCase();
      const value = text(match[2].match(/<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1]?.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&'));
      if (!value) { continue; }
      if (key === 'presentation_product_type') { productType = value; }
      else if (allowed.has(key)) { attributes[key] = value; }
    }
  }
  const result: ProductMetadata = { ...(sourceCategories.length ? { categoryPath: [...new Set(sourceCategories)].slice(0, 12) } : {}),
    ...(productType ? { productType } : {}), ...(displayName ? { displayName } : {}), ...(brand ? { brand } : {}), ...(Object.keys(attributes).length ? { attributes } : {}) };
  return Object.keys(result).length ? result : undefined;
}

/** Keep older source values when a later response omits them. */
export function mergeProductMetadata(previous?: ProductMetadata, incoming?: ProductMetadata): ProductMetadata | undefined {
  if (!incoming) { return previous; }
  if (!previous) { return incoming; }
  const attributes = { ...previous.attributes, ...incoming.attributes };
  return {
    ...previous,
    ...incoming,
    categoryPath: incoming.categoryPath?.length ? incoming.categoryPath : previous.categoryPath,
    categoryIds: incoming.categoryIds?.length ? incoming.categoryIds : previous.categoryIds,
    productType: incoming.productType || previous.productType,
    displayName: incoming.displayName || previous.displayName,
    brand: incoming.brand || previous.brand,
    ...(Object.keys(attributes).length ? { attributes } : {})
  };
}

/** A page's default color must not be attributed to a different selected option. */
export function metadataForVariant(metadata?: ProductMetadata, variant?: VariantSelection): ProductMetadata | undefined {
  const selectedColor = variant?.attributes.find((attribute) => /^(?:color|colour)$/i.test(attribute.name))?.value;
  if (!metadata?.attributes?.color || !selectedColor || metadata.attributes.color.toLowerCase() === selectedColor.toLowerCase()) { return metadata; }
  const attributes = { ...metadata.attributes };
  delete attributes.color;
  const result = { ...metadata };
  if (Object.keys(attributes).length) { result.attributes = attributes; }
  else { delete result.attributes; }
  return Object.keys(result).length ? result : undefined;
}
