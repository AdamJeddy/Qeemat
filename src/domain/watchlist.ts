import { SiteKey } from './types';

export type WatchlistStoreFilter = 'all' | SiteKey;

type SiteProduct = { siteKey: SiteKey };

export function getWatchlistSites(products: SiteProduct[]): SiteKey[] {
  return [...new Set(products.map((product) => product.siteKey))];
}

export function filterWatchlistProducts<T extends SiteProduct>(
  products: T[],
  storeFilter: WatchlistStoreFilter
): T[] {
  return storeFilter === 'all'
    ? products
    : products.filter((product) => product.siteKey === storeFilter);
}
