import { DISCOVERY_PARSER_VERSION, getDiscoveryAttempt, getDiscoveryCache, saveDiscoveryAttempt, saveDiscoveryCache } from '../data/discovery';
import { DiscoveryProduct } from './types';
import { DiscoveryCollection, DISCOVERY_SOURCE_PRODUCT_LIMIT, discoverySourceUrl, parseDecathlonListing } from './discovery';
import { parseDiscoveryListing } from './discoveryListings';
import { fetchPageHtmlViaWebView } from './webViewFetcher';
import { DiscoveryScope, selectDiscoveryCollections } from './discoverySources';
import { withDiscoveryPriceBasis } from './priceBasis';

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
  refreshing?: boolean;
  failedCollectionIds: string[];
  sources?: DiscoverySourceStatus[];
};

let webViewQueue: Promise<unknown> = Promise.resolve();
let catalogQueue: Promise<unknown> = Promise.resolve();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function fetchDiscoveryHtmlViaWebView(url: string, isCancelled?: () => boolean): Promise<string | null> {
  const request = webViewQueue.then(() => isCancelled?.() ? null : fetchPageHtmlViaWebView(url));
  webViewQueue = request.catch(() => null);
  return request;
}

type DiscoveryCatalogOptions = {
  force?: boolean;
  scope?: DiscoveryScope;
  isCancelled?: () => boolean;
  onUpdate?: (catalog: DiscoveryCatalogResult) => void;
};

export function loadDiscoveryCatalog(fetcher: DiscoveryFetcher = fetch, options: DiscoveryCatalogOptions = {}): Promise<DiscoveryCatalogResult> {
  // A pull-to-refresh must follow the current load's writes and notifications.
  const request = catalogQueue.then(() => refreshDiscoveryCatalog(fetcher, options));
  catalogQueue = request.catch(() => undefined);
  return request;
}

async function refreshDiscoveryCatalog(fetcher: DiscoveryFetcher, options: DiscoveryCatalogOptions): Promise<DiscoveryCatalogResult> {
  const observedAt = new Date().toISOString();
  const sources = selectDiscoveryCollections(options.scope);
  const entries = await Promise.all(sources.map(async (source) => {
    const [cached, attempt] = await Promise.all([getDiscoveryCache(source.id), getDiscoveryAttempt(source.id)]);
    const recent = (timestamp: number) => Number.isFinite(timestamp) && Date.now() >= timestamp && Date.now() - timestamp < CACHE_TTL_MS;
    const fresh = cached?.parserVersion === DISCOVERY_PARSER_VERSION && recent(Date.parse(cached.fetchedAt));
    return { source, cached, failed: attempt?.failed ?? false,
      needsRefresh: Boolean(options.force || (!fresh && !(attempt && recent(attempt.attemptedAt)))) };
  }));
  const snapshot = (): DiscoveryCatalogResult => ({
    products: mergeDiscoveryProducts(entries.flatMap((entry) => (entry.cached?.products ?? []).map((product) => withDiscoveryPriceBasis({
      ...product, priceBasis: entry.cached?.parserVersion !== DISCOVERY_PARSER_VERSION && product.priceBasis?.startsWith('pack:') ? undefined : product.priceBasis,
      category: entry.source.category, categories: [entry.source.category], collectionIds: [entry.source.id]
    })))),
    refreshedAt: entries.map((entry) => entry.cached?.fetchedAt).filter((date): date is string => Boolean(date)).sort()[0],
    stale: entries.some((entry) => entry.failed || (entry.cached && Date.now() - Date.parse(entry.cached.fetchedAt) >= CACHE_TTL_MS)),
    refreshing: entries.some((entry) => entry.needsRefresh),
    failedCollectionIds: entries.filter((entry) => entry.failed).map((entry) => entry.source.id),
    sources: entries.map((entry) => ({ id: entry.source.id, count: entry.cached?.products.length ?? 0, fetchedAt: entry.cached?.fetchedAt, failed: entry.failed }))
  });
  options.onUpdate?.(snapshot());
  let index = 0;
  const workers = await Promise.allSettled(Array.from({ length: 4 }, async () => {
    while (index < entries.length) {
      if (options.isCancelled?.()) { break; }
      const entry = entries[index++];
      if (!entry.needsRefresh) { continue; }
      entry.failed = false;
      try {
        const products = (await fetchDiscoveryCollection(entry.source, fetcher, observedAt, options.isCancelled)).map(withDiscoveryPriceBasis);
        if (!products.length) { throw new Error('No usable listing products'); }
        await saveDiscoveryCache(entry.source.id, products, observedAt);
        entry.cached = { products, fetchedAt: observedAt, parserVersion: DISCOVERY_PARSER_VERSION };
      } catch { entry.failed = true; }
      await saveDiscoveryAttempt(entry.source.id, entry.failed);
      entry.needsRefresh = false;
      if (__DEV__) { console.info(`[Discovery] ${entry.source.id}: ${entry.cached?.products.length ?? 0} products${entry.failed ? ' (refresh failed)' : ''}`); }
      options.onUpdate?.(snapshot());
    }
  }));
  // Do not release the queue while another worker can still write or publish.
  const failedWorker = workers.find((worker) => worker.status === 'rejected');
  if (failedWorker?.status === 'rejected') { throw failedWorker.reason; }
  return snapshot();
}

async function fetchDiscoveryCollection(source: DiscoveryCollection, fetcher: DiscoveryFetcher, observedAt: string, isCancelled?: () => boolean): Promise<DiscoveryProduct[]> {
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
  const html = await fetchDiscoveryHtmlViaWebView(discoverySourceUrl(source), isCancelled);
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
    .slice(0, DISCOVERY_SOURCE_PRODUCT_LIMIT)
    .map((product) => parseDecathlonListing(product, collection.category, observedAt, collection.siteKey))
    .filter((product): product is DiscoveryProduct => product !== undefined);
}

function isProductListing(value: unknown): value is { products: unknown[] } {
  return Boolean(value) && typeof value === 'object' && Array.isArray((value as { products?: unknown[] }).products);
}

export function mergeDiscoveryProducts(products: DiscoveryProduct[]): DiscoveryProduct[] {
  const byId = new Map<string, DiscoveryProduct>();
  for (const product of products) {
    const existing = byId.get(product.id);
    const latest = !existing || Date.parse(product.observedAt) > Date.parse(existing.observedAt) ? product : existing;
    byId.set(product.id, { ...latest,
      categories: [...new Set([...(existing?.categories ?? (existing ? [existing.category] : [])), ...(product.categories ?? [product.category])])],
      collectionIds: [...new Set([...(existing?.collectionIds ?? []), ...(product.collectionIds ?? [])])]
    });
  }
  return [...byId.values()];
}
