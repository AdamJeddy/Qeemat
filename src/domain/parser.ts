import { cleanUrl, detectSupportedSite, normalizeUrl } from './sites';
import { Availability, ParsedProduct, ProductVariant, SiteKey, VariantAttribute, VariantSelection } from './types';
import { parsePriceToMinor } from './price';
import { fetchPageHtmlViaWebView } from './webViewFetcher';
import { findTrackedVariant } from './variants';

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const REQUEST_HEADERS: Record<string, string> = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-AE,en-US;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
};

/**
 * BFL is behind Cloudflare which detects non-browser TLS fingerprints.
 * We try two strategies:
 *   1. Standard fetch with Chrome-on-Android headers that are self-consistent
 *   2. If blocked, fall back to native WebView (uses real Chrome TLS)
 *
 * Chrome-on-Android headers are used (instead of iOS Safari) because the
 * app runs on Android and Cloudflare may find a cross-platform UA suspicious
 * when combined with Android's OkHttp TLS fingerprint.
 */
const ANDROID_CHROME_REQUEST_HEADERS: Record<string, string> = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-AE,en-US;q=0.9,en;q=0.8',
  'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?1',
  'Sec-Ch-Ua-Platform': '"Android"',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.165 Mobile Safari/537.36'
};

const SEPHORA_REQUEST_HEADERS: Record<string, string> = {
  ...REQUEST_HEADERS,
  'Sec-Ch-Ua': '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
};

function getRequestHeaders(siteKey: SiteKey): Record<string, string> {
  // Decathlon accepts Android's native request profile but rejects browser
  // impersonation when the TLS client is not a browser.
  if (siteKey === 'decathlon_uae') {
    return {};
  }

  if (siteKey === 'brands_for_less') {
    return ANDROID_CHROME_REQUEST_HEADERS;
  }
  if (siteKey === 'sephora_uae') {
    return SEPHORA_REQUEST_HEADERS;
  }
  return REQUEST_HEADERS;
}

export type ParseProductResult =
  | { ok: true; product: ParsedProduct }
  | { ok: false; code: 'invalid_url' | 'unsupported_page' | 'network_error' | 'blocked' | 'price_not_found' | 'variant_not_found' | 'site_parser_failed'; message: string };

export async function fetchAndParseProduct(rawUrl: string, selectedVariant?: VariantSelection): Promise<ParseProductResult> {
  // Some stores expose each configuration through a distinct product URL.
  // Re-fetch that source URL for a saved selection instead of checking the
  // parent page and hoping its default option still matches.
  const normalizedUrl = cleanUrl(normalizeUrl(selectedVariant?.url || rawUrl));
  const site = detectSupportedSite(normalizedUrl);

  if (!site) {
    return {
      ok: false,
      code: 'unsupported_page',
      message: 'This website is not supported in the MVP.'
    };
  }

  // Primary path: standard fetch (fast, works for most sites)
  let fetchResult = await fetchAndParseWithFetch(normalizedUrl, site.key, selectedVariant);

  // Sephora's CDN can reject one request and accept the same product URL on
  // the next attempt. Retry the exact URL once before using the WebView path.
  if (
    site.key === 'sephora_uae' &&
    !fetchResult.ok &&
    (fetchResult.code === 'blocked' || fetchResult.code === 'network_error')
  ) {
    fetchResult = await fetchAndParseWithFetch(normalizedUrl, site.key, selectedVariant);
  }

  // Sephora and Faces can redirect native clients through a session-establishing
  // storefront route. Their WebView path handles that first-page navigation.
  if (fetchResult.ok) {
    return fetchResult;
  }

  const shouldUseWebViewFallback = fetchResult.code === 'blocked' ||
    ((site.key === 'sephora_uae' || site.key === 'faces_uae') && fetchResult.code === 'network_error');
  if (!shouldUseWebViewFallback) {
    return fetchResult;
  }

  // Fetch was blocked — try WebView fallback for Cloudflare-protected sites
  const webViewHtml = await fetchPageHtmlViaWebView(normalizedUrl);
  if (!webViewHtml) {
    return fetchResult; // WebView unavailable, return original block error
  }

  const parsed = parseProductHtml(site.key, normalizedUrl, webViewHtml, selectedVariant);

  if (!parsed?.title) {
    return {
      ok: false,
      code: 'site_parser_failed',
      message: 'Qeemat could not find product details on this page.'
    };
  }

  if (selectedVariant && !parsed.selectedVariant) {
    return {
      ok: false,
      code: 'variant_not_found',
      message: 'The selected product option is no longer available on this page.'
    };
  }

  if (!parsed.priceMinor || !parsed.currency) {
    if (parsed.availability === 'out_of_stock') {
      return { ok: true, product: parsed };
    }
    return {
      ok: false,
      code: 'price_not_found',
      message: 'Qeemat found the product but could not find a current price.'
    };
  }

  return { ok: true, product: parsed };
}

