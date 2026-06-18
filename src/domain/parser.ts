import { detectSupportedSite, normalizeUrl } from './sites';
import { Availability, ParsedProduct, SiteKey } from './types';
import { parsePriceToMinor } from './price';

type JsonRecord = Record<string, unknown>;

const REQUEST_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AE,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
};

export type ParseProductResult =
  | { ok: true; product: ParsedProduct }
  | { ok: false; code: 'invalid_url' | 'unsupported_page' | 'network_error' | 'blocked' | 'price_not_found' | 'site_parser_failed'; message: string };

export async function fetchAndParseProduct(rawUrl: string): Promise<ParseProductResult> {
  const normalizedUrl = normalizeUrl(rawUrl);
  const site = detectSupportedSite(normalizedUrl);

  if (!site) {
    return {
      ok: false,
      code: 'unsupported_page',
      message: 'This website is not supported in the MVP.'
    };
  }

  let response: Response;
  try {
    response = await fetch(normalizedUrl, {
      headers: REQUEST_HEADERS
    });
  } catch {
    return {
      ok: false,
      code: 'network_error',
      message: 'Could not reach the product page.'
    };
  }

  if (response.status === 401 || response.status === 403 || response.status === 429) {
    return {
      ok: false,
      code: 'blocked',
      message: 'The website blocked this check.'
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      code: 'network_error',
      message: `The website returned ${response.status}.`
    };
  }

  const html = await response.text();
  const parsed = parseProductHtml(site.key, normalizedUrl, html);

  if (!parsed?.title) {
    return {
      ok: false,
      code: 'site_parser_failed',
      message: 'Qeemat could not find product details on this page.'
    };
  }

  if (!parsed.priceMinor || !parsed.currency) {
    return {
      ok: false,
      code: 'price_not_found',
      message: 'Qeemat found the product but could not find a current AED price.'
    };
  }

  return {
    ok: true,
    product: parsed
  };
}

export function parseProductHtml(siteKey: SiteKey, inputUrl: string, html: string): ParsedProduct | undefined {
  const structured = parseStructuredProduct(siteKey, inputUrl, html);

  if (structured?.priceMinor && structured.title) {
    return structured;
  }

  if (siteKey === 'level_shoes') {
    return parseLevelShoesPayload(siteKey, inputUrl, html) ?? structured;
  }

  if (siteKey === 'noon') {
    return parseNoonFallback(siteKey, inputUrl, html) ?? structured;
  }

  return structured;
}

function parseStructuredProduct(siteKey: SiteKey, inputUrl: string, html: string): ParsedProduct | undefined {
  const product = findProductJsonLd(html);
  const meta = extractMeta(html);

  const title = asString(product?.name) ?? meta.title;
  const imageUrl = firstString(product?.image) ?? meta.imageUrl;
  const offer = firstOffer(product?.offers);
  const priceMinor = parsePriceToMinor(asString(offer?.price) ?? meta.price);
  const currency = asString(offer?.priceCurrency) ?? meta.currency ?? 'AED';
  const availability = parseAvailability(asString(offer?.availability));
  const canonicalUrl = asString(offer?.url) ?? meta.canonicalUrl ?? inputUrl;
  const sku = asString(product?.sku) ?? asString(product?.mpn);

  if (!title && !priceMinor) {
    return undefined;
  }

  return {
    siteKey,
    canonicalUrl,
    title: title ? cleanText(title) : 'Untitled product',
    imageUrl,
    priceMinor,
    currency,
    availability,
    rawPriceText: asString(offer?.price) ?? meta.price,
    sku
  };
}

function parseLevelShoesPayload(siteKey: SiteKey, inputUrl: string, html: string): ParsedProduct | undefined {
  const rawSalePrice = matchNumber(html, /"rawSalePrice"\s*:\s*([0-9.]+)/);
  const rawOriginalPrice = matchNumber(html, /"rawOriginalPrice"\s*:\s*([0-9.]+)/);
  const priceMinor = parsePriceToMinor(rawSalePrice ?? rawOriginalPrice);
  const title = matchString(html, /"name"\s*:\s*"([^"]+)"/);
  const imageUrl = matchString(html, /"image"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/);
  const actionUrl = matchString(html, /"action"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/);
  const sku = matchString(html, /"sku"\s*:\s*"([^"]+)"/);
  const inStock = matchBoolean(html, /"isInStock"\s*:\s*(true|false)/);

  if (!title && !priceMinor) {
    return undefined;
  }

  return {
    siteKey,
    canonicalUrl: actionUrl ? absoluteUrl(actionUrl, inputUrl) : inputUrl,
    title: cleanText(title ?? 'Level Shoes product'),
    imageUrl: imageUrl ? unescapeJsonString(imageUrl) : undefined,
    priceMinor,
    currency: 'AED',
    availability: inStock === undefined ? 'unknown' : inStock ? 'in_stock' : 'out_of_stock',
    rawPriceText: rawSalePrice ? String(rawSalePrice) : undefined,
    sku
  };
}

