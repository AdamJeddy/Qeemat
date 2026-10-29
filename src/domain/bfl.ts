import { ParsedProduct, ProductVariant } from './types';

/** BFL exposes available sizes in its rendered product UI, without SKU IDs.
 * Pin the product ID, sizing system and literal size; never invent a size URL. */
export function withBflSizeVariants(product: ParsedProduct | undefined, html: string): ParsedProduct | undefined {
  if (!product) { return undefined; }
  const list = html.match(/<ul\b[^>]*class=["'][^"']*\bsize_list\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1];
  if (list === undefined) { return product; }
  const productId = product.canonicalUrl.match(/\/(\d+)\/p\//)?.[1];
  if (!productId) { return undefined; }
  const system = html.match(/class=["']expiry_details_content_container["'][^>]*>\s*(EU|UK|US|INT)\s*</i)?.[1]?.toUpperCase();
  const variants: ProductVariant[] = [];
  for (const match of list.matchAll(/<li\b[^>]*class=["']([^"']*\bsize_item\b[^"']*)["'][^>]*>([^<]+)([\s\S]*?)<\/li>/gi)) {
    const size = match[2].replace(/&nbsp;/g, ' ').trim();
    if (!size) { continue; }
    const unavailable = product.availability === 'out_of_stock' || /disabled|unavailable|out.of.stock/i.test(match[1]);
    variants.push({ id: `${productId}:${system ?? 'size'}:${size}`, label: system ? `${system} ${size}` : size,
      attributes: [{ name: system ? `Size (${system})` : 'Size', value: size }],
      url: product.canonicalUrl, priceMinor: unavailable ? undefined : product.priceMinor,
      currency: product.currency, availability: unavailable ? 'out_of_stock' : product.availability,
      imageUrl: product.imageUrl });
  }
  if (!variants.length && product.availability !== 'out_of_stock') { return undefined; }
  return { ...product, sku: product.sku ?? productId, variants };
}
