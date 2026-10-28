import type { DiscoveryProduct, SiteKey } from './types';
import type { DiscoveryCollection } from './discovery';
import { parseDiscoveryListing } from './discoveryListings';

export type SearchRequest = DiscoveryCollection & { url: string };
export type SearchPage = { products: DiscoveryProduct[]; nextUrl?: string };

const SEARCH_URLS: Partial<Record<SiteKey, string>> = {
  nike_uae: 'https://www.nike.ae/en/search?q=',
  sun_sand_sports: 'https://en-ae.sssports.com/search?q=',
  adidas: 'https://www.adidas.ae/en/search?q=',
  puma_uae: 'https://ae.puma.com/ae/en/search?q=',
  level_shoes: 'https://www.levelshoes.com/search?term=',
  namshi: 'https://www.namshi.com/uae-en/search/?q=',
  the_deal: 'https://www.thedealoutlet.com/ae-en/search?q=',
  faces_uae: 'https://www.faces.ae/en/search?q=',
  noon: 'https://www.noon.com/uae-en/search/?q=',
  carrefour_uae: 'https://www.carrefouruae.com/mafuae/en/search?keyword=',
  ay_accessories: 'https://ay-accessories.com/wp-json/wc/store/v1/products?per_page=20&search='
};

export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').slice(0, 120);
}

export function buildSearchRequests(input: string): SearchRequest[] {
  const query = normalizeSearchQuery(input);
  if (query.length < 2 || !searchTokens(query).length) { return []; }
  const requests = Object.entries(SEARCH_URLS).map(([site, prefix]) => ({
    id: `search-${site}`, siteKey: site as SiteKey, label: 'Product search', category: 'general' as const,
    provider: site === 'ay_accessories' ? 'woocommerce' as const : 'html' as const, url: `${prefix}${encodeURIComponent(query)}`
  }));
  return [...requests, ...['women', 'men', 'kids'].map((audience): SearchRequest => ({
    id: `search-ounass-${audience}`, siteKey: 'ounass', label: `${audience} product search`, category: 'general', provider: 'html',
    url: `https://www.ounass.ae/${audience}?fh_location=%2F%24s%3D${encodeURIComponent(query)}`
  }))];
}

const WORDS: Record<string, string> = {
  shoe: 'shoe', shoes: 'shoe', sneaker: 'shoe', sneakers: 'shoe', trainer: 'shoe', trainers: 'shoe',
  perfume: 'fragrance', perfumes: 'fragrance', parfum: 'fragrance', fragrance: 'fragrance', fragrances: 'fragrance', edp: 'fragrance', edt: 'fragrance'
};
function searchTokens(value: string): string[] {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/([a-zA-Z])([0-9])/g, '$1 $2').replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    .toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word && !['the', 'for', 'and'].includes(word)).map((word) => WORDS[word] ?? word);
}

/** Conservative matching: alternatives and model-number mismatches are not exact results. */
export function matchesProductSearch(product: DiscoveryProduct, query: string): boolean {
  const wanted = searchTokens(query);
  const actual = new Set(searchTokens(`${product.brand === 'Other brands' ? '' : product.brand} ${product.title}`));
  return wanted.length > 0 && wanted.every((word) => actual.has(word));
}

/** Undefined means unverified/unreadable, never a claim that the store has no matches. */
export function parseSearchPage(body: string, request: SearchRequest, query: string, observedAt: string): SearchPage | undefined {
  if (/cf_chl_opt|cf-browser-verify|<title>\s*just a moment|reference&#|<title>\s*access denied/i.test(body)) { return undefined; }
  let listingBody = body;
  let verifiedEmpty = false;
  if (request.siteKey === 'level_shoes') {
    const json = body.match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
    if (!json) { return undefined; }
    try {
      const root = JSON.parse(json).props?.pageProps?.__APOLLO_STATE__?.ROOT_QUERY;
      const lists = Object.entries(root ?? {}).filter(([key]) => key.startsWith('_productList:')).map(([, value]) => value as { products?: unknown[]; analytics?: { constructor?: { request?: { term?: string } } } });
      const list = lists.find((item) => normalizeSearchQuery(item.analytics?.constructor?.request?.term ?? '').toLowerCase() === query.toLowerCase());
      if (!Array.isArray(list?.products)) { return undefined; }
      verifiedEmpty = list.products.length === 0;
      listingBody = `<script id="__NEXT_DATA__">${JSON.stringify({ products: list.products })}</script>`;
    } catch { return undefined; }
  }
  let products: DiscoveryProduct[];
  try { products = parseDiscoveryListing(listingBody, request, observedAt); }
  catch { return undefined; }
  const text = body.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ');
  const explicitEmpty = /no (?:matching )?(?:products|results|matches)(?: were)? (?:found|available|for)|could(?:n.t| not) find|0 (?:products|results)|did not match any/i.test(text);
  const emptyJson = request.provider === 'woocommerce' && body.trim() === '[]';
  if (!products.length && !verifiedEmpty && !explicitEmpty && !emptyJson) { return undefined; }
  return { products: products.filter((product) => matchesProductSearch(product, query)), ...nextSearchPage(body, request, query, products.length) };
}

function nextSearchPage(body: string, request: SearchRequest, query: string, count: number): { nextUrl?: string } {
  const origin = request.url.match(/^https:\/\/[^/]+/)![0];
  if (request.provider === 'woocommerce') {
    if (count < 20) { return {}; }
    const page = Number(request.url.match(/[?&]page=(\d+)/)?.[1] ?? 1);
    return { nextUrl: `${request.url.replace(/&page=\d+/, '')}&page=${page + 1}` };
  }
  const start = Number(request.url.match(/[?&]start=(\d+)/)?.[1] ?? 0);
  for (const match of body.matchAll(/(?:href|data-url|data-load-more-url)=["']([^"']+)["']/gi)) {
    const path = match[1].replace(/&amp;/g, '&');
    const url = path.startsWith('/') ? `${origin}${path}` : path;
    if (!url.startsWith(`${origin}/`)) { continue; }
    if (/\/Search-UpdateGrid\?/.test(url) && Number(url.match(/[?&]start=(\d+)/)?.[1] ?? 0) > start) {
      // Nike can redirect a keyword to a real collection and expose cgid instead.
      if (url.includes(`q=${encodeURIComponent(query)}`) || request.siteKey === 'nike_uae' && /[?&]cgid=/.test(url)) { return { nextUrl: url }; }
    }
    const page = Number(request.url.match(/[?&]page=(\d+)/)?.[1] ?? 1);
    if (request.siteKey === 'namshi' && url.includes('/search/?') && url.includes(`q=${encodeURIComponent(query)}`) && Number(url.match(/[?&]page=(\d+)/)?.[1]) === page + 1) { return { nextUrl: url }; }
    if (request.siteKey === 'puma_uae' && path === `/ae/en/search?page=${page + 1}`) { return { nextUrl: `${url}&q=${encodeURIComponent(query)}` }; }
  }
  return {};
}