function parseNoonFallback(siteKey: SiteKey, inputUrl: string, html: string): ParsedProduct | undefined {
  const title =
    matchString(html, /"name"\s*:\s*"([^"]{3,180})"/) ??
    matchString(html, /"title"\s*:\s*"([^"]{3,180})"/) ??
    extractMeta(html).title;
  const price = matchNumber(html, /"sale_price"\s*:\s*([0-9.]+)/) ?? matchNumber(html, /"price"\s*:\s*([0-9.]+)/);
  const imageUrl = matchString(html, /"image_url"\s*:\s*"([^"]+)"/) ?? extractMeta(html).imageUrl;
  const sku = matchString(html, /"sku"\s*:\s*"([^"]+)"/);

  if (!title && !price) {
    return undefined;
  }

  return {
    siteKey,
    canonicalUrl: inputUrl,
    title: cleanText(title ?? 'Noon product'),
    imageUrl: imageUrl ? unescapeJsonString(imageUrl) : undefined,
    priceMinor: parsePriceToMinor(price),
    currency: 'AED',
    availability: 'unknown',
    rawPriceText: price ? String(price) : undefined,
    sku
  };
}

function findProductJsonLd(html: string): JsonRecord | undefined {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];

  for (const script of scripts) {
    const jsonText = script.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    const candidates = parseJsonCandidates(jsonText);

    for (const candidate of candidates) {
      const product = findProductRecord(candidate);
      if (product) {
        return product;
      }
    }
  }

  return undefined;
}

function parseJsonCandidates(jsonText: string): unknown[] {
  const decoded = decodeHtmlEntities(jsonText);
  try {
    const parsed = JSON.parse(decoded);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function findProductRecord(value: unknown): JsonRecord | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProductRecord(item);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  const record = value as JsonRecord;
  const type = record['@type'];
  if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
    return record;
  }

  const graph = record['@graph'];
  if (Array.isArray(graph)) {
    return findProductRecord(graph);
  }

  return undefined;
}

function firstOffer(value: unknown): JsonRecord | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.find((item) => item && typeof item === 'object') as JsonRecord | undefined;
  }

  if (typeof value === 'object') {
    return value as JsonRecord;
  }

  return undefined;
}

function extractMeta(html: string) {
  return {
    title:
      getMetaContent(html, 'property', 'og:title') ??
      getMetaContent(html, 'name', 'twitter:title') ??
      matchString(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    imageUrl:
      getMetaContent(html, 'property', 'og:image') ??
      getMetaContent(html, 'name', 'twitter:image') ??
      getMetaContent(html, 'property', 'og:image:secure_url'),
    price:
      getMetaContent(html, 'property', 'product:price:amount') ??
      getMetaContent(html, 'name', 'twitter:data1') ??
      matchString(html, /AED\s?[0-9,]+(?:\.[0-9]{2})?/i),
    currency:
      getMetaContent(html, 'property', 'product:price:currency') ??
      getMetaContent(html, 'name', 'currency') ??
      'AED',
    canonicalUrl: matchString(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
  };
}

function getMetaContent(html: string, attr: 'name' | 'property', value: string): string | undefined {
  const pattern = new RegExp(`<meta[^>]+${attr}=["']${escapeRegExp(value)}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  return matchString(html, pattern);
}

function parseAvailability(value?: string): Availability {
  if (!value) {
    return 'unknown';
  }

  const normalized = value.toLowerCase();
  if (normalized.includes('instock') || normalized.includes('in_stock')) {
    return 'in_stock';
  }

  if (normalized.includes('outofstock') || normalized.includes('out_of_stock') || normalized.includes('soldout')) {
    return 'out_of_stock';
  }

  return 'unknown';
}

function firstString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return asString(value[0]);
  }

  return asString(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return decodeHtmlEntities(unescapeJsonString(value));
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return undefined;
}

function matchString(html: string, pattern: RegExp): string | undefined {
  const match = html.match(pattern);
  if (!match?.[1]) {
    return undefined;
  }

  return decodeHtmlEntities(unescapeJsonString(match[1]));
}

function matchNumber(html: string, pattern: RegExp): number | undefined {
  const match = html.match(pattern);
  if (!match?.[1]) {
    return undefined;
  }

  const parsed = Number.parseFloat(match[1].replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function matchBoolean(html: string, pattern: RegExp): boolean | undefined {
  const match = html.match(pattern);
  if (!match?.[1]) {
    return undefined;
  }

  return match[1] === 'true';
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function unescapeJsonString(value: string): string {
  return value.replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/\\"/g, '"');
}

function cleanText(value: string): string {
  return decodeHtmlEntities(value.replace(/\s+/g, ' ').trim());
}

function absoluteUrl(value: string, base: string): string {
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
