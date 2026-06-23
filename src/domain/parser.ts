import { detectSupportedSite, normalizeUrl } from './sites';
import { Availability, ParsedProduct, SiteKey } from './types';
import { parsePriceToMinor } from './price';

type JsonRecord = Record<string, unknown>;

const REQUEST_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AE,en-US;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
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

  if (isBlockedHtml(html)) {
    return {
      ok: false,
      code: 'blocked',
      message: 'The website blocked this check.'
    };
  }

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
      message: 'Qeemat found the product but could not find a current price.'
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

  if (siteKey === 'ay_accessories') {
    return parseAymProduct(siteKey, inputUrl, html) ?? structured;
  }

  if (siteKey === 'amazon_ae') {
    return parseAmazonProduct(siteKey, inputUrl, html) ?? structured;
  }

  if (siteKey === 'ounass') {
    return parseOunassProduct(siteKey, inputUrl, html) ?? structured;
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
  const priceSpecification = firstPriceSpecification(offer?.priceSpecification);
  const priceMinor = parsePriceToMinor(asString(offer?.price) ?? asString(priceSpecification?.price) ?? meta.price);
  const currency = asString(offer?.priceCurrency) ?? asString(priceSpecification?.priceCurrency) ?? meta.currency ?? 'AED';
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
    rawPriceText: asString(offer?.price) ?? asString(priceSpecification?.price) ?? meta.price,
    sku
  };
}

