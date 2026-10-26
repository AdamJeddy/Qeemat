import { DiscoveryCollection, DISCOVERY_SOURCE_PRODUCT_LIMIT, discoverySourceUrl, parseDecathlonListing } from './discovery';
import { DiscoveryProduct } from './types';
import { carrefourAvailability, carrefourOfferUrl, readCarrefourRecords } from './carrefour';

type RecordValue = Record<string, unknown>;

/** Parse only retailer-owned listing data; never evaluate scripts from a store. */
export function parseDiscoveryListing(body: string, source: DiscoveryCollection, observedAt: string): DiscoveryProduct[] {
  if (source.siteKey === 'carrefour_uae') {
    const products: DiscoveryProduct[] = [];
    for (const record of readCarrefourRecords(body)) {
      const item = asRecord(record.additionalAttributes);
      if (typeof item.productName !== 'string' || typeof item.productId !== 'string' || typeof item.productUrl !== 'string' || item.currency !== 'AED') { continue; }
      const base = item.productUrl.startsWith('/mafuae/en/') ? `https://www.carrefouruae.com${item.productUrl}` : item.productUrl;
      const url = carrefourOfferUrl(base, item);
      const price = Number(item.sellingPrice);
      if (!url || url.match(/\/p\/(\d+)/)?.[1] !== item.productId || !Number.isFinite(price) || price <= 0) { continue; }
      const stock = asRecord(item.stock);
      const rawBrand = asRecord(record.analytics).brandName;
      const brand = typeof rawBrand === 'string' && !rawBrand.startsWith('$') ? rawBrand.replace(/^(?:nonfood|food)_/i, '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Other brands';
      products.push({ id: `carrefour_uae:${item.productId}:${item.shopId}:${item.offerId}:${item.intent}`, siteKey: 'carrefour_uae', category: source.category,
        title: item.productName.trim(), brand, url, priceMinor: Math.round(price * 100), currency: 'AED',
        imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
        availability: carrefourAvailability(stock.stockLevelStatus, stock.value), observedAt });
    }
    return unique(products);
  }
  const found: DiscoveryProduct[] = [];
  const origin = discoverySourceUrl(source).match(/^https:\/\/[^/]+/)![0];
  function add(value: { id?: unknown; title?: unknown; url?: unknown; image?: unknown; price?: unknown; brand?: unknown; available?: unknown; currency?: unknown; range?: boolean }) {
    const observedUrl = absoluteUrl(value.url, origin);
    const url = source.siteKey === 'noon' ? observedUrl?.split('?')[0] : observedUrl;
    const price = typeof value.price === 'number' ? value.price : Number(String(value.price ?? '').replace(/,/g, ''));
    if (!url || !url.startsWith(`${origin}/`) || typeof value.title !== 'string' || !value.title.trim() || !Number.isFinite(price) || price <= 0) {
      return;
    }
    found.push({
      id: `${source.siteKey}:${value.id || url.split('?')[0]}`,
      siteKey: source.siteKey, category: source.category,
      title: decodeHtml(value.title).trim(), url,
      brand: typeof value.brand === 'string' && value.brand.trim() ? decodeHtml(value.brand).trim() : defaultBrand(source),
      imageUrl: absoluteUrl(value.image, origin), priceMinor: Math.round(price * 100),
      currency: typeof value.currency === 'string' ? value.currency : 'AED',
      availability: value.available === false ? 'out_of_stock' : value.available === true ? 'in_stock' : 'unknown',
      hasPriceRange: value.range, observedAt
    });
  }

  if (source.provider !== 'html') {
    const payload = JSON.parse(body);
    if (source.provider === 'woocommerce' && Array.isArray(payload)) {
      for (const item of payload) {
        if (!item || typeof item !== 'object') { continue; }
        add({ id: item.id, title: item.name, url: item.permalink, image: item.images?.[0]?.src,
          price: Number(item.prices?.price) / 10 ** Number(item.prices?.currency_minor_unit ?? 2),
          currency: item.prices?.currency_code, available: item.is_in_stock,
          brand: item.brands?.[0]?.name });
      }
    } else if (payload && Array.isArray(payload.products)) {
      return payload.products.slice(0, DISCOVERY_SOURCE_PRODUCT_LIMIT).map((item: unknown) => parseDecathlonListing(item, source.category, observedAt, source.siteKey))
        .filter((item: DiscoveryProduct | undefined): item is DiscoveryProduct => Boolean(item));
    }
    return unique(found);
  }

  // JSON-LD is used by Ounass, Sharaf DG, and some Namshi listing tiles.
  for (const script of body.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(script[1]), (item) => {
        if (item['@type'] !== 'Product') { return; }
        const offers = asRecord(Array.isArray(item.offers) ? item.offers[0] : item.offers);
        const brand = asRecord(item.brand);
        const relativeUrl = typeof item.url === 'string' ? item.url : '';
        const anchorIndex = source.siteKey === 'ounass' ? body.indexOf(`href="${relativeUrl}"`) : -1;
        const tileBrand = anchorIndex >= 0 ? body.slice(anchorIndex, anchorIndex + 12000).split('</a>')[0].match(/class="StyleColorListItem-designer"[^>]*>([^<]+)/)?.[1]?.trim() : undefined;
        add({ title: item.name, url: item.url ?? offers.url, image: imageValue(item.image),
          brand: brand.name ?? item.brand ?? tileBrand, price: offers.price ?? offers.lowPrice,
          currency: offers.priceCurrency, range: offers.lowPrice !== undefined && offers.lowPrice !== offers.highPrice,
          available: typeof offers.availability === 'string' ? !offers.availability.endsWith('OutOfStock') : undefined });
      });
    } catch { /* A malformed optional block must not hide other tiles. */ }
  }

  if (source.siteKey === 'level_shoes' || source.siteKey === 'brands_for_less' || source.siteKey === 'centrepoint_uae') {
    for (const script of body.matchAll(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        visit(JSON.parse(script[1]), (item) => {
          if (typeof item.rawSalePrice === 'number' && item.action) {
            add({ id: item.id, title: item.name, url: asRecord(item.action).url, image: asRecord(item.image).url,
              price: item.rawSalePrice, brand: item.brandName, available: item.isInStock });
          }
          if (source.siteKey === 'brands_for_less' && (item.productUrl || item.url) && (item.name || item.title) && (item.price || item.priceInAED)) {
            add({ id: item.id ?? item.sku, title: item.name ?? item.title, url: item.productUrl ?? item.url,
              image: imageValue(item.image ?? (Array.isArray(item.images) ? item.images[0] : undefined)),
              price: item.priceInAED ?? item.price, brand: item.brandName ?? asRecord(item.brand).name ?? item.brand,
              available: item.inStock ?? item.available });
          }
        });
      } catch { /* Fallback below can still use rendered tiles. */ }
    }
  }

  if (['nike_uae', 'sun_sand_sports', 'adidas', 'faces_uae', 'the_deal'].includes(source.siteKey)) {
    const blocks = body.split(/(?=<div\b[^>]*class=["'][^"']*\bproduct\b[^"']*["'][^>]*data-pid=)/i);
    for (const block of blocks) {
      if (!/data-pid=/.test(block.slice(0, 300))) { continue; }
      const tile = block.slice(0, 35000);
      const tracking = tile.match(/data-(?:gtm-enhanced-?ecommerce-impression|tracking-product-tile)=("|')([\s\S]*?)\1/i);
      let data: RecordValue = {};
      try { const parsed = JSON.parse(decodeHtml(tracking?.[2] ?? '{}')); data = Array.isArray(parsed) ? parsed[0] : parsed; } catch { /* Ignore incomplete tracking data. */ }
      if (!data.item_name && !data.product_name) { continue; }
      const image = tile.match(/<img\b[^>]*>/i)?.[0] ?? tile.match(/<source\b[^>]*>/i)?.[0] ?? '';
      const link = tile.match(/<a\b[^>]*href=["']([^"']*\.html(?:\?[^"']*)?)["']/i)?.[1];
      const current = tile.match(/<(?:span|meta)[^>]*\bcontent=["']([\d.]+)["'][^>]*>/i)?.[1];
      add({ id: tile.match(/data-pid=["']([^"']+)/)?.[1], title: data.item_name ?? data.product_name,
        url: link, image: attribute(image, 'data-src') ?? attribute(image, 'src') ?? attribute(image, 'data-srcset')?.split(/[ ,]/)[0] ?? attribute(image, 'srcset')?.split(/[ ,]/)[0],
        price: current ?? data.product_price ?? data.price,
        brand: source.siteKey === 'adidas' ? 'Adidas' : data.item_brand, available: data.item_in_stock });
    }
  }

  if (source.siteKey === 'puma_uae') {
    for (const tile of body.split(/(?=<a\b[^>]*data-testid="sf-product-tile-)/)) {
      if (!tile.startsWith('<a')) { continue; }
      const fragment = tile.split('</a>')[0];
      const image = fragment.match(/<img\b[^>]*>/)?.[0] ?? '';
      const plain = textContent(fragment);
      add({ id: fragment.match(/sf-product-tile-([^"']+)/)?.[1], title: attribute(image, 'alt'), url: attribute(fragment.split('>')[0], 'href'),
        image: attribute(image, 'src'), price: fragment.match(/aria-label="current price (?:Dh|AED)\s*([\d,.]+)/)?.[1] ?? plain.match(/(?:AED|د\.إ)\s*([\d,.]+)/)?.[1] ?? plain.match(/([\d,.]+)\s*AED/)?.[1], brand: 'Puma' });
    }
  }

  if (source.siteKey === 'amazon_ae') {
    for (const tile of body.split(/(?=<div\b[^>]*data-asin=["'][A-Z0-9]{10}["'])/)) {
      const asin = tile.slice(0, 400).match(/data-asin=["']([A-Z0-9]{10})["']/)?.[1];
      if (!asin) { continue; }
      const image = tile.match(/<img\b[^>]*class=["'][^"']*s-image[^"']*["'][^>]*>/)?.[0] ?? '';
      const title = tile.match(/<h2\b[^>]*[\s\S]*?<\/h2>/)?.[0];
      const priceBlock = tile.match(/<span class="a-price"[\s\S]*?<span class="a-offscreen">([^<]+)/)?.[1];
      add({ id: asin, title: title ? textContent(title) : attribute(image, 'alt'), url: `${origin}/dp/${asin}`,
        image: attribute(image, 'src'), price: priceBlock?.replace(/[^\d.]/g, '') });
    }
  }

  if (source.siteKey === 'namshi' || source.siteKey === 'sephora_uae') {
    const decoded = decodeFlight(body);
    const pattern = source.siteKey === 'namshi' ? /\{"parentSku":/g : /\{"id":"P\d+","name":/g;
    for (const match of decoded.matchAll(pattern)) {
      const item = readJsonObject(decoded, match.index!);
      if (!item) { continue; }
      if (source.siteKey === 'namshi') {
        add({ id: item.parentSku, title: item.title, url: `/uae-en${item.uri}`, brand: item.brand,
          price: item.salePrice ?? item.normalPrice, image: Array.isArray(item.imageKeys) ? `https://f.nooncdn.com/p/${item.imageKeys[0]}` : undefined });
      } else {
        const variants = Array.isArray(item.c_variantsInfo) ? item.c_variantsInfo.map(asRecord) : [];
        const variant = variants.find((entry) => typeof entry.price === 'number');
        const prices = variants.map((entry) => Number(entry.c_price ?? entry.price)).filter((price) => price > 0);
        const images = Array.isArray(variant?.images) ? variant.images.map(asRecord) : [];
        add({ id: item.id, title: item.name, url: `/ae-en${item.c_productSlug}`, brand: asRecord(item.c_brand).name,
          price: prices.length ? Math.min(...prices) : undefined, range: new Set(prices).size > 1, image: images[0]?.disBaseLink });
      }
    }
  }

  if (source.siteKey === 'noon') {
    // Native WebView returns the rendered storefront after its inline state has
    // been consumed. Its QA attributes provide stable product boundaries.
    for (const tile of body.split(/(?=<div\b[^>]*data-qa="plp-product-box")/)) {
      if (!tile.startsWith('<div') || !tile.slice(0, 200).includes('data-qa="plp-product-box"')) { continue; }
      const link = tile.match(/<a\b[^>]*href="([^"]+)"/)?.[1];
      if (!link?.includes('/p/')) { continue; }
      const name = tile.match(/data-qa="productImagePLP_([^"]+)"/)?.[1];
      const title = tile.match(/<h2\b[^>]*title="([^"]+)"/)?.[1];
      const brand = name && title?.endsWith(name) ? title.slice(0, -name.length).trim() : undefined;
      const price = tile.match(/data-qa="plp-product-box-price"[\s\S]*?<strong[^>]*>([\d,.]+)<\/strong>/)?.[1];
      add({ id: link.match(/\/([A-Z0-9]+)\/p\//)?.[1], title: name ?? title, url: link,
        image: attribute(tile.match(/<img\b[^>]*>/)?.[0] ?? '', 'src'), price, brand });
    }
    // The storefront serializes its listing records as JS literals. Read scalar
    // fields from bounded records, without executing the remote script.
    for (const match of body.matchAll(/\{offer_code:"/g)) {
      const next = body.indexOf('{offer_code:"', match.index! + 1);
      const tile = body.slice(match.index, next < 0 ? match.index! + 15000 : next);
      const field = (key: string) => tile.match(new RegExp(`\\b${key}:"((?:\\\\.|[^"\\\\])*)"`))?.[1];
      const price = tile.match(/\bsale_price:([\d.]+)/)?.[1] ?? tile.match(/\bprice:([\d.]+)/)?.[1];
      const slug = field('pdp_url');
      add({ id: field('sku'), title: field('name'), brand: field('brand'), price,
        url: slug ? `/uae-en${slug}` : undefined, image: field('image_url'), available: /is_buyable:!0/.test(tile) });
    }
  }

  return unique(found);
}

function asRecord(value: unknown): RecordValue { return value && typeof value === 'object' ? value as RecordValue : {}; }
function visit(value: unknown, callback: (item: RecordValue) => void) {
  if (!value || typeof value !== 'object') { return; }
  if (Array.isArray(value)) { value.forEach((item) => visit(item, callback)); return; }
  callback(value as RecordValue);
  Object.values(value).forEach((item) => visit(item, callback));
}
function imageValue(value: unknown): unknown {
  if (Array.isArray(value)) { return imageValue(value[0]); }
  return typeof value === 'object' ? asRecord(value).url : value;
}
function defaultBrand(source: DiscoveryCollection): string {
  return ({ nike_uae: 'Nike', adidas: 'Adidas', puma_uae: 'Puma', salomon_gcc: 'Salomon' } as Record<string, string>)[source.siteKey] ?? 'Other brands';
}
function absoluteUrl(value: unknown, origin: string): string | undefined {
  if (typeof value !== 'string' || !value.trim()) { return undefined; }
  const url = decodeHtml(value.trim());
  if (url.startsWith('//')) { return `https:${url}`; }
  if (url.startsWith('/')) { return `${origin}${url}`; }
  return /^https:\/\//i.test(url) ? url : undefined;
}
function attribute(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`(?:^|\\s)${name}=("|')([\\s\\S]*?)\\1`, 'i'))?.[2];
}
export function decodeHtml(text: string): string {
  return text.replace(/&(?:quot|#34);/g, '"').replace(/&(?:apos|#39|#x27);/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code: string) => {
      const value = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
      return value > 0 && value <= 0x10FFFF ? String.fromCodePoint(value) : '';
    });
}
function textContent(html: string): string { return decodeHtml(html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); }
function unique(products: DiscoveryProduct[]): DiscoveryProduct[] { return [...new Map(products.map((product) => [product.url, product])).values()].slice(0, DISCOVERY_SOURCE_PRODUCT_LIMIT); }
function decodeFlight(html: string): string {
  return [...html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)\s*;?\s*<\/script>/g)].map((match) => {
    try { return JSON.parse(match[1])[1] ?? ''; } catch { return ''; }
  }).join('');
}
function readJsonObject(text: string, start: number): RecordValue | undefined {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < Math.min(text.length, start + 200000); index++) {
    const character = text[index];
    if (quoted) {
      if (escaped) { escaped = false; } else if (character === '\\') { escaped = true; } else if (character === '"') { quoted = false; }
    } else if (character === '"') { quoted = true; } else if (character === '{') { depth++; } else if (character === '}' && --depth === 0) {
      try { return JSON.parse(text.slice(start, index + 1)); } catch { return undefined; }
    }
  }
  return undefined;
}
