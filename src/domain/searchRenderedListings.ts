import type { DiscoveryProduct, SiteKey } from './types';
import { parseDiscoveryListing } from './discoveryListings';

const ORIGINS: Partial<Record<SiteKey, string>> = { centrepoint_uae: 'https://www.centrepointstores.com', sephora_uae: 'https://www.sephora.me', decathlon_uae: 'https://decathlon.ae', salomon_gcc: 'https://salomongcc.com', amazon_ae: 'https://www.amazon.ae' };
const decode = (value: string) => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
const text = (value: string) => decode(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}=(["'])([\\s\\S]*?)\\1`, 'i'))?.[2];

/** Current public search markup, distinct from the collection-feed formats. */
export function parseRenderedSearch(body: string, siteKey: SiteKey, observedAt: string): DiscoveryProduct[] | undefined {
  const origin = ORIGINS[siteKey];
  if (!origin) { return undefined; }
  const products: DiscoveryProduct[] = [];
  if (siteKey === 'amazon_ae') {
    let cards = 0;
    for (const opening of body.matchAll(/<div\b[^>]*data-component-type="s-search-result"[^>]*>/g)) {
      cards++;
      if (/\bAdHolder\b/.test(opening[0])) { continue; }
      const tags = /<\/?div\b[^>]*>/g;
      tags.lastIndex = opening.index! + opening[0].length;
      let depth = 1; let tag: RegExpExecArray | null;
      while ((tag = tags.exec(body))) {
        depth += tag[0].startsWith('</') ? -1 : 1;
        if (!depth) {
          products.push(...parseDiscoveryListing(body.slice(opening.index, tags.lastIndex), { id: 'search-amazon_ae', siteKey, category: 'general', label: 'Search', provider: 'html', url: `${origin}/s` }, observedAt));
          break;
        }
      }
    }
    return cards ? products : undefined;
  }
  function add(id: string, title: string, path: string, price: number, brand = 'Other brands', image?: string, range = false, available = true, searchCategory?: string) {
    const url = decode(path).split('?')[0];
    const absolute = url.startsWith('/') && !url.startsWith('//') ? `${origin}${url}` : url;
    if (!title || !absolute.startsWith(`${origin}/`) || !Number.isFinite(price) || price <= 0) { return; }
    products.push({ id: `${siteKey}:${id}`, siteKey, category: 'general', title: text(title), url: absolute, priceMinor: Math.round(price * 100), brand: text(brand), imageUrl: image?.startsWith('//') ? `https:${decode(image)}` : image ? decode(image) : undefined,
      currency: 'AED', availability: available ? 'unknown' : 'out_of_stock', hasPriceRange: range, observedAt, searchCategory });
  }
  if (siteKey === 'centrepoint_uae') {
    try {
      const json = body.match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
      const encoded = json ? JSON.parse(json).props?.initialState : undefined;
      if (typeof encoded !== 'string') { return undefined; }
      const state = JSON.parse(decodeBase64Utf8(encoded));
      const hits = state.algoliaProductReducer?.data?.hits ?? state.algoliaProductReducer?.init?.hits;
      if (!Array.isArray(hits)) { return undefined; }
      for (const item of hits) {
        if (typeof item.url !== 'string' || typeof item.title !== 'string') { continue; }
        const range = Array.isArray(item.sale_price_range) && new Set(item.sale_price_range).size > 1;
        add(String(item.pid), item.title, `/ae/en${item.url}`, Number(item.low_sale_price ?? item.sale_price ?? item.price), item.brand, item.thumb_image, range);
      }
    } catch { return undefined; }
    return products;
  }
  if (siteKey === 'sephora_uae') {
    for (const tile of body.split(/(?=<div\b[^>]*data-cnstrc-item-id=)/)) {
      const opening = tile.slice(0, tile.indexOf('>') + 1);
      const id = attr(opening, 'data-cnstrc-item-id');
      if (!id) { continue; }
      const price = tile.match(/<p\b[^>]*class="[^"]*\bfont-bold\b[^"]*"[^>]*>\s*AED(?:&nbsp;|\s)*([\d,.]+)/)?.[1];
      const path = tile.match(/href="([^" ]*\/ae-en\/p\/[^" ]+)"/)?.[1];
      const title = attr(opening, 'data-cnstrc-item-name');
      const image = tile.match(/<img\b[^>]*>/)?.[0] ?? '';
      if (path && title && price) { add(id, title, path, Number(price.replace(/,/g, '')), undefined, attr(image, 'src'), /\bFrom\s+AED/i.test(text(tile))); }
    }
    return products.length ? products : undefined;
  }
  if (siteKey === 'decathlon_uae') {
    for (const match of body.matchAll(/<product-item\b[^>]*>([\s\S]*?)<\/product-item>/g)) {
      const tile = match[1];
      const path = tile.match(/href="([^" ]*\/products\/[^" ]+)"/)?.[1];
      const title = tile.match(/<h2\b[^>]*class="[^"]*\bproduct-title\b[^"]*"[^>]*>([\s\S]*?)<\/h2>/)?.[1];
      const brand = tile.match(/<h2 class="product-item-meta-top">([^<]+)<\/h2>/)?.[1];
      const price = tile.match(/<span\b[^>]*class="price(?:\s+[^"]*)?"[^>]*>[\s\S]*?(?:Dhs\.|AED)\s*([\d,.]+)/)?.[1];
      const image = tile.match(/<img\b[^>]*>/)?.[0] ?? '';
      if (path && title && price) { add(path.split('?')[0], title, path, Number(price.replace(/,/g, '')), brand, attr(image, 'src'), /\bFrom\s+(?:Dhs\.|AED)/i.test(text(tile)), !/\bSold out\b/i.test(text(tile))); }
    }
    return products.length ? products : undefined;
  }
  for (const match of body.matchAll(/<li\b[^>]*class="product"[^>]*>([\s\S]*?)<\/li>/g)) {
    const tile = match[1];
    const title = attr(tile.match(/<a\b[^>]*data-product-title=[^>]+>/)?.[0] ?? '', 'data-product-title');
    const path = tile.match(/href="([^" ]*\/products\/[^" ]+)"/)?.[1];
    const selling = tile.match(/<span class="price-item price-item--sale">\s*AED\s*([\d,.]+)/)?.[1] ?? tile.match(/<span class="price-item price-item--regular">\s*AED\s*([\d,.]+)/)?.[1];
    const image = tile.match(/<img\b[^>]*>/)?.[0] ?? '';
    const category = tile.match(/<p\b[^>]*>([^<]+)<\/p>/)?.[1];
    if (path && title && selling) { add(path.split('?')[0], title, path, Number(selling.replace(/,/g, '')), 'Salomon', attr(image, 'src'), false, !/\bSold out\b/i.test(text(tile)), category); }
  }
  return products.length ? products : undefined;
}

/** Hermes-independent decoding of the storefront's public UTF-8 state. */
function decodeBase64Utf8(input: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let bits = 0; let buffer = 0; let encoded = '';
  for (const char of input.replace(/[=]+$/, '')) {
    const value = alphabet.indexOf(char);
    if (value < 0) { throw new Error('Invalid storefront state'); }
    buffer = buffer * 64 + value; bits += 6;
    if (bits >= 8) { bits -= 8; const byte = Math.floor(buffer / 2 ** bits) % 256; buffer %= 2 ** bits; encoded += `%${byte.toString(16).padStart(2, '0')}`; }
  }
  return decodeURIComponent(encoded);
}
