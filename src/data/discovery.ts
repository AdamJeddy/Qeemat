import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DiscoveryPreferences,
  DiscoveryProduct
} from '../domain/types';
import { DEFAULT_DISCOVERY_PREFERENCES } from '../domain/discovery';

const PREFERENCES_KEY = 'qeemat.discovery.preferences.v1';
const CACHE_KEY = 'qeemat.discovery.cache.v1';
const MAX_FEEDBACK_IDS = 300;

export type DiscoveryCacheEntry = {
  products: DiscoveryProduct[];
  fetchedAt: string;
};

export async function getDiscoveryPreferences(): Promise<DiscoveryPreferences> {
  const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
  if (!raw) {
    return { ...DEFAULT_DISCOVERY_PREFERENCES };
  }

  try {
    return normalizePreferences(JSON.parse(raw) as Partial<DiscoveryPreferences>);
  } catch {
    return { ...DEFAULT_DISCOVERY_PREFERENCES };
  }
}

export async function saveDiscoveryPreferences(
  update: Pick<DiscoveryPreferences, 'completed' | 'categories' | 'favoriteBrands' | 'budgetsByCategory'>
): Promise<DiscoveryPreferences> {
  const current = await getDiscoveryPreferences();
  const next = normalizePreferences({
    ...current,
    ...update
  });
  await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
  return next;
}

export async function markDiscoveryProductsSeen(productIds: string[]): Promise<void> {
  if (!productIds.length) {
    return;
  }

  const current = await getDiscoveryPreferences();
  await writePreferences({
    ...current,
    seenProductIds: capIds([...current.seenProductIds, ...productIds])
  });
}

export async function dismissDiscoveryProduct(productId: string): Promise<void> {
  const current = await getDiscoveryPreferences();
  await writePreferences({
    ...current,
    dismissedProductIds: capIds([...current.dismissedProductIds, productId])
  });
}

export async function getDiscoveryCache(collectionId: string): Promise<DiscoveryCacheEntry | undefined> {
  const cache = await readCache();
  return cache[collectionId];
}

export async function saveDiscoveryCache(collectionId: string, products: DiscoveryProduct[], fetchedAt: string): Promise<void> {
  const cache = await readCache();
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
    ...cache,
    [collectionId]: { products, fetchedAt }
  }));
}

export async function clearDiscoveryData(): Promise<void> {
  await AsyncStorage.multiRemove([PREFERENCES_KEY, CACHE_KEY]);
}

async function writePreferences(preferences: DiscoveryPreferences): Promise<void> {
  await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(normalizePreferences(preferences)));
}

async function readCache(): Promise<Record<string, DiscoveryCacheEntry>> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, DiscoveryCacheEntry>;
    return Object.fromEntries(Object.entries(parsed).filter(([, entry]) =>
      Array.isArray(entry?.products) && typeof entry.fetchedAt === 'string'
    ));
  } catch {
    return {};
  }
}

function normalizePreferences(value: Partial<DiscoveryPreferences>): DiscoveryPreferences {
  return {
    completed: value.completed === true,
    categories: [...new Set(value.categories ?? [])],
    favoriteBrands: [...new Set((value.favoriteBrands ?? []).map((brand) => brand.trim()).filter(Boolean))],
    budgetsByCategory: value.budgetsByCategory ?? {},
    dismissedProductIds: capIds(value.dismissedProductIds ?? []),
    seenProductIds: capIds(value.seenProductIds ?? [])
  };
}

function capIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))].slice(-MAX_FEEDBACK_IDS);
}
