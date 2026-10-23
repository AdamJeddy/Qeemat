import { SiteKey } from './types';
import { uniqueOrganizationNames } from './organization';

export type WatchlistStoreFilter = 'all' | SiteKey;
export type WatchlistSort = 'recently_updated' | 'lowest_price' | 'largest_drop' | 'closest_to_target' | 'name';
export type WatchlistCollectionFilter = {
  folder?: string;
  tag?: string;
};

type SiteProduct = { siteKey: SiteKey };
type OrganizableProduct = SiteProduct & { folder?: string; tags?: string[] };
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

export function getWatchlistTags(products: OrganizableProduct[]): string[] {
  return uniqueOrganizationNames(products.flatMap((product) => product.tags ?? []));
}

export function filterWatchlistProducts<T extends OrganizableProduct>(
  products: T[],
  storeFilter: WatchlistStoreFilter,
  collectionFilter: WatchlistCollectionFilter = {}
): T[] {
  return products.filter((product) => {
    const matchesStore = storeFilter === 'all' || product.siteKey === storeFilter;
    const matchesFolder = !collectionFilter.folder || product.folder === collectionFilter.folder;
    const matchesTag = !collectionFilter.tag || product.tags?.includes(collectionFilter.tag);
    return matchesStore && matchesFolder && matchesTag;
  });
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