async function fetchAndParseWithFetch(
  normalizedUrl: string,
  siteKey: SiteKey,
  selectedVariant?: VariantSelection
): Promise<ParseProductResult> {
  let response: Response;
  try {
    response = await fetch(normalizedUrl, {
      headers: getRequestHeaders(siteKey)
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

  const parsed = parseProductHtml(siteKey, normalizedUrl, html, selectedVariant);

  if (!parsed?.title) {
    return {
      ok: false,
      code: 'site_parser_failed',
      message: 'Qeemat could not find product details on this page.'
    };
  }

  if (selectedVariant && !parsed.selectedVariant) {
    return {
      ok: false,
      code: 'variant_not_found',
      message: 'The selected product option is no longer available on this page.'
    };
  }

  // OOS products may legitimately lack a price — allow success with just title + OOS availability
  if (!parsed.priceMinor || !parsed.currency) {
    if (parsed.availability === 'out_of_stock') {
      return {
        ok: true,
        product: parsed
      };
    }
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

export function parseProductHtml(
  siteKey: SiteKey,
  inputUrl: string,
  html: string,
  selectedVariant?: VariantSelection
): ParsedProduct | undefined {
  // Detect 404 / product-not-found pages that still serve product meta
  if (isProduct404Page(html)) {
    return undefined;
  }

  const structured = parseStructuredProduct(siteKey, inputUrl, html);

  // Only short-circuit on structured data when it has explicit availability info.
  // If availability is unknown, fall through to site-specific parsers which may
  // have better OOS detection (e.g. Amazon availability div, Noon embedded JSON).
  //
  // Level Shoes JSON-LD only reflects the default/selected variant and is
  // unreliable for multi-variant products — always fall through to the
  // site-specific parser which checks all variants.
  if (
    structured?.priceMinor &&
    structured.title &&
    structured.availability !== 'unknown' &&
    siteKey !== 'level_shoes' &&
    siteKey !== 'ay_accessories' &&
    siteKey !== 'ounass' &&
    siteKey !== 'nike_uae' &&
    siteKey !== 'sun_sand_sports' &&
    siteKey !== 'adidas' &&
    siteKey !== 'puma_uae' &&
    siteKey !== 'decathlon_uae' &&
    siteKey !== 'centrepoint_uae' &&
    siteKey !== 'namshi' &&
    siteKey !== 'sharaf_dg'
  ) {
    return resolveParsedVariant(structured, selectedVariant);
  }

  if (siteKey === 'ay_accessories') {
    return resolveParsedVariant(parseAymProduct(siteKey, inputUrl, html) ?? structured, selectedVariant);
  }

  if (siteKey === 'amazon_ae') {
    return resolveParsedVariant(parseAmazonProduct(siteKey, inputUrl, html) ?? structured, selectedVariant);
  }

  if (siteKey === 'ounass') {
    return resolveParsedVariant(parseOunassProduct(siteKey, inputUrl, html) ?? structured, selectedVariant);
  }

  if (siteKey === 'level_shoes') {
    return resolveParsedVariant(parseLevelShoesPayload(siteKey, inputUrl, html) ?? structured, selectedVariant);
  }

  if (siteKey === 'nike_uae' || siteKey === 'sun_sand_sports') {
    return resolveParsedVariant(withProductVariants(structured, extractDemandwareSizeVariants(html, structured)), selectedVariant);
  }

  if (siteKey === 'noon') {
    return resolveParsedVariant(parseNoonFallback(siteKey, inputUrl, html) ?? structured, selectedVariant);
  }

  if (siteKey === 'adidas') {
    const adidasProduct = parseAdidasProduct(siteKey, inputUrl, html);
    const product = structured?.priceMinor
      ? {
          ...structured,
          availability: structured.availability === 'unknown' ? parseAdidasAvailability(html) : structured.availability
        }
      : adidasProduct ?? structured;
    return resolveParsedVariant(withProductVariants(product, extractAdidasSizeVariants(html, product)), selectedVariant);
  }

  if (siteKey === 'puma_uae') {
    const product = structured ? { ...structured, canonicalUrl: inputUrl } : undefined;
    return resolveParsedVariant(withProductVariants(product, extractPumaSizeVariants(html, product)), selectedVariant);
  }

  if (siteKey === 'decathlon_uae') {
    return resolveParsedVariant(parseDecathlonProduct(siteKey, inputUrl, html) ?? structured, selectedVariant);
  }

  if (siteKey === 'centrepoint_uae') {
    return resolveParsedVariant(parseCentrepointProduct(siteKey, inputUrl, html, structured) ?? structured, selectedVariant);
  }

  if (siteKey === 'brands_for_less') {
    return resolveParsedVariant(parseBFLProduct(siteKey, inputUrl, html) ?? structured, selectedVariant);
  }

  if (siteKey === 'namshi') {
    return resolveParsedVariant(parseNamshiProduct(siteKey, inputUrl, html, structured) ?? structured, selectedVariant);
  }

  if (siteKey === 'sharaf_dg') {
    return resolveParsedVariant(parseSharafDgProduct(siteKey, inputUrl, html, structured) ?? structured, selectedVariant);
  }

  return resolveParsedVariant(structured, selectedVariant);
}

function resolveParsedVariant(product: ParsedProduct | undefined, selectedVariant?: VariantSelection): ParsedProduct | undefined {
  if (!product || !selectedVariant) {
    return product;
  }

  const variant = findTrackedVariant(product.variants ?? [], selectedVariant);
  if (!variant) {
    return product;
  }

  const isOutOfStock = variant.availability === 'out_of_stock';
  return {
    ...product,
    imageUrl: variant.imageUrl ?? product.imageUrl,
    priceMinor: isOutOfStock ? undefined : variant.priceMinor,
    currency: variant.currency ?? product.currency,
    availability: variant.availability,
    rawPriceText: isOutOfStock || variant.priceMinor === undefined ? undefined : String(variant.priceMinor / 100),
    sku: variant.sku ?? product.sku,
    selectedVariant
  };
}

function withProductVariants(product: ParsedProduct | undefined, variants: ProductVariant[]): ParsedProduct | undefined {
  if (!product || variants.length === 0) {
    return product;
  }

  return { ...product, variants };
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

/**
 * Decathlon UAE embeds Shopify's complete ProductJson payload in the initial
 * page response. Its variant IDs, options, availability, and prices are all
 * source-provided, so the selected option can be resolved without a request
 * to a variant-specific URL.
 */
function parseDecathlonProduct(siteKey: SiteKey, inputUrl: string, html: string): ParsedProduct | undefined {
  const product = extractDecathlonProductJson(html);
  if (!product) {
    return undefined;
  }

  const title = asString(product.title);
  const rawOptionNames = Array.isArray(product.options) ? product.options : [];
  const optionNames = rawOptionNames.map(asString);
  const options = optionNames.every((option): option is string => Boolean(option?.trim()))
    ? optionNames.map(cleanText)
    : [];
  const sourceVariants = Array.isArray(product.variants) ? product.variants : [];
  const rawVariants = sourceVariants.filter(isJsonRecord);
  const variants = rawVariants
    .map((variant) => parseDecathlonVariant(variant, options))
    .filter((variant): variant is ProductVariant => variant !== undefined);
  const hasCompleteVariants =
    options.length > 0 &&
    rawVariants.length > 0 &&
    rawVariants.length === sourceVariants.length &&
    variants.length === rawVariants.length;
  const defaultVariant = variants.find((variant) => variant.availability === 'in_stock') ?? variants[0];
  const imageUrl = extractDecathlonImage(product) ?? defaultVariant?.imageUrl;

  if (!title && !defaultVariant && !asIdentifier(product.id)) {
    return undefined;
  }

  if (hasCompleteVariants && defaultVariant) {
    return {
      siteKey,
      canonicalUrl: inputUrl,
      title: title ? cleanText(title) : 'Untitled product',
      imageUrl,
      priceMinor: defaultVariant.priceMinor,
      currency: defaultVariant.currency,
      availability: variants.some((variant) => variant.availability === 'in_stock') ? 'in_stock' : 'out_of_stock',
      rawPriceText: defaultVariant.priceMinor === undefined ? undefined : String(defaultVariant.priceMinor / 100),
      sku: defaultVariant.sku,
      variants
    };
  }

  const priceMinor = parseDecathlonPriceMinor(product.price);
  if (!title && priceMinor === undefined) {
    return undefined;
  }

  return {
    siteKey,
    canonicalUrl: inputUrl,
    title: title ? cleanText(title) : 'Untitled product',
    imageUrl,
    priceMinor,
    currency: 'AED',
    availability: product.available === true ? 'in_stock' : product.available === false ? 'out_of_stock' : 'unknown',
    rawPriceText: priceMinor === undefined ? undefined : String(priceMinor / 100),
    sku: asIdentifier(product.id)
  };
}

function extractDecathlonProductJson(html: string): JsonRecord | undefined {
  const match = html.match(/<script\b(?=[^>]*\bid=["']ProductJson["'])[^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) {
    return undefined;
  }

  return parseJsonCandidates(match[1]).find(isJsonRecord);
}

function parseDecathlonVariant(variant: JsonRecord, optionNames: string[]): ProductVariant | undefined {
  const id = asIdentifier(variant.id);
  const priceMinor = parseDecathlonPriceMinor(variant.price);
  if (!id || priceMinor === undefined || typeof variant.available !== 'boolean' || optionNames.length === 0) {
    return undefined;
  }

  const optionValues = Array.isArray(variant.options)
    ? variant.options.map(asString)
    : optionNames.map((_, index) => asString(variant[`option${index + 1}`]));
  const attributes = optionNames.flatMap((name, index) => {
    const value = optionValues[index];
    return value?.trim() ? [{ name, value: cleanText(value) }] : [];
  });
  if (attributes.length !== optionNames.length) {
    return undefined;
  }

  return {
    id,
    label: formatVariantLabel(attributes),
    attributes,
    priceMinor,
    currency: 'AED',
    availability: variant.available ? 'in_stock' : 'out_of_stock',
    sku: cleanSku(asString(variant.sku)) ?? id,
    imageUrl: extractDecathlonImage(variant)
  };
}

function parseDecathlonPriceMinor(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }

  return undefined;
}

function extractDecathlonImage(value: JsonRecord): string | undefined {
  const featuredImage = value.featured_image;
  const source =
    asString(featuredImage) ??
    (isJsonRecord(featuredImage) ? asString(featuredImage.src) : undefined) ??
    (isJsonRecord(value.featured_media) && isJsonRecord(value.featured_media.preview_image)
      ? asString(value.featured_media.preview_image.src)
      : undefined);

  if (!source) {
    return undefined;
  }

  return source.startsWith('//') ? `https:${source}` : source;
}

function parseAymProduct(siteKey: SiteKey, inputUrl: string, html: string): ParsedProduct | undefined {
  const meta = extractMeta(html);
  const variation = firstAymVariation(html);
  const variants = extractAymVariants(html);
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
    sku,
    variants
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
  const availabilityText =
    matchString(html, /id=["']availability["'][\s\S]{0,8000}?primary-availability-message[^>]*>\s*([^<]+?)\s*</i) ??
    matchString(html, /id=["']availability["'][\s\S]{0,8000}?a-color-success[^>]*>\s*([^<]+?)\s*</i) ??
    matchString(html, /id=["']availability["'][\s\S]{0,8000}?a-color-price[^>]*>\s*([^<]+?)\s*</i);
  const availability = parseAmazonAvailability(availabilityText, html);
  // An OOS page can include prices from recommendation carousels. They do not
  // describe the tracked product, so leave the price unset and preserve the
  // product's last known value in storage.
  const rawPriceText = availability === 'out_of_stock' ? undefined : matchAmazonPriceText(html);
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
    availability,
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
  const variants = extractOunassVariants(html);
  const hasInStockVariant = variants.some((variant) => variant.availability === 'in_stock');

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
      typeof outOfStock === 'boolean'
        ? outOfStock
          ? 'out_of_stock'
          : variants.length > 0
            ? hasInStockVariant ? 'in_stock' : 'out_of_stock'
            : 'in_stock'
        : variants.length > 0
          ? hasInStockVariant ? 'in_stock' : 'out_of_stock'
          : 'unknown',
    rawPriceText: rawPrice === undefined ? undefined : String(rawPrice),
    sku,
    variants
  };
}

function parseLevelShoesPayload(siteKey: SiteKey, inputUrl: string, html: string): ParsedProduct | undefined {
  // Prefer __NEXT_DATA__ productDetails for accurate price/name — loose regex
  // on the full HTML picks up sizeOption prices (e.g. 590 vs actual 470).
  const pdp = extractLevelShoesPdp(html);

  // Price: try productDetails, then JSON-LD (more reliable than loose regex),
  // then full-HTML regex as last resort.
  const rawSalePrice =
    pdp?.rawSalePrice ??
    extractJsonLdPrice(html) ??
    matchNumber(html, /"rawSalePrice"\s*:\s*([0-9.]+)/);
  const rawOriginalPrice =
    pdp?.rawOriginalPrice ??
    matchNumber(html, /"rawOriginalPrice"\s*:\s*([0-9.]+)/);
  const priceMinor = parsePriceToMinor(rawSalePrice ?? rawOriginalPrice);

  const title = pdp?.name ?? matchString(html, /"name"\s*:\s*"([^"]+)"/);
  const imageUrl =
    pdp?.imageUrl ??
    matchString(html, /"image"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/);
  const actionUrl = pdp?.canonicalUrl ?? matchString(html, /"action"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/);
  const sku = pdp?.sku ?? matchString(html, /"sku"\s*:\s*"([^"]+)"/);
  const stockValues = pdp?.stockValues ?? [...html.matchAll(/"isInStock"\s*:\s*(true|false)/g)];
  const anyInStock = stockValues.some(m => typeof m === 'string' ? m === 'true' : m[1] === 'true');
  const anyOos = stockValues.some(m => typeof m === 'string' ? m === 'false' : m[1] === 'false');
  const inStock: boolean | undefined =
    stockValues.length === 0 ? undefined : anyInStock ? true : anyOos ? false : undefined;

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
    sku,
    variants: pdp?.variants
  };
}

/** Extract the price from JSON-LD Offer (schema.org structured data). More
 *  reliable than loose regex because it's scoped to the Offer block. */
function extractJsonLdPrice(html: string): number | undefined {
  const ldMatch = html.match(/"@type"\s*:\s*"Offer"[\s\S]{0,800}?"price"\s*:\s*([0-9.]+)/);
  return ldMatch ? Number(ldMatch[1]) : undefined;
}

function extractLevelShoesPdp(html: string): {
  rawSalePrice?: number;
  rawOriginalPrice?: number;
  name?: string;
  imageUrl?: string;
  canonicalUrl?: string;
  sku?: string;
  stockValues?: (string | RegExpMatchArray)[];
  variants?: ProductVariant[];
} | undefined {
  const ndMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]+type="application\/json"[^>]*>([\s\S]+?)<\/script>/);
  if (!ndMatch) return undefined;

  try {
    const json = JSON.parse(ndMatch[1]);
    const pd = json?.props?.pageProps?.productDetails;
    if (!pd) return undefined;

    const productId = asIdentifier(pd.id);
    const apolloState = json?.props?.pageProps?.__APOLLO_STATE__;
    const apolloProduct =
      productId && apolloState && typeof apolloState === 'object' && !Array.isArray(apolloState)
        ? (apolloState as JsonRecord)[`ProductDetails:${productId}`]
        : undefined;
    const apolloDetail =
      apolloProduct && typeof apolloProduct === 'object' && !Array.isArray(apolloProduct)
        ? (apolloProduct as JsonRecord).detail
        : undefined;

    const name = typeof pd.name === 'string' ? pd.name : undefined;
    const sku = typeof pd.sku === 'string' ? pd.sku : typeof pd.vpn === 'string' ? pd.vpn : undefined;
    const imageUrl = pd.image?.url ?? pd.imagePreviewGallery?.[0]?.url ?? undefined;
    const canonicalUrl = pd.action?.url ?? undefined;

    // Collect sizeOptions for variant-level stock + price fallback
    const sizeOptions: unknown[] = Array.isArray(pd.sizeOptions)
      ? pd.sizeOptions
      : apolloDetail && typeof apolloDetail === 'object' && !Array.isArray(apolloDetail) && Array.isArray((apolloDetail as JsonRecord).sizeOptions)
        ? (apolloDetail as JsonRecord).sizeOptions as unknown[]
        : [];
    const stockValues: string[] = [];
    const variants: ProductVariant[] = [];

    // Primary price from productDetails
    let rawSalePrice: number | undefined =
      typeof pd.rawSalePrice === 'number' ? pd.rawSalePrice : undefined;
    let rawOriginalPrice: number | undefined =
      typeof pd.rawOriginalPrice === 'number' ? pd.rawOriginalPrice : undefined;

    for (const opt of sizeOptions) {
      if (opt && typeof opt === 'object' && 'isInStock' in opt) {
        const rec = opt as Record<string, unknown>;
        stockValues.push(rec.isInStock ? 'true' : 'false');

        // Fallback: if productDetails lacks a price, use the first in-stock
        // variant's price (sizeOption prices can differ from the top-level
        // product price but are still valid).
        if (rawSalePrice === undefined && rec.isInStock && typeof rec.rawSalePrice === 'number') {
          rawSalePrice = rec.rawSalePrice as number;
        }
        if (rawOriginalPrice === undefined && typeof rec.rawOriginalPrice === 'number') {
          rawOriginalPrice = rec.rawOriginalPrice as number;
        }

        const id = asIdentifier(rec.sku) ?? asIdentifier(rec.id) ?? asIdentifier(rec.value);
        const size = asString(rec.label) ?? asString(rec.name) ?? asString(rec.value);
        const priceMinor = parsePriceToMinor(asPriceValue(rec.rawSalePrice) ?? rawSalePrice ?? rawOriginalPrice);
        if (id && size && priceMinor !== undefined && typeof rec.isInStock === 'boolean') {
          const attributes = [{ name: 'Size', value: cleanText(size) }];
          variants.push({
            id,
            label: formatVariantLabel(attributes),
            attributes,
            priceMinor,
            currency: 'AED',
            availability: rec.isInStock === true ? 'in_stock' : 'out_of_stock',
            sku: asString(rec.sku) ?? id
          });
        }
      }
    }

    const htmlStockValues = stockValues.length === 0
      ? [...html.matchAll(/"isInStock"\s*:\s*(true|false)/g)]
      : undefined;

    return {
      rawSalePrice,
      rawOriginalPrice,
      name,
      imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
      canonicalUrl: typeof canonicalUrl === 'string' ? canonicalUrl : undefined,
      sku,
      stockValues: htmlStockValues ?? stockValues,
      variants
    };
  } catch {
    return undefined;
  }
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
    availability: detectNoonOos(html),
    rawPriceText: price ? String(price) : undefined,
    sku
  };
}

/**
 * Adidas.ae (Salesforce Commerce Cloud) product parser.
 * Falls back to meta tags and inline JSON when JSON-LD structured data
 * is missing or incomplete.
 */
function parseAdidasProduct(siteKey: SiteKey, inputUrl: string, html: string): ParsedProduct | undefined {
  const meta = extractMeta(html);
  const sdkData = extractAdidasSdkData(html);

  const title =
    sdkData?.name ??
    matchString(html, /class=["'][^"']*product-name[^"']*["'][^>]*>\s*([^<]+?)\s*</i) ??
    meta.title;
  const imageUrl =
    sdkData?.image ??
    matchString(html, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ??
    matchString(html, /class=["'][^"']*primary-image[^"']*["'][^>]+src=["']([^"']+)["']/i) ??
    meta.imageUrl;
  const rawPriceText =
    sdkData?.price ??
    matchString(html, /class=["'][^"']*sales-price[^"']*["'][^>]*>\s*([^<]+?)\s*</i) ??
    meta.price;
  const sku =
    cleanSku(sdkData?.id) ??
    cleanSku(matchString(html, /data-pid=["']([^"']+)["']/i)) ??
    cleanSku(matchString(html, /data-master-id=["']([^"']+)["']/i));

  if (!title && !rawPriceText) {
    return undefined;
  }

  return {
    siteKey,
    canonicalUrl: meta.canonicalUrl ?? inputUrl,
    title: cleanText(title ?? 'Adidas product'),
    imageUrl,
    priceMinor: parsePriceToMinor(rawPriceText),
    currency: 'AED',
    availability: parseAdidasAvailability(html, sdkData?.availability),
    rawPriceText: rawPriceText ? String(rawPriceText) : undefined,
    sku
  };
}

/**
 * Extract product data from embedded Salesforce Commerce Cloud JSON payloads
 * that Adidas.ae injects into the page.
 */
function extractAdidasSdkData(html: string): Record<string, string> | undefined {
  // SFCC product pages often inject product data into a script tag
  // Try several common variable names
  const patterns = [
    /"product"\s*:\s*\{[\s\S]{0,2000}?"name"\s*:\s*"([^"]+)"/,
    /window\.__INITIAL_STATE__[\s\S]{0,3000}?"name"\s*:\s*"([^"]+)"/,
    /"analytics"\s*:\s*\{[\s\S]{0,3000}?"productName"\s*:\s*"([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const name = matchString(html, pattern);
    if (name) {
      return { name };
    }
  }

  return undefined;
}

/**
 * Determine availability from Adidas.ae product page signals.
 */
function parseAdidasAvailability(html: string, sdkAvailability?: string): Availability {
  // Check SFCC stock status classes / text
  const normalized = html.toLowerCase();

  // Explicit OOS indicators
  if (
    normalized.includes('class="out-of-stock"') ||
    normalized.includes('data-available="false"') ||
    normalized.includes('data-stock="0"') ||
    normalized.includes('sold out') ||
    normalized.includes('out of stock') ||
    normalized.includes('currently unavailable')
  ) {
    return 'out_of_stock';
  }

  // In-stock indicators
  if (
    normalized.includes('data-available="true"') ||
    normalized.includes('class="in-stock"') ||
    normalized.includes('in stock') ||
    normalized.includes('add to bag') ||
    normalized.includes('add to cart')
  ) {
    return 'in_stock';
  }

  // SDK availability string
  return parseAvailability(sdkAvailability);
}

/**
 * Centrepoint renders source option buttons in the initial product response.
 * Numeric button IDs identify sizes, while color-only pages can retain the
 * current product ID from the route without guessing URLs for neighboring
 * colors.
 */
function parseCentrepointProduct(
  siteKey: SiteKey,
  inputUrl: string,
  html: string,
  structured?: ParsedProduct
): ParsedProduct | undefined {
  const jsonLdProduct = findProductJsonLd(html);
  const offer = firstOffer(jsonLdProduct?.offers);
  const meta = extractMeta(html);
  const title = structured?.title ?? asString(jsonLdProduct?.name) ?? matchString(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i) ?? meta.title;
  const rawPriceText = structured?.rawPriceText ?? asString(offer?.price) ?? meta.price;
  const priceMinor = structured?.priceMinor ?? parsePriceToMinor(rawPriceText);
  const currency = structured?.currency ?? asString(offer?.priceCurrency) ?? meta.currency ?? 'AED';
  const availability = structured?.availability && structured.availability !== 'unknown'
    ? structured.availability
    : parseCentrepointAvailability(html);
  const productId = extractCentrepointProductId(inputUrl);
  const sku = structured?.sku ?? cleanSku(productId);

  if (!title && priceMinor === undefined) {
    return undefined;
  }

  const product: ParsedProduct = {
    siteKey,
    canonicalUrl: structured?.canonicalUrl ?? meta.canonicalUrl ?? inputUrl,
    title: cleanText(title ?? 'Centrepoint product'),
    imageUrl: structured?.imageUrl ?? meta.imageUrl,
    priceMinor,
    currency,
    availability,
    rawPriceText,
    sku
  };
  const sizeVariants = extractCentrepointSizeVariants(inputUrl, html, product);
  if (sizeVariants.length > 0) {
    return withProductVariants(product, sizeVariants);
  }

  const color = extractCentrepointColor(html, jsonLdProduct);
  if (!productId || !color) {
    return product;
  }

  const attributes = [{ name: 'Color', value: color }];
  return withProductVariants(product, [{
    id: productId,
    label: formatVariantLabel(attributes),
    attributes,
    url: cleanUrl(inputUrl),
    priceMinor: product.priceMinor,
    currency: product.currency,
    availability: product.availability,
    sku: product.sku ?? productId,
    imageUrl: product.imageUrl
  }]);
}

function extractCentrepointSizeVariants(inputUrl: string, html: string, product: ParsedProduct): ProductVariant[] {
  const variants = new Map<string, ProductVariant>();
  const sourceUrl = cleanUrl(inputUrl);
  const buttonPattern = /<button\b([^>]*)>([\s\S]{0,600}?)<\/button>/gi;

  for (const match of html.matchAll(buttonPattern)) {
    const openingAttributes = match[1] ?? '';
    const tag = `<button${openingAttributes}>`;
    const sourceId = cleanSku(htmlAttribute(tag, 'id') ?? htmlAttribute(tag, 'name'));
    const rawValue = htmlAttribute(tag, 'value') ?? stripHtmlTags(match[2] ?? '');
    const value = cleanText(rawValue);
    if (!sourceId || !isCentrepointSizeValue(value) || !/^\d+$/.test(sourceId)) {
      continue;
    }

    const attributes = [{ name: 'Size', value }];
    variants.set(sourceId, {
      id: sourceId,
      label: formatVariantLabel(attributes),
      attributes,
      url: sourceUrl,
      priceMinor: product.priceMinor,
      currency: product.currency,
      availability: parseCentrepointControlAvailability(tag),
      sku: sourceId
    });
  }

  return Array.from(variants.values());
}

function isCentrepointSizeValue(value: string): boolean {
  return /^(?:XXXS|XXS|XS|S|M|L|XL|XXL|3XL|4XL|5XL|\d{1,3}(?:[./-]\d{1,2})?)$/i.test(value);
}

function parseCentrepointControlAvailability(tag: string): Availability {
  return htmlHasBooleanAttribute(tag, 'disabled') ||
    /\b(?:disabledStock|Mui-disabled(?:-lmg)?|out[-_ ]?of[-_ ]?stock|sold[-_ ]?out|unavailable)\b/i.test(tag)
    ? 'out_of_stock'
    : 'in_stock';
}

function extractCentrepointColor(html: string, jsonLdProduct?: JsonRecord): string | undefined {
  const structuredColor = asString(jsonLdProduct?.color);
  if (structuredColor?.trim()) {
    return cleanText(structuredColor);
  }

  const visibleColor = matchString(html, /\bcolou?r\s*:\s*(?:<[^>]+>\s*){0,4}([^<\r\n]+)/i);
  return visibleColor ? cleanText(visibleColor) : undefined;
}

function extractCentrepointProductId(inputUrl: string): string | undefined {
  const match = inputUrl.match(/\/p\/([^/?#]+)/i);
  return match?.[1] ? cleanSku(decodeURIComponent(match[1])) : undefined;
}

function parseCentrepointAvailability(html: string): Availability {
  const structuredAvailability = parseAvailability(
    matchString(html, /"availability"\s*:\s*"([^"]+)"/i)
  );
  if (structuredAvailability !== 'unknown') {
    return structuredAvailability;
  }

  const normalized = stripHtmlTags(html).toLowerCase();
  if (/\b(?:sold\s*out|out\s*of\s*stock|currently\s*unavailable)\b/.test(normalized)) {
    return 'out_of_stock';
  }

  return /\b(?:add\s*to\s*(?:basket|cart|bag)|buy\s*now)\b/.test(normalized)
    ? 'in_stock'
    : 'unknown';
}

/**
 * Namshi keeps the product/color selection in the URL and renders the size
 * choices in the first product response. A size control is only promoted to a
 * tracker variant when the page provides a source control plus a usable stock
 * signal; otherwise the product stays at page level.
 */
function parseNamshiProduct(
  siteKey: SiteKey,
  inputUrl: string,
  html: string,
  structured?: ParsedProduct
): ParsedProduct | undefined {
  if (!structured) {
    return undefined;
  }

  const product = {
    ...structured,
    siteKey,
    availability: structured.availability === 'unknown'
      ? parseNamshiAvailability(html)
      : structured.availability
  };

  return withProductVariants(product, extractNamshiSizeVariants(inputUrl, html, product));
}

function extractNamshiSizeVariants(inputUrl: string, html: string, product: ParsedProduct): ProductVariant[] {
  const pageAvailability = product.availability === 'unknown' ? parseNamshiAvailability(html) : product.availability;
  const productId = extractNamshiProductId(inputUrl);
  const variants = new Map<string, ProductVariant>();
  const elementPattern = /<(button|input|a)\b([^>]*?)(?:>([\s\S]{0,220}?)<\/\1>|\/?>)/gi;

  for (const match of html.matchAll(elementPattern)) {
    const tagName = match[1] ?? '';
    const attributeText = match[2] ?? '';
    const innerHtml = match[3] ?? '';
    const tag = `<${tagName}${attributeText}>`;
    const index = match.index ?? 0;
    const context = html.slice(Math.max(0, index - 1200), index);
    const hasSizeMarker = /\bsize\b|data-(?:variant|option)/i.test(attributeText) || /select\s+size|standard\s*:/i.test(context);
    if (!hasSizeMarker) {
      continue;
    }

    const valueCandidates = [
      htmlAttribute(tag, 'data-display-value'),
      htmlAttribute(tag, 'data-size'),
      htmlAttribute(tag, 'data-option-value'),
      htmlAttribute(tag, 'aria-label'),
      stripHtmlTags(innerHtml),
      htmlAttribute(tag, 'data-value'),
      htmlAttribute(tag, 'value')
    ];
    const value = valueCandidates
      .map((candidate) => cleanNamshiSizeValue(candidate))
      .find((candidate): candidate is string => Boolean(candidate && isNamshiSizeValue(candidate)));
    if (!value || !isNamshiSizeValue(value)) {
      continue;
    }

    const dataValue = htmlAttribute(tag, 'data-value');
    const explicitId =
      htmlAttribute(tag, 'data-variant-id') ??
      htmlAttribute(tag, 'data-size-id') ??
      htmlAttribute(tag, 'data-option-id') ??
      htmlAttribute(tag, 'data-pid') ??
      htmlAttribute(tag, 'data-sku') ??
      (dataValue && dataValue !== value ? dataValue : undefined);
    const id = cleanSku(explicitId) ?? `${productId ?? 'namshi'}:size:${toVariantKey(value)}`;
    const attributes = [{ name: 'Size', value }];
    const availability = parseVariantControlAvailability(tag, pageAvailability);
    if (availability === 'unknown') {
      continue;
    }

    const priceMinor =
      parsePriceToMinor(
        htmlAttribute(tag, 'data-price') ??
        htmlAttribute(tag, 'data-current-price') ??
        htmlAttribute(tag, 'data-sale-price') ??
        htmlAttribute(tag, 'data-display-price')
      ) ?? product.priceMinor;
    const rawUrl = htmlAttribute(tag, 'data-url') ?? htmlAttribute(tag, 'href');
    const url = rawUrl && !/^javascript:/i.test(rawUrl)
      ? cleanUrl(absoluteUrl(rawUrl, inputUrl))
      : cleanUrl(inputUrl);

    variants.set(id, {
      id,
      label: formatVariantLabel(attributes),
      attributes,
      url,
      priceMinor,
      currency: htmlAttribute(tag, 'data-currency') ?? product.currency,
      availability,
      sku: cleanSku(htmlAttribute(tag, 'data-sku') ?? explicitId) ?? id
    });
  }

  return Array.from(variants.values());
}

function parseNamshiAvailability(html: string): Availability {
  const normalized = stripHtmlTags(html).toLowerCase();
  if (/\b(?:sold\s*out|out\s*of\s*stock|currently\s*unavailable)\b/.test(normalized)) {
    return 'out_of_stock';
  }

  if (/\b(?:add\s*to\s*bag|add\s*to\s*cart|low\s*stock)\b/.test(normalized)) {
    return 'in_stock';
  }

  return 'unknown';
}

function extractNamshiProductId(inputUrl: string): string | undefined {
  return inputUrl.match(/\/((?:Z)[A-Z0-9]+)\/p\/?(?:[?#]|$)/i)?.[1]?.toUpperCase();
}

function cleanNamshiSizeValue(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const cleaned = cleanText(stripHtmlTags(value))
    .replace(/^(?:select\s+)?size\s*[:-]?\s*/i, '')
    .replace(/\s+(?:out\s+of\s+stock|sold\s+out|unavailable|low\s+stock)\s*$/i, '')
    .trim();

  if (!cleaned || /^(?:size\s+guide|view\s+size\s+guide|select\s+size)$/i.test(cleaned)) {
    return undefined;
  }

  return cleaned;
}

function isNamshiSizeValue(value: string): boolean {
  if (/^(?:add|view|select|size|guide|choose)\b/i.test(value)) {
    return false;
  }

  return /^(?:EU\s*)?\d{2}(?:\.\d+)?$/i.test(value) ||
    /^(?:XXXS?|XXS|XS|S|M|L|XL|XXL|3XL|4XL|XS\/S|S\/M|M\/L|L\/XL)$/i.test(value) ||
    /^\d{1,2}(?:\.\d+)?$/.test(value);
}

function parseVariantControlAvailability(tag: string, pageAvailability: Availability): Availability {
  const explicit =
    htmlAttribute(tag, 'data-availability') ??
    htmlAttribute(tag, 'data-stock-status') ??
    htmlAttribute(tag, 'data-available') ??
    htmlAttribute(tag, 'aria-label');
  const parsedExplicit = parseAvailability(explicit);
  if (parsedExplicit !== 'unknown') {
    return parsedExplicit;
  }

  const dataAvailable = htmlAttribute(tag, 'data-available');
  if (dataAvailable && /^(?:false|0|no|true)$/i.test(dataAvailable)) {
    return /^(?:false|0|no)$/i.test(dataAvailable) ? 'out_of_stock' : 'in_stock';
  }

  const ariaDisabled = htmlAttribute(tag, 'aria-disabled');
  if (ariaDisabled && /^(?:true|1|yes)$/i.test(ariaDisabled)) {
    return 'out_of_stock';
  }

  if (htmlHasBooleanAttribute(tag, 'disabled') || /\b(?:disabled|out[-_ ]of[-_ ]stock|sold[-_ ]out|unavailable)\b/i.test(tag)) {
    return 'out_of_stock';
  }

  return pageAvailability;
}

/**
 * Sharaf DG exposes option links that navigate to a complete product route.
 * The route is retained on the variant so future checks fetch the exact item
 * code/price page rather than the page's default configuration.
 */
function parseSharafDgProduct(
  siteKey: SiteKey,
  inputUrl: string,
  html: string,
  structured?: ParsedProduct
): ParsedProduct | undefined {
  const meta = extractMeta(html);
  const title = structured?.title ?? matchString(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i) ?? meta.title;
  const rawPriceText = structured?.rawPriceText ?? meta.price;
  const priceMinor = structured?.priceMinor ?? parsePriceToMinor(rawPriceText);
  const currency = structured?.currency ?? meta.currency ?? 'AED';
  const availability = structured?.availability && structured.availability !== 'unknown'
    ? structured.availability
    : parseSharafDgAvailability(html);
  const sku = structured?.sku ?? cleanSku(matchString(html, /\bItem\s+([A-Z0-9-]+)/i));

  if (!title && priceMinor === undefined) {
    return undefined;
  }

  const product: ParsedProduct = {
    siteKey,
    canonicalUrl: structured?.canonicalUrl ?? meta.canonicalUrl ?? inputUrl,
    title: cleanText(title ?? 'Untitled product'),
    imageUrl: structured?.imageUrl ?? meta.imageUrl,
    priceMinor,
    currency,
    availability,
    rawPriceText,
    sku
  };

  return withProductVariants(
    product,
    extractSharafDgVariants(inputUrl, html, product, extractSharafDgAttributes(html))
  );
}

function parseSharafDgAvailability(html: string): Availability {
  const explicit = parseAvailability(
    matchString(html, /data-(?:availability|stock-status)=(["'])(.*?)\1/i)
  );
  if (explicit !== 'unknown') {
    return explicit;
  }

  const normalized = stripHtmlTags(html).toLowerCase();
  if (/\b(?:sold\s*out|out\s*of\s*stock|currently\s*unavailable)\b/.test(normalized)) {
    return 'out_of_stock';
  }

  if (/\badd\s*to\s*cart\b/.test(normalized)) {
    return 'in_stock';
  }

  return 'unknown';
}

function extractSharafDgAttributes(html: string): VariantAttribute[] {
  const names = ['Color', 'Processor', 'Keyboard', 'Storage Size', 'Internal Memory', 'RAM', 'Region'];
  const attributes = new Map<string, VariantAttribute>();
  for (const name of names) {
    const value = matchString(
      html,
      new RegExp(`${escapeRegExp(name)}\\s*:\\s*(?:<[^>]+>\\s*){0,8}([^<\\r\\n]{1,100})`, 'i')
    );
    const normalizedName = normalizeSharafAttributeName(name) ?? name;
    const cleanedValue = value ? cleanText(value) : undefined;
    if (cleanedValue && !/^(?:image|details|key\s+information)$/i.test(cleanedValue)) {
      attributes.set(normalizedName, { name: normalizedName, value: cleanedValue });
    }
  }

  return Array.from(attributes.values());
}

function extractSharafDgVariants(
  inputUrl: string,
  html: string,
  product: ParsedProduct,
  currentAttributes: VariantAttribute[]
): ProductVariant[] {
  const variants = new Map<string, ProductVariant>();
  const currentUrl = cleanUrl(inputUrl);
  const currentId = extractSharafDgRouteId(currentUrl);

  if (currentId && (currentAttributes.length > 0 || product.sku)) {
    variants.set(currentId, {
      id: currentId,
      label: formatVariantLabel(currentAttributes),
      attributes: currentAttributes,
      url: currentUrl,
      priceMinor: product.priceMinor,
      currency: product.currency,
      availability: product.availability,
      sku: product.sku,
      imageUrl: product.imageUrl
    });
  }

  const anchorPattern = /<a\b([^>]*?)>([\s\S]{0,400}?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const openingAttributes = match[1] ?? '';
    const anchor = `<a${openingAttributes}>`;
    const href = htmlAttribute(anchor, 'href');
    if (!href || !/sharafdg\.com\/product\//i.test(href)) {
      continue;
    }

    const url = cleanUrl(absoluteUrl(href, inputUrl));
    if (url === currentUrl) {
      continue;
    }

    const label = cleanText(stripHtmlTags(match[2] ?? ''));
    const index = match.index ?? 0;
    const context = html.slice(Math.max(0, index - 900), index);
    const optionName = extractSharafOptionName(openingAttributes, context);
    const hasOptionMarker = /(?:product-option|variant|variation|swatch|configurable|data-product-options|data-option)/i.test(`${openingAttributes} ${context}`);
    const hasNamedOptionContext = Boolean(optionName) && /\b(?:Color|Processor|Keyboard|Storage\s+Size|Internal\s+Memory|RAM|Region)\s*:/i.test(context.slice(-350));
    if ((!hasOptionMarker && !hasNamedOptionContext) || !isSharafOptionLabel(label)) {
      continue;
    }

    const id = extractSharafDgRouteId(url);
    if (!id) {
      continue;
    }

    const explicitAttributes = extractExplicitVariantAttributes(anchor);
    const slugAttributes = extractSharafDgSlugAttributes(url);
    const optionAttribute = optionName && label ? [{ name: optionName, value: label }] : [];
    const attributes = mergeVariantAttributes(currentAttributes, slugAttributes, explicitAttributes, optionAttribute);
    if (attributes.length === 0) {
      continue;
    }

    const previous = variants.get(id);
    const availability = parseVariantControlAvailability(anchor, 'in_stock');
    const priceMinor = parsePriceToMinor(
      htmlAttribute(anchor, 'data-price') ??
      htmlAttribute(anchor, 'data-current-price') ??
      htmlAttribute(anchor, 'data-sale-price')
    );
    const variant: ProductVariant = {
      id,
      label: formatVariantLabel(attributes),
      attributes,
      url,
      priceMinor: priceMinor ?? previous?.priceMinor,
      currency: htmlAttribute(anchor, 'data-currency') ?? product.currency,
      availability: availability === 'unknown' ? previous?.availability ?? 'in_stock' : availability,
      sku: cleanSku(htmlAttribute(anchor, 'data-sku') ?? htmlAttribute(anchor, 'data-item-code')) ?? previous?.sku,
      imageUrl: htmlAttribute(anchor, 'data-image') ?? previous?.imageUrl
    };
    variants.set(id, previous ? { ...previous, ...variant, attributes } : variant);
  }

  return Array.from(variants.values());
}

function extractSharafOptionName(openingAttributes: string, context: string): string | undefined {
  const explicit =
    htmlAttribute(`<a${openingAttributes}>`, 'data-option-name') ??
    htmlAttribute(`<a${openingAttributes}>`, 'data-attribute-name') ??
    htmlAttribute(`<a${openingAttributes}>`, 'data-attribute');
  if (explicit) {
    return normalizeSharafAttributeName(explicit);
  }

  const contextOption = context.match(/data-option-name\s*=\s*(["'])([^"']+)\1/gi)?.pop();
  const contextOptionName = contextOption?.match(/data-option-name\s*=\s*(["'])([^"']+)\1/i)?.[2];
  if (contextOptionName) {
    return normalizeSharafAttributeName(contextOptionName);
  }

  const labels = Array.from(context.matchAll(/\b(Color|Processor|Keyboard|Storage\s+Size|Internal\s+Memory|RAM|Region)\s*:/gi));
  return normalizeSharafAttributeName(labels[labels.length - 1]?.[1]);
}

function normalizeSharafAttributeName(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = cleanText(value).toLowerCase();
  if (normalized === 'color' || normalized === 'colour') return 'Color';
  if (normalized === 'processor' || normalized === 'cpu') return 'Processor';
  if (normalized === 'keyboard' || normalized.includes('keyboard')) return 'Keyboard';
  if (normalized === 'internal memory' || normalized === 'storage' || normalized.includes('storage')) return 'Storage Size';
  if (normalized === 'ram' || normalized === 'memory') return 'RAM';
  if (normalized === 'region') return 'Region';
  return cleanText(value);
}

function isSharafOptionLabel(value: string): boolean {
  if (!value || value.length > 80 || /^(?:image|details|add\s+to|buy\s+now|view\s+full)/i.test(value)) {
    return false;
  }

  return /^(?:english(?:\/arabic)?|\d+\s*(?:GB|TB)(?:\s+SSD)?|[A-Za-z][A-Za-z0-9 /+&.-]{1,39})$/i.test(value);
}

function extractExplicitVariantAttributes(tag: string): VariantAttribute[] {
  const raw = htmlAttribute(tag, 'data-attributes') ?? htmlAttribute(tag, 'data-variant-attributes');
  if (!raw) {
    return [];
  }

  const parsed = parseJsonCandidates(raw)[0];
  return extractVariantAttributes(parsed);
}

function extractSharafDgSlugAttributes(url: string): VariantAttribute[] {
  const path = url.toLowerCase();
  const attributes: VariantAttribute[] = [];
  const ram = path.match(/(\d+)gb-ram\b/i)?.[1];
  const storageMatch =
    path.match(/(?:^|-)(\d+)(gb|tb)-ssd(?:-|\/|$)/i) ??
    path.match(/(?:^|-)(\d+)(gb|tb)(?!-ram)(?:-|\/|$)/i);
  if (ram) {
    attributes.push({ name: 'RAM', value: `${ram} GB` });
  }
  if (storageMatch) {
    const [, value, unit] = storageMatch;
    const hasSsdSuffix = /-ssd(?:-|\/|$)/i.test(storageMatch[0]);
    attributes.push({ name: 'Storage Size', value: `${value} ${unit.toUpperCase()}${hasSsdSuffix ? ' SSD' : ''}` });
  }

  const keyboard = path.match(/(english-arabic|english)-keyboard\b/i)?.[1];
  if (keyboard) {
    attributes.push({ name: 'Keyboard', value: keyboard.toLowerCase() === 'english-arabic' ? 'English/Arabic' : 'English' });
  }

  const color = path.match(/(?:^|-)(sky-blue|midnight|navy|white|jetblack|icyblue|cobalt-violet|black|silver|starlight)(?:-|\/|$)/i)?.[1];
  if (color) {
    attributes.push({ name: 'Color', value: color.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') });
  }

  return attributes;
}

function mergeVariantAttributes(...groups: VariantAttribute[][]): VariantAttribute[] {
  const merged = new Map<string, VariantAttribute>();
  for (const group of groups) {
    for (const attribute of group) {
      if (attribute.name && attribute.value) {
        merged.set(attribute.name, attribute);
      }
    }
  }
  return Array.from(merged.values());
}

function extractSharafDgRouteId(url: string): string | undefined {
  return url.match(/\/product\/([^/?#]+)\/?(?:[?#]|$)/i)?.[1]?.toLowerCase();
}

/**
 * Brands For Less (Next.js) product page parser.
 *
 * BFL is a Next.js SPA served behind Cloudflare. When the page is served
 * via SSR, product data is embedded in __NEXT_DATA__ and standard meta tags.
 * The generic JSON-LD parser covers structured data; this handler adds
 * Next.js-specific extraction and BFL HTML fallbacks.
 */
function parseBFLProduct(siteKey: SiteKey, inputUrl: string, html: string): ParsedProduct | undefined {
  const meta = extractMeta(html);
  const nextData = extractNextData(html);
  const productProps = (nextData as JsonRecord | undefined)?.props as JsonRecord | undefined;
  const pageProps = productProps?.pageProps as JsonRecord | undefined;
  const product = pageProps?.product as JsonRecord | undefined;

  const title =
    asString(product?.name) ??
    asString(product?.title) ??
    matchString(html, /<h1[^>]*class=["'][^"']*product[^"']*title[^"']*["'][^>]*>([^<]+?)<\/h1>/i) ??
    meta.title;
  const imageUrl =
    firstString(product?.image) ??
    firstString((product?.images as unknown[])?.[0]) ??
    asString(((product?.images as unknown[])?.[0] as JsonRecord)?.url) ??
    meta.imageUrl;
  const rawPriceText =
    asString(product?.price) ??
    asString(product?.priceInAED) ??
    meta.price;
  const currency = 'AED';
  const sku =
    cleanSku(asString(product?.id)) ??
    cleanSku(asString(product?.sku)) ??
    cleanSku(matchString(html, /data-product-id=["']([^"']+)["']/i));
  const availability =
    product
      ? typeof product?.inStock === 'boolean'
        ? product.inStock ? 'in_stock' : 'out_of_stock'
        : typeof product?.stock === 'number'
          ? product.stock > 0 ? 'in_stock' : 'out_of_stock'
          : typeof product?.available === 'boolean'
            ? product.available ? 'in_stock' : 'out_of_stock'
            : 'unknown'
      : detectBFLOutOfStock(html);

  if (!title && !rawPriceText) {
    return undefined;
  }

  return {
    siteKey,
    canonicalUrl: meta.canonicalUrl ?? inputUrl,
    title: cleanText(title ?? 'Brands For Less product'),
    imageUrl,
    priceMinor: parsePriceToMinor(rawPriceText),
    currency,
    availability,
    rawPriceText: rawPriceText ? String(rawPriceText) : undefined,
    sku
  };
}

/**
 * Extract Next.js SSR data from __NEXT_DATA__ script tag.
 */
function extractNextData(html: string): JsonRecord | undefined {
  const match = html.match(/<script\s+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) {
    return undefined;
  }

  try {
    return JSON.parse(match[1]) as JsonRecord;
  } catch {
    return undefined;
  }
}

/**
 * Detect out-of-stock signals in BFL HTML.
 */
function detectBFLOutOfStock(html: string): Availability {
  const normalized = html.toLowerCase();

  // Explicit OOS indicators
  if (
    normalized.includes('out of stock') ||
    normalized.includes('sold out') ||
    normalized.includes('notify me when available') ||
    normalized.includes('currently unavailable')
  ) {
    return 'out_of_stock';
  }

  // In-stock indicators
  if (
    normalized.includes('add to bag') ||
    normalized.includes('add to cart') ||
    normalized.includes('in stock')
  ) {
    return 'in_stock';
  }

  return 'unknown';
}

/**
 * Detect out-of-stock signals in Noon HTML when JSON-LD structured data
 * is missing or incomplete. Checks embedded JSON payloads and common
 * OOS text patterns.
 */
function detectNoonOos(html: string): Availability {
  const normalized = html.toLowerCase();

  // Check embedded JSON for explicit OOS flags
  if (/"availability"\s*:\s*"out_of_stock"/i.test(html)) return 'out_of_stock';
  if (/"is_out_of_stock"\s*:\s*true/i.test(html)) return 'out_of_stock';
  if (/"stock_status"\s*:\s*"out_of_stock"/i.test(html)) return 'out_of_stock';

  // Check for "Sold out" text patterns (common in Noon's UI)
  if (normalized.includes('sold out') && !normalized.includes('almost sold out')) {
    return 'out_of_stock';
  }

  if (
    normalized.includes('out of stock') &&
    !normalized.includes('almost out of stock')
  ) {
    return 'out_of_stock';
  }

  // Check for missing "Add to cart" / "Buy now" when product data exists
  // (Noon always shows these on in-stock products)
  const hasTitle = /"name"\s*:\s*"/.test(html) || /"title"\s*:\s*"/.test(html);
  const hasAddToCart = /add.?to.?cart/i.test(normalized) || /add.?to.?bag/i.test(normalized) || /buy.?now/i.test(normalized);
  const hasPrice = /"sale_price"\s*:\s*[0-9]/.test(html) || /"price"\s*:\s*[0-9]/.test(html);

  // If we have product data but no add-to-cart button and no price, likely OOS
  if (hasTitle && !hasAddToCart && !hasPrice) {
    return 'out_of_stock';
  }

  return 'unknown';
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
    return variations.find((item) => item.is_in_stock === true) ?? variations[0];
  } catch {
    return undefined;
  }
}

function extractAymVariants(html: string): ProductVariant[] {
  const match = html.match(/data-product_variations=(["'])([\s\S]*?)\1/i);
  if (!match?.[2]) {
    return [];
  }

  try {
    const parsed = JSON.parse(decodeHtmlEntities(match[2]));
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return [];
      }

      const variation = item as JsonRecord;
      const id = asIdentifier(variation.variation_id) ?? cleanSku(asString(variation.sku));
      const attributes = extractVariantAttributes(variation.attributes);
      const priceMinor = parsePriceToMinor(asPriceValue(variation.display_price));
      const availability = parseAymAvailability(variation, '');
      if (!id || attributes.length === 0 || availability === 'unknown') {
        return [];
      }

      return [{
        id,
        label: formatVariantLabel(attributes),
        attributes,
        priceMinor,
        currency: 'AED',
        availability,
        sku: cleanSku(asString(variation.sku)),
        imageUrl: extractAymVariationImage(variation)
      }];
    });
  } catch {
    return [];
  }
}

function extractOunassVariants(html: string): ProductVariant[] {
  const match = html.match(/"pdp"\s*:\s*\{[\s\S]{0,16000}?"sizes"\s*:\s*(\[[\s\S]{0,8000}?\])\s*(?:,|\})/);
  if (!match?.[1]) {
    return [];
  }

  try {
    const sizes = JSON.parse(match[1]);
    if (!Array.isArray(sizes)) {
      return [];
    }

    return sizes.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return [];
      }

      const size = item as JsonRecord;
      const id = cleanSku(asString(size.sku));
      const value = asString(size.sizeCode) ?? asString(size.label) ?? asString(size.name);
      const priceMinor = parsePriceToMinor(asPriceValue(size.priceInAED) ?? asPriceValue(size.price));
      const stock = typeof size.stock === 'number' ? size.stock : undefined;
      const availability = size.disabled === true || stock === 0 ? 'out_of_stock' : stock && stock > 0 ? 'in_stock' : 'unknown';
      if (!id || !value || availability === 'unknown') {
        return [];
      }
      const attributes = [{ name: 'Size', value: cleanText(value) }];
      return [{
        id,
        label: formatVariantLabel(attributes),
        attributes,
        priceMinor,
        currency: 'AED',
        availability,
        sku: id
      }];
    });
  } catch {
    return [];
  }
}

/**
 * Nike UAE and Sun & Sand Sports render source-defined size buttons in their
 * first SFCC product response. The `data-attr-value` is the source's option
 * identifier; Nike additionally provides the selected variation PID.
 */
function extractDemandwareSizeVariants(html: string, product?: ParsedProduct): ProductVariant[] {
  if (product?.priceMinor === undefined || !product.currency) {
    return [];
  }

  const variants: ProductVariant[] = [];
  const buttonPattern = /<button\b(?=[^>]*\bdata-attr-display-value\s*=)[^>]*>/gi;

  for (const match of html.matchAll(buttonPattern)) {
    const tag = match[0];
    const isSizeOption =
      /\b(?:size-attribute|attribute__list-item--size|js-size-attribute)\b/i.test(tag) ||
      /\baria-label\s*=\s*["']Select Size(?:\s|["'])/i.test(tag);
    if (!isSizeOption) {
      continue;
    }

    const displayValue = htmlAttribute(tag, 'data-attr-display-value');
    const optionId = htmlAttribute(tag, 'data-attr-value');
    const variationId = htmlAttribute(tag, 'data-pid');
    const id = variationId ?? optionId;

    if (!id || !displayValue) {
      continue;
    }

    const attributes = [{ name: 'Size', value: cleanText(displayValue) }];
    const availability = htmlHasBooleanAttribute(tag, 'disabled') || /\bm-disabled\b/i.test(tag)
      ? 'out_of_stock'
      : 'in_stock';

    variants.push({
      id,
      label: formatVariantLabel(attributes),
      attributes,
      priceMinor: product.priceMinor,
      currency: product.currency,
      availability,
      sku: variationId ?? optionId
    });
  }

  return variants;
}

/**
 * Adidas marks each size in first-page SFCC markup with a hidden, stable
 * `radio-input_attID`. A disabled radio is the source's OOS signal.
 */
function extractAdidasSizeVariants(html: string, product?: ParsedProduct): ProductVariant[] {
  if (product?.priceMinor === undefined || !product.currency) {
    return [];
  }

  const variants: ProductVariant[] = [];
  const sizeBlockPattern = /<div\b[^>]*class=["'][^"']*\bsize-radio\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;

  for (const match of html.matchAll(sizeBlockPattern)) {
    const block = match[1] ?? '';
    const identifierInput = findHtmlTagWithClass(block, 'input', 'radio-input_attID');
    const radioInput = findHtmlTag(block, 'input', 'type', 'radio');
    const id = identifierInput ? htmlAttribute(identifierInput, 'value') : undefined;
    const size = matchString(block, /<span\b[^>]*class=["'][^"']*\bsize-value\b[^"']*["'][^>]*>\s*([^<]+?)\s*<\/span>/i);

    if (!id || !size || !radioInput) {
      continue;
    }

    const attributes = [{ name: 'Size', value: cleanText(size) }];
    variants.push({
      id,
      label: formatVariantLabel(attributes),
      attributes,
      priceMinor: product.priceMinor,
      currency: product.currency,
      availability: htmlHasBooleanAttribute(radioInput, 'disabled') ? 'out_of_stock' : 'in_stock',
      sku: id
    });
  }

  return variants;
}

/**
 * PUMA UAE includes every source-defined size in the initial product HTML.
 * The tile value is the stable option ID and its accessible label carries the
 * stock state, so no option-specific request is required.
 */
function extractPumaSizeVariants(html: string, product?: ParsedProduct): ProductVariant[] {
  if (product?.priceMinor === undefined || !product.currency) {
    return [];
  }

  const variants: ProductVariant[] = [];
  const sizeTilePattern = /<a\b(?=[^>]*\bdata-testid\s*=\s*["']sf-sizetile["'])[^>]*>/gi;

  for (const match of html.matchAll(sizeTilePattern)) {
    const tag = match[0];
    const id = htmlAttribute(tag, 'value');
    const ariaLabel = htmlAttribute(tag, 'aria-label');
    const size = ariaLabel?.match(/^Size\s+(.+?)(?:\s+out of stock)?$/i)?.[1];
    if (!id || !size) {
      continue;
    }

    const attributes = [{ name: 'Size', value: cleanText(size) }];
    variants.push({
      id,
      label: formatVariantLabel(attributes),
      attributes,
      priceMinor: product.priceMinor,
      currency: product.currency,
      availability: /\bout of stock\b/i.test(ariaLabel) ? 'out_of_stock' : 'in_stock',
      sku: id
    });
  }

  return variants;
}

function findHtmlTagWithClass(html: string, tagName: string, className: string): string | undefined {
  const pattern = new RegExp(`<${escapeRegExp(tagName)}\\b(?=[^>]*\\bclass=["'][^"']*\\b${escapeRegExp(className)}\\b[^"']*["'])[^>]*>`, 'i');
  return html.match(pattern)?.[0];
}

function findHtmlTag(html: string, tagName: string, attributeName: string, attributeValue: string): string | undefined {
  const pattern = new RegExp(`<${escapeRegExp(tagName)}\\b(?=[^>]*\\b${escapeRegExp(attributeName)}\\s*=\\s*["']${escapeRegExp(attributeValue)}["'])[^>]*>`, 'i');
  return html.match(pattern)?.[0];
}

function htmlAttribute(tag: string, name: string): string | undefined {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i');
  const match = tag.match(pattern);
  return match?.[2] ? decodeHtmlEntities(match[2]) : undefined;
}

function htmlHasBooleanAttribute(tag: string, name: string): boolean {
  const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(name)}(?:\\s*=\\s*(?:["'][^"']*["']|[^\\s>]+))?(?=\\s|>|$)`, 'i');
  return pattern.test(tag);
}

function extractVariantAttributes(value: unknown): VariantAttribute[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value as JsonRecord).flatMap(([key, rawValue]) => {
    const attributeValue = asString(rawValue);
    if (!attributeValue || !attributeValue.trim()) {
      return [];
    }

    const name = key
      .replace(/^attribute_(?:pa_)?/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
    return [{ name, value: cleanText(attributeValue) }];
  });
}

function formatVariantLabel(attributes: VariantAttribute[]): string {
  return attributes.map((attribute) => `${attribute.name}: ${attribute.value}`).join(' · ');
}

function asIdentifier(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function asPriceValue(value: unknown): string | number | undefined {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined;
}

function extractAymVariationImage(variation?: JsonRecord): string | undefined {
  const image = variation?.image;
  if (!image || typeof image !== 'object' || Array.isArray(image)) {
    return undefined;
  }

  const record = image as JsonRecord;
  return asString(record.full_src) ?? asString(record.url) ?? asString(record.src);
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
    normalized.includes('attention required') ||  // Imperva / Cloudflare variant
    normalized.includes('sorry, we just need to make sure you\'re not a robot') ||
    normalized.includes('enter the characters you see below') ||
    normalized.includes('type the characters you see in this image') ||
    normalized.includes('automated access to amazon data') ||
    normalized.includes('/errors/validatecaptcha') ||
    // Akamai "Access Denied" page (common on SFCC / Adidas)
    (normalized.includes('access denied') && normalized.includes('reference #')) ||
    // Imperva/Incapsula WAF block
    normalized.includes('incapsula') && normalized.includes('blocked') ||
    // Generic JavaScript challenge page (many WAFs use this)
    (normalized.includes('please enable javascript') && normalized.includes('continue'))
  );
}

/**
 * Detect product pages that are actually 404 / product-not-found pages.
 * Some sites (e.g. Sun & Sand Sports) serve a 200 status with a 404 template
 * that still includes cached product meta tags.
 */
function isProduct404Page(html: string): boolean {
  const normalized = html.toLowerCase();

  // Sun & Sand Sports 404 page pattern
  if (normalized.includes('data-gtm-event-action="404') && normalized.includes('class="error__image"')) {
    return true;
  }

  // Generic 404 page indicators (use sparingly to avoid false positives)
  const has404Image = /<img[^>]+404[^>]*>/i.test(html);
  const has404Heading = /<h[1-3][^>]*>\s*404\b/i.test(html);
  const hasProductNotFound = /product.{0,15}not\s*found/i.test(normalized);

  if (has404Image && (has404Heading || hasProductNotFound)) {
    return true;
  }

  return false;
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
  if (typeof variation?.is_in_stock === 'boolean') {
    return variation.is_in_stock ? 'in_stock' : 'out_of_stock';
  }

  const variationAvailability = parseAvailability(asString(variation?.availability_html));
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

  // Explicit OOS messages in the extracted availability text
  if (
    normalizedValue.includes('currently unavailable') ||
    normalizedValue.includes('temporarily out of stock') ||
    normalizedValue.includes("we don't know when or if this item will be back in stock")
  ) {
    return 'out_of_stock';
  }

  const normalizedHtml = html.toLowerCase();

  // Definitive OOS signals — check BEFORE the vague whole-page "in stock" heuristic
  // since OOS pages with recommendation carousels often contain "In Stock" labels
  // on recommended products
  if (
    normalizedHtml.includes('currently unavailable') ||
    normalizedHtml.includes('temporarily out of stock') ||
    normalizedHtml.includes("we don't know when or if this item will be back in stock")
  ) {
    return 'out_of_stock';
  }

  // Amazon occasionally uses id="outOfStock" on the availability div
  if (/id=["']outOfStock["']/i.test(html)) {
    return 'out_of_stock';
  }

  // In-stock heuristic: primary-availability-message with "in stock" sentinel nearby.
  // Only trigger this when no definitive OOS signal was found above.
  if (normalizedHtml.includes('primary-availability-message') && normalizedHtml.includes('in stock')) {
    return 'in_stock';
  }

  // Edge case: availability div with a-price class (not green) but no a-color-success
  // Often indicates unavailable items listed by third-party sellers
  const availabilityDiv = html.match(
    /id=["']availability["'][\s\S]{0,800}?<\/div>/i
  );
  if (availabilityDiv?.[0]) {
    const avDiv = availabilityDiv[0].toLowerCase();
    const hasSuccess = avDiv.includes('a-color-success');
    const hasPrice = avDiv.includes('a-color-price');
    const hasAtAGlance = avDiv.includes('a-color-attained');
    if (!hasSuccess && !hasAtAGlance && hasPrice) {
      // Price-styled availability without green success often means unavailable
      return 'out_of_stock';
    }
  }

  return 'unknown';
}

function matchAmazonPriceText(html: string): string | undefined {
  const explicitBuyBoxPrice = firstAmazonPriceText(
    matchString(html, /id=["']tp_price_block_total_price_ww["'][\s\S]{0,200}?<span class=["']a-offscreen["']>\s*([^<]*\d[^<]*)\s*<\/span>/i),
    matchString(html, /id=["']priceblock_(?:ourprice|dealprice|saleprice)["'][\s\S]{0,200}?<span[^>]*>\s*([^<]*\d[^<]*)\s*<\/span>/i)
  );
  if (explicitBuyBoxPrice) {
    return explicitBuyBoxPrice;
  }

  const buyBoxHtml = extractAmazonBuyBoxHtml(html);
  if (!buyBoxHtml) {
    return undefined;
  }
  const standardBuyBoxHtml = removeAmazonPrimeExclusiveMarkup(buyBoxHtml);

  const priceToPayOffscreen = firstAmazonPriceText(
    matchString(
      standardBuyBoxHtml,
      /class=["'][^"']*priceToPay[^"']*["'][^>]*>\s*<span class=["']a-offscreen["']>\s*([^<]*\d[^<]*)\s*<\/span>/i
    ),
    matchString(
      standardBuyBoxHtml,
      /class=["'][^"']*apex-pricetopay-value[^"']*["'][\s\S]{0,200}?<span class=["']a-offscreen["']>\s*([^<]*\d[^<]*)\s*<\/span>/i
    )
  );
  if (priceToPayOffscreen) {
    return priceToPayOffscreen;
  }

  const apexPrice = standardBuyBoxHtml.match(
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

  return undefined;
}

function removeAmazonPrimeExclusiveMarkup(html: string): string {
  const openingTags = /<([a-z][\w:-]*)\b[^>]*>/gi;
  let result = '';
  let cursor = 0;
  let openingTag: RegExpExecArray | null;

  while ((openingTag = openingTags.exec(html))) {
    if (!/prime[^>]{0,100}exclusive|exclusive[^>]{0,100}prime/i.test(openingTag[0])) {
      continue;
    }

    const end = findHtmlElementEnd(html, openingTag);
    if (end === undefined) {
      continue;
    }

    result += html.slice(cursor, openingTag.index);
    cursor = end;
    openingTags.lastIndex = end;
  }

  return result + html.slice(cursor);
}

function findHtmlElementEnd(html: string, openingTag: RegExpExecArray): number | undefined {
  const tagName = openingTag[1];
  if (!tagName || openingTag.index === undefined) {
    return undefined;
  }

  const tags = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tags.lastIndex = openingTag.index;
  let depth = 0;
  let tag: RegExpExecArray | null;

  while ((tag = tags.exec(html))) {
    depth += tag[0].startsWith('</') ? -1 : 1;
    if (depth === 0) {
      return tags.lastIndex;
    }
  }

  return undefined;
}

function extractAmazonBuyBoxHtml(html: string): string | undefined {
  const startMatch = /<div\b[^>]*id=["'](?:corePriceDisplay_desktop_feature_div|corePrice_feature_div)["'][^>]*>/i.exec(html);
  if (!startMatch || startMatch.index === undefined) {
    return undefined;
  }

  const divTags = /<\/?div\b[^>]*>/gi;
  divTags.lastIndex = startMatch.index;
  let depth = 0;
  let tag: RegExpExecArray | null;

  while ((tag = divTags.exec(html))) {
    depth += tag[0].startsWith('</') ? -1 : 1;
    if (depth === 0) {
      return html.slice(startMatch.index, divTags.lastIndex);
    }
  }

  return undefined;
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

function stripHtmlTags(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
}

function toVariantKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
