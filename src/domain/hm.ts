import { parsePriceToMinor } from './price';
import { ParsedProduct, ProductVariant } from './types';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** H&M catalogue prices and stock belong to the child SKU, not the parent colour. */
export function parseHmCatalogue(url: string, payload: unknown): ParsedProduct | undefined {
  const products = record(record(payload).data).products;
  const product = record(Array.isArray(products) ? products[0] : undefined);
  if (typeof product.sku !== 'string' || typeof product.name !== 'string') { return undefined; }
  const options = Array.isArray(product.options) ? product.options : [];
  const sizeOption = options.map(record).find((option) => option.id === 'size');
  const values = Array.isArray(sizeOption?.values) ? sizeOption.values.map(record) : [];
  const choices = record(product.variants).variants;
  if (!Array.isArray(choices)) {
    const amount = record(record(record(product.price).final).amount);
    const priceMinor = parsePriceToMinor(typeof amount.value === 'number' || typeof amount.value === 'string' ? amount.value : undefined);
    if (typeof product.inStock !== 'boolean' || (product.inStock && (priceMinor === undefined || typeof amount.currency !== 'string'))) { return undefined; }
    return { siteKey: 'hm_uae', canonicalUrl: url, title: product.name, sku: product.sku, priceMinor,
      currency: typeof amount.currency === 'string' ? amount.currency : 'AED', availability: product.inStock ? 'in_stock' : 'out_of_stock' };
  }
  const variants: ProductVariant[] = [];
  for (const choice of choices.map(record)) {
    const item = record(choice.product);
    const selections = Array.isArray(choice.selections) ? choice.selections : [];
    const size = values.find((value) => selections.includes(value.id));
    const amount = record(record(record(item.price).final).amount);
    const priceMinor = parsePriceToMinor(typeof amount.value === 'number' || typeof amount.value === 'string' ? amount.value : undefined);
    if (typeof item.sku !== 'string' || typeof size?.title !== 'string' || typeof item.inStock !== 'boolean') { continue; }
    const inStock = item.inStock && size.inStock !== false;
    if (inStock && (typeof amount.currency !== 'string' || priceMinor === undefined)) { continue; }
    variants.push({ id: item.sku, sku: item.sku, label: `Size: ${size.title}`, attributes: [{ name: 'Size', value: size.title }],
      priceMinor, currency: typeof amount.currency === 'string' ? amount.currency : 'AED', availability: inStock ? 'in_stock' : 'out_of_stock' });
  }
  // A size with multiple child SKUs requires another option to disambiguate it.
  const uniqueVariants = variants.filter((variant) => variants.filter((other) => other.label === variant.label).length === 1);
  const first = uniqueVariants.find((variant) => variant.availability === 'in_stock') ?? uniqueVariants[0];
  if (!first) { return undefined; }
  return { siteKey: 'hm_uae', canonicalUrl: url, title: product.name, sku: product.sku, priceMinor: first.priceMinor,
    currency: first.currency, availability: first.availability, variants: uniqueVariants };
}
