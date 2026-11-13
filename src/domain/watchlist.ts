import { SiteKey } from './types';
import { getSiteByKey } from './sites';
import { uniqueOrganizationNames } from './organization';

export type WatchlistStoreFilter = 'all' | SiteKey;
export type WatchlistSort = 'recently_updated' | 'lowest_price' | 'largest_drop' | 'closest_to_target' | 'name';
export type WatchlistCollectionFilter = {
  folder?: string;
  query?: string;
};

type SiteProduct = { siteKey: SiteKey };
type OrganizableProduct = SiteProduct & { folder?: string };
type SearchableProduct = OrganizableProduct & {
  title: string;
  variant?: { label?: string };
};
type SortableProduct = SiteProduct & {
  title: string;
  currentPriceMinor?: number;
  previousPriceMinor?: number;
  targetPriceMinor?: number;
  updatedAt: string;
};

export function getWatchlistSites(products: SiteProduct[]): SiteKey[] {
  return [...new Set(products.map((product) => product.siteKey))];
}

export function getWatchlistFolders(products: OrganizableProduct[]): string[] {
  return uniqueOrganizationNames(products.map((product) => product.folder));
}

export function filterWatchlistProducts<T extends OrganizableProduct>(
  products: T[],
  storeFilter: WatchlistStoreFilter,
  collectionFilter: WatchlistCollectionFilter = {}
): T[] {
  return products.filter((product) => {
    const matchesStore = storeFilter === 'all' || product.siteKey === storeFilter;
    const matchesFolder = !collectionFilter.folder || product.folder === collectionFilter.folder;
    return matchesStore && matchesFolder;
  });
}

/**
 * Case-insensitive, multi-term (AND) search over the fields a shopper can see
 * on a watchlist row: product title, retailer name, folder and selected option.
 */
export function matchesWatchlistSearch(product: SearchableProduct, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) {
    return true;
  }

  const site = getSiteByKey(product.siteKey);
  const haystack = [product.title, product.folder, product.variant?.label, site.shortName, site.displayName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return terms.every((term) => haystack.includes(term));
}

export function searchWatchlistProducts<T extends SearchableProduct>(products: T[], query: string): T[] {
  const normalizedQuery = query.trim();
  return normalizedQuery ? products.filter((product) => matchesWatchlistSearch(product, normalizedQuery)) : products;
}

export function sortWatchlistProducts<T extends SortableProduct>(products: T[], sort: WatchlistSort): T[] {
  return [...products].sort((left, right) => {
    if (sort === 'lowest_price') {
      return compareNumber(left.currentPriceMinor, right.currentPriceMinor) || compareUpdated(left, right);
    }

    if (sort === 'largest_drop') {
      return compareNumberDescending(priceDrop(left), priceDrop(right)) || compareUpdated(left, right);
    }

    if (sort === 'closest_to_target') {
      return compareNumber(targetDistance(left), targetDistance(right)) || compareUpdated(left, right);
    }

    if (sort === 'name') {
      return left.title.localeCompare(right.title);
    }

    return compareUpdated(left, right);
  });
}

function compareUpdated(left: { updatedAt: string }, right: { updatedAt: string }): number {
  return right.updatedAt.localeCompare(left.updatedAt);
}

function compareNumber(left: number | undefined, right: number | undefined): number {
  if (left === undefined && right === undefined) {
    return 0;
  }

  if (left === undefined) {
    return 1;
  }

  if (right === undefined) {
    return -1;
  }

  return left - right;
}

function compareNumberDescending(left: number | undefined, right: number | undefined): number {
  if (left === undefined && right === undefined) {
    return 0;
  }

  if (left === undefined) {
    return 1;
  }

  if (right === undefined) {
    return -1;
  }

  return right - left;
}

function priceDrop(product: SortableProduct): number | undefined {
  if (product.currentPriceMinor === undefined || product.previousPriceMinor === undefined) {
    return undefined;
  }

  return Math.max(0, product.previousPriceMinor - product.currentPriceMinor);
}

function targetDistance(product: SortableProduct): number | undefined {
  if (product.currentPriceMinor === undefined || product.targetPriceMinor === undefined) {
    return undefined;
  }

  return Math.max(0, product.currentPriceMinor - product.targetPriceMinor);
}
