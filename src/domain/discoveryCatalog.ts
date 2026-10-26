import { DISCOVERY_PARSER_VERSION, getDiscoveryCache, saveDiscoveryCache } from '../data/discovery';
import { DiscoveryProduct } from './types';
import { DiscoveryCollection, DISCOVERY_COLLECTIONS, discoverySourceUrl, parseDecathlonListing } from './discovery';
import { parseDiscoveryListing } from './discoveryListings';
import { fetchPageHtmlViaWebView } from './webViewFetcher';

type FetchResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
  text?: () => Promise<string>;
};

export type DiscoveryFetcher = (url: string, options?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<FetchResponse>;

export type DiscoverySourceStatus = { id: string; count: number; fetchedAt?: string; failed: boolean };

export type DiscoveryCatalogResult = {
  products: DiscoveryProduct[];
  refreshedAt?: string;
  stale: boolean;
  failedCollectionIds: string[];
  sources?: DiscoverySourceStatus[];
};

let webViewQueue: Promise<unknown> = Promise.resolve();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function loadDiscoveryCatalog(fetcher: DiscoveryFetcher = fetch, options: {
  force?: boolean;
  onUpdate?: (catalog: DiscoveryCatalogResult) => void;
} = {}): Promise<DiscoveryCatalogResult> {
  const observedAt = new Date().toISOString();
  const entries = await Promise.all(DISCOVERY_COLLECTIONS.map(async (source) => ({
    source, cached: await getDiscoveryCache(source.id), failed: false
  })));
  const snapshot = (): DiscoveryCatalogResult => ({
    products: uniqueProducts(entries.flatMap((entry) => entry.cached?.products ?? [])),
    refreshedAt: entries.map((entry) => entry.cached?.fetchedAt).filter((date): date is string => Boolean(date)).sort()[0],
    stale: entries.some((entry) => entry.failed || (entry.cached && Date.now() - Date.parse(entry.cached.fetchedAt) >= CACHE_TTL_MS)),
    failedCollectionIds: entries.filter((entry) => entry.failed).map((entry) => entry.source.id),
    sources: entries.map((entry) => ({ id: entry.source.id, count: entry.cached?.products.length ?? 0, fetchedAt: entry.cached?.fetchedAt, failed: entry.failed }))
  });
  options.onUpdate?.(snapshot());
  let index = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (index < entries.length) {
      const entry = entries[index++];
      if (!options.force && entry.cached?.parserVersion === DISCOVERY_PARSER_VERSION && Date.now() - Date.parse(entry.cached.fetchedAt) < CACHE_TTL_MS) { continue; }
      try {
        const products = await fetchDiscoveryCollection(entry.source, fetcher, observedAt);
        if (!products.length) { throw new Error('No usable listing products'); }
        await saveDiscoveryCache(entry.source.id, products, observedAt);
        entry.cached = { products, fetchedAt: observedAt, parserVersion: DISCOVERY_PARSER_VERSION };
      } catch { entry.failed = true; }
      if (__DEV__) { console.info(`[Discovery] ${entry.source.id}: ${entry.cached?.products.length ?? 0} products${entry.failed ? ' (refresh failed)' : ''}`); }
      options.onUpdate?.(snapshot());
    }
  }));
  return snapshot();
}

async function fetchDiscoveryCollection(source: DiscoveryCollection, fetcher: DiscoveryFetcher, observedAt: string): Promise<DiscoveryProduct[]> {
  if (!source.provider || source.provider === 'shopify') {
    return fetchDecathlonCollection(source, fetcher, observedAt);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetcher(discoverySourceUrl(source), { signal: controller.signal, headers: {
      Accept: source.provider === 'woocommerce' ? 'application/json' : 'text/html',
      'Accept-Language': 'en-AE,en;q=0.9'
    } });
    if (response.ok && response.text) {
      const products = parseDiscoveryListing(await response.text(), source, observedAt);
      if (products.length) { return products; }
    }
  } catch { /* The native browser can recover protected or redirecting stores. */ }
  finally { clearTimeout(timeout); }
  if (source.provider !== 'html') { throw new Error(`Could not read ${source.label}`); }
  const request = webViewQueue.then(() => fetchPageHtmlViaWebView(discoverySourceUrl(source)));
  webViewQueue = request.catch(() => null);
  const html = await request;
  return html ? parseDiscoveryListing(html, source, observedAt) : [];
}

export async function fetchDecathlonCollection(
  collection: DiscoveryCollection,
  fetcher: DiscoveryFetcher = fetch,
  observedAt = new Date().toISOString()
): Promise<DiscoveryProduct[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  let payload: unknown;
  try {
    const response = await fetcher(
      discoverySourceUrl(collection),
      { signal: controller.signal, headers: { Accept: 'application/json', 'Accept-Language': 'en-AE,en;q=0.9' } }
    );
    if (!response.ok) { throw new Error(`Could not refresh ${collection.label}`); }
    payload = await response.json();
  } finally { clearTimeout(timeout); }
  if (!isProductListing(payload)) {
    throw new Error(`Could not read ${collection.label}`);
  }

  return payload.products
    .map((product) => parseDecathlonListing(product, collection.category, observedAt, collection.siteKey))
    .filter((product): product is DiscoveryProduct => product !== undefined);
}

function isProductListing(value: unknown): value is { products: unknown[] } {
  return Boolean(value) && typeof value === 'object' && Array.isArray((value as { products?: unknown[] }).products);
}

function uniqueProducts(products: DiscoveryProduct[]): DiscoveryProduct[] {
  const byId = new Map<string, DiscoveryProduct>();
  for (const product of products) {
    if (!byId.has(product.id)) {
      byId.set(product.id, product);
    }
  }
  return [...byId.values()];
}
