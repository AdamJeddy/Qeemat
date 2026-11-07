import { getProductSearchCache, saveProductSearchCache } from '../data/discoverySearch';
import { buildSearchRequests, normalizeSearchQuery, parseSearchPage, rankSearchMatches, SearchPage, SearchRequest } from './discoverySearch';
import { DiscoveryFetcher, fetchDiscoveryHtmlViaWebView, mergeDiscoveryProducts } from './discoveryCatalog';
import type { DiscoveryProduct } from './types';
import { recordDiscoveryObservations } from '../data/discoveryHistory';

export type SearchSourceResult = {
  request: SearchRequest;
  status: 'loading' | 'ready' | 'empty' | 'unavailable';
  products: DiscoveryProduct[];
  observedAt?: string;
  nextUrl?: string;
};
export type ProductSearchResult = { query: string; products: DiscoveryProduct[]; sources: SearchSourceResult[]; historyUnavailable?: boolean };
type SearchOptions = {
  requests?: SearchRequest[];
  fetcher?: DiscoveryFetcher;
  force?: boolean;
  loadMore?: boolean;
  previous?: ProductSearchResult;
  isCancelled?: () => boolean;
  onUpdate?: (result: ProductSearchResult) => void;
};

export async function loadProductSearch(input: string, options: SearchOptions = {}): Promise<ProductSearchResult> {
  const query = normalizeSearchQuery(input);
  const requests = options.requests ?? buildSearchRequests(query);
  const previous = options.previous?.query.toLowerCase() === query.toLowerCase() ? options.previous : undefined;
  const cache = previous ?? await getProductSearchCache(query);
  const entries: SearchSourceResult[] = requests.map((request) => {
    const saved = cache?.sources.find((entry) => entry.request.id === request.id);
    return { ...saved, request, products: saved?.products ?? [], status: 'loading' };
  });
  // A continuation retains the exact request set and per-source cursor.
  if (options.loadMore && previous) { entries.splice(0, entries.length, ...previous.sources.map((entry) => ({ ...entry, status: entry.nextUrl ? 'loading' as const : entry.status }))); }
  let historyUnavailable = false;
  const snapshot = (): ProductSearchResult => ({ query, sources: entries.map((entry) => ({ ...entry })), products: rankSearchMatches(mergeDiscoveryProducts(entries.flatMap((entry) => entry.products)), query), ...(historyUnavailable ? { historyUnavailable: true } : {}) });
  const publish = () => { if (!options.isCancelled?.()) { options.onUpdate?.(snapshot()); } };
  const browserFallbacks: { entry: SearchSourceResult; request: SearchRequest; observedAt: string }[] = [];
  async function finish(entry: SearchSourceResult, page: SearchPage | undefined, observedAt: string) {
    if (page) {
      if (entry.products.length && !options.loadMore) { await recordDiscoveryObservations(entry.products).catch(() => { historyUnavailable = true; }); }
      if (options.isCancelled?.()) { return; }
      const observed = page.observedProducts ?? page.products;
      const recorded = await recordDiscoveryObservations(observed).catch(() => { historyUnavailable = true; return observed; });
      const products = page.observedProducts ? rankSearchMatches(recorded, query) : recorded;
      if (options.isCancelled?.()) { return; }
      entry.products = options.loadMore ? mergeDiscoveryProducts([...entry.products, ...products]) : products;
      entry.nextUrl = page.nextUrl; entry.observedAt = observedAt;
      entry.status = entry.products.length ? 'ready' : 'empty';
    } else { entry.status = 'unavailable'; }
    publish();
  }
  publish();
  let index = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (index < entries.length && !options.isCancelled?.()) {
      const entry = entries[index++];
      if (options.loadMore && !entry.nextUrl) { continue; }
      if (!options.force && !options.loadMore && entry.observedAt && Date.now() - Date.parse(entry.observedAt) < 15 * 60 * 1000 && cache?.sources.find((saved) => saved.request.id === entry.request.id)?.status !== 'unavailable') {
        entry.status = entry.products.length ? 'ready' : 'empty'; publish(); continue;
      }
      const request = options.loadMore ? { ...entry.request, url: entry.nextUrl! } : entry.request;
      const observedAt = new Date().toISOString();
      const page = await fetchSearchPage(request, query, observedAt, options.fetcher ?? fetch, options.isCancelled);
      if (options.isCancelled?.()) { return; }
      if (!page && request.provider === 'html') { browserFallbacks.push({ entry, request, observedAt }); }
      else { await finish(entry, page, observedAt); }
    }
  }));
  // Slow browser challenges must not occupy HTTP workers and delay other stores.
  for (const fallback of browserFallbacks) {
    if (options.isCancelled?.()) { break; }
    const body = await fetchDiscoveryHtmlViaWebView(fallback.request.url, options.isCancelled);
    if (options.isCancelled?.()) { break; }
    await finish(fallback.entry, body ? parseSearchPage(body, fallback.request, query, fallback.observedAt) : undefined, fallback.observedAt);
  }
  const result = snapshot();
  if (!options.isCancelled?.()) { await saveProductSearchCache(result); }
  return result;
}

async function fetchSearchPage(request: SearchRequest, query: string, observedAt: string, fetcher: DiscoveryFetcher, isCancelled?: () => boolean) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetcher(request.url, { signal: controller.signal, headers: { Accept: request.provider === 'woocommerce' ? 'application/json' : 'text/html', 'Accept-Language': 'en-AE,en;q=0.9' } });
    if (isCancelled?.()) { return undefined; }
    if (response.text) {
      const body = await response.text();
      // Genuine no-result responses can use 404; challenge shells can use 200.
      const parsed = parseSearchPage(body, request, query, observedAt);
      if (parsed && (response.ok || !parsed.products.length && (response as { status?: number }).status === 404)) { return parsed; }
    }
  } catch { /* Keep source failure independent and try the existing native path. */ }
  finally { clearTimeout(timeout); }
  return undefined;
}

