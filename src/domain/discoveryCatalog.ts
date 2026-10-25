import { getDiscoveryCache, saveDiscoveryCache } from '../data/discovery';
import { DiscoveryProduct } from './types';
import { DiscoveryCollection, DISCOVERY_COLLECTIONS, parseDecathlonListing } from './discovery';

type FetchResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

export type DiscoveryFetcher = (url: string, options?: { headers?: Record<string, string> }) => Promise<FetchResponse>;

export type DiscoveryCatalogResult = {
  products: DiscoveryProduct[];
  refreshedAt?: string;
  stale: boolean;
  failedCollectionIds: string[];
};

export async function loadDiscoveryCatalog(fetcher: DiscoveryFetcher = fetch): Promise<DiscoveryCatalogResult> {
  const observedAt = new Date().toISOString();
  const results = await Promise.all(DISCOVERY_COLLECTIONS.map(async (collection) => {
    const cached = await getDiscoveryCache(collection.id);

    try {
      const products = await fetchDecathlonCollection(collection, fetcher, observedAt);
      await saveDiscoveryCache(collection.id, products, observedAt);
      return { products, refreshedAt: observedAt, failed: false };
    } catch {
      return {
        products: cached?.products ?? [],
        refreshedAt: cached?.fetchedAt,
        failed: true,
        collectionId: collection.id
      };
    }
  }));

  const refreshedAt = results
    .map((result) => result.refreshedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return {
    products: uniqueProducts(results.flatMap((result) => result.products)),
    refreshedAt,
    stale: results.some((result) => result.failed),
    failedCollectionIds: results
      .filter((result): result is typeof result & { collectionId: string } => result.failed && Boolean(result.collectionId))
      .map((result) => result.collectionId)
  };
}

export async function fetchDecathlonCollection(
  collection: DiscoveryCollection,
  fetcher: DiscoveryFetcher = fetch,
  observedAt = new Date().toISOString()
): Promise<DiscoveryProduct[]> {
  const response = await fetcher(
    `https://decathlon.ae/collections/${collection.collectionHandle}/products.json?limit=24`,
    { headers: { Accept: 'application/json', 'Accept-Language': 'en-AE,en;q=0.9' } }
  );
  if (!response.ok) {
    throw new Error(`Could not refresh ${collection.label}`);
  }

  const payload = await response.json();
  if (!isProductListing(payload)) {
    throw new Error(`Could not read ${collection.label}`);
  }

  return payload.products
    .map((product) => parseDecathlonListing(product, collection.category, observedAt))
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