function parseAymProduct(siteKey: SiteKey, inputUrl: string, html: string): ParsedProduct | undefined {
  const meta = extractMeta(html);
  const variation = firstAymVariation(html);
  const title =
    matchString(html, /<h1[^>]*class=["'][^"']*product_title[^"']*["'][^>]*>\s*([^<]+?)\s*<\/h1>/i) ??
    stripStoreSuffix(meta.title);
  const imageUrl = extractAymVariationImage(variation) ?? meta.imageUrl;
  const rawPriceText = asString(variation?.display_price) ?? extractAymPriceText(html) ?? meta.price;
  const sku =
    cleanSku(asString(variation?.sku)) ??
    cleanSku(matchString(html, /<span class=["']sku["'][^>]*>\s*([^<]+?)\s*<\/span>/i)) ??
    cleanSku(matchString(html, /<span class=["']stl_codenum["'][^>]*>\s*([^<]+?)\s*<\/span>/i));

  if (!title && !rawPriceText) {
    return undefined;
  }

  return {
    siteKey,
    canonicalUrl: meta.canonicalUrl ?? inputUrl,
    title: cleanText(title ?? 'AYM product'),
    imageUrl,
    priceMinor: parsePriceToMinor(rawPriceText),
    currency: 'AED',
    availability: parseAymAvailability(variation, html),
    rawPriceText,
    sku
  };
}

function parseAmazonProduct(siteKey: SiteKey, inputUrl: string, html: string): ParsedProduct | undefined {
  const meta = extractMeta(html);
  const title =
    matchString(html, /id=["']productTitle["'][^>]*>\s*([^<]+?)\s*<\/span>/i) ??
    meta.title ??
    matchString(html, /"title"\s*:\s*"([^"]{3,240})"/);
  const imageUrl =
    matchString(html, /id=["']landingImage["'][^>]+data-old-hires=["']([^"']+)["']/i) ??
    extractAmazonDynamicImageUrl(html) ??
    matchString(html, /id=["']landingImage["'][^>]+src=["']([^"']+)["']/i) ??
    meta.imageUrl;
  const rawPriceText = matchAmazonPriceText(html) ?? meta.price;
  const availabilityText =
    matchString(html, /id=["']availability["'][\s\S]{0,500}?primary-availability-message[^>]*>\s*([^<]+?)\s*</i) ??
    matchString(html, /id=["']availability["'][\s\S]{0,500}?a-color-success[^>]*>\s*([^<]+?)\s*</i) ??
    matchString(html, /id=["']availability["'][\s\S]{0,500}?a-color-price[^>]*>\s*([^<]+?)\s*</i);
  const sku = extractAmazonAsin(inputUrl) ?? matchString(html, /data-csa-c-asin=["']([A-Z0-9]{10})["']/i);
  const currency = inferAmazonCurrency(inputUrl, rawPriceText, meta.currency);

  if (!title && !rawPriceText) {
    return undefined;
  }

  return {
    siteKey,
    canonicalUrl: meta.canonicalUrl ?? inputUrl,
    title: cleanText(title ?? 'Amazon product'),
    imageUrl,
    priceMinor: parsePriceToMinor(rawPriceText),
    currency,
    availability: parseAmazonAvailability(availabilityText, html),
    rawPriceText,
    sku
  };
}

function parseOunassProduct(siteKey: SiteKey, inputUrl: string, html: string): ParsedProduct | undefined {
  const meta = extractMeta(html);
  const productName = matchString(html, /"pdp":\{[\s\S]{0,12000}?"name":"([^"]+)"/);
  const designerName =
    matchString(html, /"pdp":\{[\s\S]{0,12000}?"designerCategoryEnglishName":"([^"]+)"/) ??
    matchString(html, /"pdp":\{[\s\S]{0,12000}?"designerCategoryName":"([^"]+)"/);
  const title = buildOunassTitle(designerName, productName) ?? stripOunassTitle(meta.title);
  const rawPrice = matchNumber(html, /"pdp":\{[\s\S]{0,12000}?"priceInAED":([0-9.]+)/) ?? matchNumber(html, /"pdp":\{[\s\S]{0,12000}?"price":([0-9.]+)/);
  const imageCandidate =
    matchString(html, /"pdp":\{[\s\S]{0,20000}?"images":\[\s*\{[\s\S]{0,1200}?"twoX":"([^"]+)"/) ??
    matchString(html, /"pdp":\{[\s\S]{0,20000}?"images":\[\s*\{[\s\S]{0,1200}?"oneX":"([^"]+)"/) ??
    matchString(html, /"pdp":\{[\s\S]{0,20000}?"thumbnail":"([^"]+)"/) ??
    meta.imageUrl;
  const imageUrl = imageCandidate ? absoluteUrl(imageCandidate, inputUrl) : undefined;
  const sku =
    cleanSku(matchString(html, /"pdp":\{[\s\S]{0,12000}?"visibleSku":"([^"]+)"/)) ??
    cleanSku(matchString(html, /"pdp":\{[\s\S]{0,12000}?"barcode":"([^"]+)"/));
  const outOfStock = matchBoolean(html, /"pdp":\{[\s\S]{0,12000}?"outOfStock":(true|false)/);
  const stock = matchNumber(html, /"pdp":\{[\s\S]{0,16000}?"sizes":\[\{[\s\S]{0,1200}?"stock":([0-9.]+)/);

  if (!title && rawPrice === undefined) {
    return undefined;
  }

  return {
    siteKey,
    canonicalUrl: meta.canonicalUrl ?? inputUrl,
    title: cleanText(title ?? 'Ounass product'),
    imageUrl,
    priceMinor: parsePriceToMinor(rawPrice),
    currency: 'AED',
    availability:
      typeof outOfStock === 'boolean' ? (outOfStock ? 'out_of_stock' : 'in_stock') : stock && stock > 0 ? 'in_stock' : 'unknown',
    rawPriceText: rawPrice === undefined ? undefined : String(rawPrice),
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

function firstAymVariation(html: string): JsonRecord | undefined {
  const match = html.match(/data-product_variations=(["'])([\s\S]*?)\1/i);
  if (!match?.[2]) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(decodeHtmlEntities(match[2]));
    if (!Array.isArray(parsed)) {
      return undefined;
    }

    const variations = parsed.filter((item): item is JsonRecord => !!item && typeof item === 'object' && !Array.isArray(item));
    return variations.find((item) => item['is_in_stock'] === true) ?? variations[0];
  } catch {
    return undefined;
  }
}

function extractAymVariationImage(variation?: JsonRecord): string | undefined {
  const image = variation?.['image'];
  if (!image || typeof image !== 'object' || Array.isArray(image)) {
    return undefined;
  }

  const record = image as JsonRecord;
  return asString(record['full_src']) ?? asString(record['url']) ?? asString(record['src']);
}

function extractAymPriceText(html: string): string | undefined {
  const summarySection =
    matchString(html, /<div class=["'][^"']*wd-single-price[^"']*["'][^>]*>([\s\S]{0,1500}?)<\/div>\s*<\/div>/i) ??
    html;

  return (
    matchString(summarySection, /Current price is:\s*([0-9,]+(?:\.[0-9]{2})?)/i) ??
    matchString(
      summarySection,
      /<ins[^>]*>[\s\S]{0,300}?<span class=["']woocommerce-Price-amount amount["'][^>]*>\s*<bdi>\s*([^<]+?)\s*<span class=["']woocommerce-Price-currencySymbol["'][^>]*>/i
    ) ??
    matchString(summarySection, /Price range:\s*([0-9,]+(?:\.[0-9]{2})?)\s+through/i) ??
    matchString(
      summarySection,
      /<p class=["']price["'][^>]*>[\s\S]{0,600}?<span class=["']woocommerce-Price-amount amount["'][^>]*>\s*<bdi>\s*([^<]+?)\s*<span class=["']woocommerce-Price-currencySymbol["'][^>]*>/i
    )
  );
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

function isBlockedHtml(html: string): boolean {
  const normalized = html.toLowerCase();

  return (
    normalized.includes('sec-if-cpt-container') ||
    normalized.includes('akamai-privacy') ||
    (normalized.includes('powered and protected by') && normalized.includes('akamai')) ||
    (normalized.includes('just a moment') && normalized.includes('cloudflare')) ||
    normalized.includes('challenges.cloudflare.com') ||
    normalized.includes("sorry, we just need to make sure you're not a robot") ||
    normalized.includes('enter the characters you see below') ||
    normalized.includes('type the characters you see in this image') ||
    normalized.includes('automated access to amazon data') ||
    normalized.includes('/errors/validatecaptcha')
  );
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

function firstPriceSpecification(value: unknown): JsonRecord | undefined {
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
  if (normalized.includes('instock') || normalized.includes('in_stock') || normalized.includes('in-stock') || normalized.includes('in stock')) {
    return 'in_stock';
  }

  if (
    normalized.includes('outofstock') ||
    normalized.includes('out_of_stock') ||
    normalized.includes('out-of-stock') ||
    normalized.includes('out of stock') ||
    normalized.includes('soldout')
  ) {
    return 'out_of_stock';
  }

  return 'unknown';
}

function parseAymAvailability(variation: JsonRecord | undefined, html: string): Availability {
  if (typeof variation?.['is_in_stock'] === 'boolean') {
    return variation['is_in_stock'] ? 'in_stock' : 'out_of_stock';
  }

  const variationAvailability = parseAvailability(asString(variation?.['availability_html']));
  if (variationAvailability !== 'unknown') {
    return variationAvailability;
  }

  const stockText = matchString(html, /<p class=["'][^"']*stock[^"']*["'][^>]*>\s*([^<]+?)\s*<\/p>/i);
  const stockStatus = parseAvailability(stockText);
  if (stockStatus !== 'unknown') {
    return stockStatus;
  }

  return parseAvailability(matchString(html, /class=["'][^"']*\b(instock|outofstock)\b[^"']*["']/i));
}

function parseAmazonAvailability(value: string | undefined, html: string): Availability {
  const parsed = parseAvailability(value);
  if (parsed !== 'unknown') {
    return parsed;
  }

  const normalizedValue = value?.toLowerCase() ?? '';
  if (normalizedValue.includes('in stock')) {
    return 'in_stock';
  }

  if (normalizedValue.includes('currently unavailable') || normalizedValue.includes('temporarily out of stock')) {
    return 'out_of_stock';
  }

  const normalizedHtml = html.toLowerCase();
  if (normalizedHtml.includes('primary-availability-message') && normalizedHtml.includes('in stock')) {
    return 'in_stock';
  }

  if (normalizedHtml.includes('currently unavailable')) {
    return 'out_of_stock';
  }

  return 'unknown';
}

function matchAmazonPriceText(html: string): string | undefined {
  const priceToPayOffscreen = firstAmazonPriceText(
    matchString(
      html,
      /class=["'][^"']*priceToPay[^"']*["'][^>]*>\s*<span class=["']a-offscreen["']>\s*([^<]*\d[^<]*)\s*<\/span>/i
    ),
    matchString(
      html,
      /class=["'][^"']*apex-pricetopay-value[^"']*["'][\s\S]{0,200}?<span class=["']a-offscreen["']>\s*([^<]*\d[^<]*)\s*<\/span>/i
    )
  );
  if (priceToPayOffscreen) {
    return priceToPayOffscreen;
  }

  const apexPrice = html.match(
    /priceToPay[^>]*>[\s\S]{0,400}?<span class=["']a-price-symbol["']>\s*([^<]*)\s*<\/span>\s*<span class=["']a-price-whole["']>\s*([^<]+?)\s*(?:<span class=["']a-price-decimal["'][^>]*>\s*.\s*<\/span>)?\s*<\/span>\s*<span class=["']a-price-fraction["']>\s*([^<]+)\s*<\/span>/i
  );
  if (apexPrice) {
    const symbol = cleanText(apexPrice[1] ?? 'AED');
    const whole = cleanText(apexPrice[2] ?? '').replace(/\.$/, '');
    const fraction = cleanText(apexPrice[3] ?? '');
    if (whole && fraction) {
      return `${symbol} ${whole}.${fraction}`;
    }
  }

  return firstAmazonPriceText(
    matchString(html, /id=["']tp_price_block_total_price_ww["'][\s\S]{0,200}?<span class=["']a-offscreen["']>\s*([^<]*\d[^<]*)\s*<\/span>/i),
    matchString(html, /id=["']corePriceDisplay_desktop_feature_div["'][\s\S]{0,6000}?<span class=["']a-offscreen["']>\s*([^<]*\d[^<]*)\s*<\/span>/i),
    matchString(html, /<span class=["']a-offscreen["']>\s*([^<]*\d[^<]*)\s*<\/span>/i)
  );
}

function extractAmazonDynamicImageUrl(html: string): string | undefined {
  const dynamicImageJson = matchString(html, /id=["']landingImage["'][^>]+data-a-dynamic-image=["']([^"']+)["']/i);
  if (!dynamicImageJson) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(dynamicImageJson) as Record<string, [number, number]>;
    const urls = Object.keys(parsed);
    if (urls.length === 0) {
      return undefined;
    }

    return urls.sort((left, right) => {
      const [leftWidth = 0, leftHeight = 0] = parsed[left] ?? [];
      const [rightWidth = 0, rightHeight = 0] = parsed[right] ?? [];
      return rightWidth * rightHeight - leftWidth * leftHeight;
    })[0];
  } catch {
    return undefined;
  }
}

function extractAmazonAsin(inputUrl: string): string | undefined {
  const match = inputUrl.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return match?.[1]?.toUpperCase();
}

function inferAmazonCurrency(inputUrl: string, rawPriceText?: string, fallbackCurrency?: string): string {
  const codeMatch = rawPriceText?.match(/(?:^|\b)([A-Z]{3})(?=\s|\d|$)/);
  if (codeMatch?.[1]) {
    return codeMatch[1];
  }

  if (rawPriceText?.includes('€')) {
    return 'EUR';
  }

  if (rawPriceText?.includes('£')) {
    return 'GBP';
  }

  if (rawPriceText?.includes('¥')) {
    return 'JPY';
  }

  if (rawPriceText?.includes('₹')) {
    return 'INR';
  }

  if (rawPriceText?.includes('zł')) {
    return 'PLN';
  }

  if (rawPriceText?.includes('kr')) {
    const hostname = safeHostname(inputUrl);
    if (hostname?.endsWith('amazon.se')) {
      return 'SEK';
    }
  }

  if (rawPriceText?.includes('$')) {
    const hostname = safeHostname(inputUrl);
    if (hostname?.endsWith('amazon.ca')) {
      return 'CAD';
    }
    if (hostname?.endsWith('amazon.com.au')) {
      return 'AUD';
    }
    if (hostname?.endsWith('amazon.com.mx')) {
      return 'MXN';
    }
    if (hostname?.endsWith('amazon.sg')) {
      return 'SGD';
    }
    if (hostname?.endsWith('amazon.com.br')) {
      return 'BRL';
    }
    return 'USD';
  }

  const hostname = safeHostname(inputUrl);
  if (!hostname) {
    return fallbackCurrency ?? 'AED';
  }

  if (hostname.endsWith('amazon.ae')) return 'AED';
  if (hostname.endsWith('amazon.co.uk')) return 'GBP';
  if (hostname.endsWith('amazon.de')) return 'EUR';
  if (hostname.endsWith('amazon.fr')) return 'EUR';
  if (hostname.endsWith('amazon.it')) return 'EUR';
  if (hostname.endsWith('amazon.es')) return 'EUR';
  if (hostname.endsWith('amazon.nl')) return 'EUR';
  if (hostname.endsWith('amazon.com.be')) return 'EUR';
  if (hostname.endsWith('amazon.pl')) return 'PLN';
  if (hostname.endsWith('amazon.se')) return 'SEK';
  if (hostname.endsWith('amazon.eg')) return 'EGP';
  if (hostname.endsWith('amazon.com.sa')) return 'SAR';
  if (hostname.endsWith('amazon.com.tr')) return 'TRY';
  if (hostname.endsWith('amazon.co.jp')) return 'JPY';
  if (hostname.endsWith('amazon.sg')) return 'SGD';
  if (hostname.endsWith('amazon.ca')) return 'CAD';
  if (hostname.endsWith('amazon.com.au')) return 'AUD';
  if (hostname.endsWith('amazon.com.mx')) return 'MXN';
  if (hostname.endsWith('amazon.com.br')) return 'BRL';
  if (hostname.endsWith('amazon.com')) return 'USD';

  return fallbackCurrency ?? 'AED';
}

function firstAmazonPriceText(...candidates: Array<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    const normalized = candidate ? cleanText(candidate) : undefined;
    if (!normalized || !/\d/.test(normalized)) {
      continue;
    }

    if (parsePriceToMinor(normalized) !== undefined) {
      return normalized;
    }
  }

  return undefined;
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

function buildOunassTitle(designerName?: string, productName?: string): string | undefined {
  if (!designerName && !productName) {
    return undefined;
  }

  if (!designerName) {
    return productName;
  }

  if (!productName) {
    return designerName;
  }

  return productName.toLowerCase().startsWith(designerName.toLowerCase()) ? productName : `${designerName} ${productName}`;
}

function safeHostname(value: string): string | undefined {
  const match = value.match(/^(?:https?:\/\/)?([^/?#]+)/i);
  return match?.[1]?.toLowerCase();
}

function cleanSku(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const cleaned = cleanText(value);
  if (!cleaned || /^n\/a$/i.test(cleaned)) {
    return undefined;
  }

  return cleaned;
}

function stripStoreSuffix(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return cleanText(value.replace(/\s*-\s*(?:Al Yousuf Accessories|AY Accessories)\s*$/i, ''));
}

function stripOunassTitle(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return cleanText(value.replace(/^Buy\s+/i, '').replace(/\s+Online\s*\|\s*Ounass UAE\s*$/i, ''));
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
