import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DiscoveryPreferences,
  DiscoveryProduct
} from '../domain/types';
import { DEFAULT_DISCOVERY_PREFERENCES, discoveryFeedbackId } from '../domain/discovery';
import { migrateDiscoveryBudgets, normalizeDiscoveryCategories } from '../domain/discoveryCategories';

const PREFERENCES_KEY = 'qeemat.discovery.preferences.v1';
const CACHE_KEY = 'qeemat.discovery.cache.v1';
const SOURCE_CACHE_PREFIX = 'qeemat.discovery.source.v2.';
const SOURCE_ATTEMPT_PREFIX = 'qeemat.discovery.attempt.v1.';
const MAX_FEEDBACK_IDS = 300;
let legacyFeedbackAliases: Promise<Map<string, string>> | undefined;

export type DiscoveryCacheEntry = {
  products: DiscoveryProduct[];
  fetchedAt: string;
  parserVersion?: number;
};

export const DISCOVERY_PARSER_VERSION = 5;

type DiscoveryAttempt = { attemptedAt: number; failed: boolean; parserVersion: number };

export async function getDiscoveryAttempt(collectionId: string): Promise<DiscoveryAttempt | undefined> {
  try {
    const raw = await AsyncStorage.getItem(`${SOURCE_ATTEMPT_PREFIX}${collectionId}`);
    if (!raw) { return undefined; }
    const value = JSON.parse(raw) as DiscoveryAttempt;
    return Number.isFinite(value.attemptedAt) && typeof value.failed === 'boolean' && value.parserVersion === DISCOVERY_PARSER_VERSION ? value : undefined;
  } catch { return undefined; }
}

export async function saveDiscoveryAttempt(collectionId: string, failed: boolean): Promise<void> {
  await AsyncStorage.setItem(`${SOURCE_ATTEMPT_PREFIX}${collectionId}`, JSON.stringify({ attemptedAt: Date.now(), failed, parserVersion: DISCOVERY_PARSER_VERSION }));
}

export async function getDiscoveryPreferences(): Promise<DiscoveryPreferences> {
  const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
  if (!raw) {
    return { ...DEFAULT_DISCOVERY_PREFERENCES };
  }

  try {
    const preferences = normalizePreferences(JSON.parse(raw) as Partial<DiscoveryPreferences>);
    if (preferences.dismissedProductIds.some((id) => /^(decathlon_uae|salomon_gcc):\d+$/.test(id))) {
      const aliases = await getLegacyFeedbackAliases();
      preferences.dismissedProductIds = [...new Set(preferences.dismissedProductIds.map((id) => aliases.get(id) ?? id))];
    }
    return preferences;
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

export async function dismissDiscoveryProduct(productId: string, product?: DiscoveryProduct): Promise<void> {
  const current = await getDiscoveryPreferences();
  await writePreferences({
    ...current,
    dismissedProductIds: capIds([...current.dismissedProductIds, product ? discoveryFeedbackId(product) : productId])
  });
}

export async function getDiscoveryCache(collectionId: string): Promise<DiscoveryCacheEntry | undefined> {
  const raw = await AsyncStorage.getItem(`${SOURCE_CACHE_PREFIX}${collectionId}`);
  if (raw) {
    try {
      const entry = JSON.parse(raw) as DiscoveryCacheEntry;
      if (Array.isArray(entry.products) && typeof entry.fetchedAt === 'string') { return entry; }
    } catch { /* Read the legacy cache if this entry is corrupt. */ }
  }
  const cache = await readCache();
  return cache[collectionId];
}

export async function saveDiscoveryCache(collectionId: string, products: DiscoveryProduct[], fetchedAt: string): Promise<void> {
  await AsyncStorage.setItem(`${SOURCE_CACHE_PREFIX}${collectionId}`, JSON.stringify({ products, fetchedAt, parserVersion: DISCOVERY_PARSER_VERSION }));
  legacyFeedbackAliases = undefined;
}

export async function clearDiscoveryData(): Promise<void> {
  legacyFeedbackAliases = undefined;
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove([PREFERENCES_KEY, CACHE_KEY, 'qeemat.discovery.search.v1', ...keys.filter((key) => key.startsWith(SOURCE_CACHE_PREFIX) || key.startsWith(SOURCE_ATTEMPT_PREFIX))]);
}

async function getLegacyFeedbackAliases(): Promise<Map<string, string>> {
  if (!legacyFeedbackAliases) {
    legacyFeedbackAliases = (async () => {
      const result = new Map<string, string>();
      const add = (entry: DiscoveryCacheEntry) => {
        for (const product of entry.products ?? []) {
          if (product && typeof product.id === 'string' && typeof product.url === 'string' && /^(decathlon_uae|salomon_gcc):\d+$/.test(product.id)) {
            const alias = discoveryFeedbackId(product);
            if (alias !== product.id) { result.set(product.id, alias); }
          }
        }
      };
      const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(`${SOURCE_CACHE_PREFIX}decathlon-`) || key.startsWith(`${SOURCE_CACHE_PREFIX}salomon-`));
      const entries = await AsyncStorage.multiGet(keys);
      for (const [, raw] of entries) {
        if (!raw) { continue; }
        try { const entry = JSON.parse(raw) as DiscoveryCacheEntry; if (Array.isArray(entry.products)) { add(entry); } } catch { /* Ignore a corrupt collection cache. */ }
      }
      for (const entry of Object.values(await readCache())) { add(entry); }
      return result;
    })().catch(() => { legacyFeedbackAliases = undefined; return new Map<string, string>(); });
  }
  return legacyFeedbackAliases;
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
    categories: normalizeDiscoveryCategories(value.categories),
    favoriteBrands: [...new Set((value.favoriteBrands ?? []).map((brand) => brand.trim()).filter(Boolean))],
    budgetsByCategory: migrateDiscoveryBudgets(value.budgetsByCategory),
    dismissedProductIds: capIds(value.dismissedProductIds ?? []),
    seenProductIds: capIds(value.seenProductIds ?? [])
  };
}

function capIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))].slice(-MAX_FEEDBACK_IDS);
}
