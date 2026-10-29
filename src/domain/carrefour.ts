import { Availability, ParsedProduct, ProductVariant } from './types';
import { parsePriceToMinor } from './price';
import { inferPackBasis, PriceBasis } from './priceBasis';

type RecordValue = Record<string, unknown>;

/** Read streamed JSON as data, including records split across Flight chunks. */
export function readCarrefourRecords(html: string): RecordValue[] {
  const records: RecordValue[] = [];
  const data = [...html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)\s*;?\s*<\/script>/g)].map((match) => {
    try { const chunk = JSON.parse(match[1]); return typeof chunk[1] === 'string' ? chunk[1] : ''; }
    catch { return ''; }
  }).join('');
  function visit(value: unknown, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 40) { return; }
    if (!Array.isArray(value)) { records.push(value as RecordValue); }
    Object.values(value).forEach((child) => visit(child, depth + 1));
  }
  for (const line of data.split('\n')) {
    try { visit(JSON.parse(line.slice(line.indexOf(':') + 1))); }
    catch { /* Flight also contains non-JSON module and text records. */ }
  }
  return records;
}

function scalar(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() && !value.startsWith('$') ? value : undefined;
}

export function carrefourPrice(record: RecordValue, priceMinor: number | undefined): { priceMinor?: number; priceBasis?: PriceBasis } {
  if (record.isSoldByWeight !== true) {
    const attributes = record.additionalAttributes as RecordValue | undefined;
    const categories = record.productCategory ?? attributes?.productCategory;
    const food = record.productType === 'FOOD' || (Array.isArray(categories) && categories.some((category) => /^f\d/i.test(String(category))));
    return { priceMinor, priceBasis: food ? inferPackBasis(String(record.productTitle ?? record.productName ?? '')) : undefined };
  }
  const threshold = record.orderThreshold as RecordValue | undefined;
  const grams = Number(record.scalableWeights);
  const kilograms = Number.isFinite(grams) && grams > 0 ? grams / 1000 : record.quantityTypeKey === 'kilo' ? Number(threshold?.min) : NaN;
  // The price is for the source's default weight. Missing weight is not a
  // license to use analytics.unitPrice, which can be the marked/original price.
  return { priceBasis: 'kg', priceMinor: priceMinor !== undefined && Number.isFinite(kilograms) && kilograms > 0 ? Math.round(priceMinor / kilograms) : undefined };
}

/** Preserve source offer identity; the SEO canonical URL drops this information. */
export function carrefourOfferUrl(base: string, record: RecordValue): string | undefined {
  const offer = scalar(record.offerId);
  const seller = scalar(record.shopId);
  const intent = scalar(record.intent);
  const path = base.split(/[?#]/)[0];
  if (!offer || !seller || !intent || !/^https:\/\/(?:www\.)?carrefouruae\.com\/mafuae\/en\/(?:[^?#]*\/)?p\/\d+$/.test(path)) { return undefined; }
  return `${path}?offer=${encodeURIComponent(offer)}&sellerId=${encodeURIComponent(seller)}&sid=${encodeURIComponent(intent)}`;
}

export function carrefourAvailability(status: unknown, quantity?: unknown): Availability {
  const key = typeof status === 'string' ? status.toLowerCase().replace(/[^a-z]/g, '') : '';
  if (quantity === 0 || ['outofstock', 'out', 'unavailable'].includes(key)) { return 'out_of_stock'; }
  if (['instock', 'lowstock', 'available', 'low', 'normal'].includes(key)) { return 'in_stock'; }
  return 'unknown';
}

export function parseCarrefourProduct(inputUrl: string, html: string): ParsedProduct | undefined {
  const productId = inputUrl.match(/\/p\/(\d+)(?:[?#]|$)/)?.[1];
  if (!productId) { return undefined; }
  const record = readCarrefourRecords(html).find((item) => item.productId === productId &&
    typeof item.productTitle === 'string' && typeof item.stockStatus === 'string');
  if (!record) { return undefined; }
  const canonicalUrl = carrefourOfferUrl(inputUrl, record);
  const title = scalar(record.productTitle);
  const seller = scalar(record.shopName);
  if (!canonicalUrl || !title || !seller || record.currencyISO !== 'AED') { return undefined; }
  for (const [parameter, field] of [['offer', 'offerId'], ['sellerId', 'shopId'], ['sid', 'intent']]) {
    const requested = inputUrl.match(new RegExp(`[?&]${parameter}=([^&#]*)`))?.[1];
    // A disappeared offer must never silently become a different seller's price.
    if (requested !== undefined && requested !== encodeURIComponent(String(record[field]))) { return undefined; }
  }
  const availability = carrefourAvailability(record.stockStatus, record.availableQuantity);
  const { priceMinor, priceBasis } = carrefourPrice(record, availability === 'out_of_stock' ? undefined : parsePriceToMinor(scalar(record.price)));
  const imageUrl = scalar(record.image);
  const variant: ProductVariant = {
    id: `${productId}:${record.shopId}:${record.offerId}:${record.intent}`,
    label: `Sold by ${seller}`, attributes: [{ name: 'Seller', value: seller }], url: canonicalUrl,
    priceMinor, priceBasis, currency: 'AED', availability, sku: productId, imageUrl
  };
  return { siteKey: 'carrefour_uae', canonicalUrl, title, imageUrl, priceMinor, priceBasis, currency: 'AED', availability,
    rawPriceText: priceMinor === undefined ? undefined : `${priceMinor / 100}${priceBasis === 'kg' ? ' /kg' : ''}`, sku: productId, variants: [variant] };
}
