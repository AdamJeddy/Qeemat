import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DiscoveryProduct } from '../domain/types';

export const DISCOVERY_HISTORY_PREFIX = 'qeemat.discovery.history.v1.';
export type DiscoveryObservation = Pick<DiscoveryProduct, 'priceMinor' | 'currency' | 'priceBasis' | 'hasPriceRange' | 'availability' | 'observedAt'>;
let writes: Promise<unknown> = Promise.resolve();

function key(product: DiscoveryProduct): string {
  return `${DISCOVERY_HISTORY_PREFIX}${encodeURIComponent(JSON.stringify([product.siteKey, product.id, product.url]))}`;
}

export async function getDiscoveryHistory(product: DiscoveryProduct): Promise<DiscoveryObservation[]> {
  try {
    const value = JSON.parse(await AsyncStorage.getItem(key(product)) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

/** Serialize writes so concurrent retailer searches cannot overwrite observations. */
export function recordDiscoveryObservations(products: DiscoveryProduct[]): Promise<DiscoveryProduct[]> {
  const task = writes.then(async () => {
    const keys = [...new Set(products.map(key))];
    const pending = AsyncStorage.multiGet(keys);
    // multiGet normally waits for a JS timer, which Android can pause in the background.
    AsyncStorage.flushGetRequests();
    const stored = await pending;
    const histories = new Map<string, DiscoveryObservation[]>();
    for (const [entryKey, raw] of stored) {
      try { const value = JSON.parse(raw ?? '[]'); histories.set(entryKey, Array.isArray(value) ? value : []); }
      catch { histories.set(entryKey, []); }
    }
    const changed = new Set<string>();
    const results: DiscoveryProduct[] = [];
    for (const product of products) {
      const entryKey = key(product);
      const history = histories.get(entryKey) ?? [];
      const current: DiscoveryObservation = { priceMinor: product.priceMinor, currency: product.currency, priceBasis: product.priceBasis,
        hasPriceRange: product.hasPriceRange, availability: product.availability, observedAt: product.observedAt };
      const previous = history.filter((entry) => entry.observedAt < current.observedAt && entry.priceMinor !== undefined &&
        entry.currency === current.currency && entry.priceBasis === current.priceBasis && Boolean(entry.hasPriceRange) === Boolean(current.hasPriceRange)).at(-1);
      if (!history.some((entry) => entry.observedAt === current.observedAt)) {
        const next = [...history, current].sort((a, b) => a.observedAt.localeCompare(b.observedAt)).slice(-30);
        histories.set(entryKey, next);
        changed.add(entryKey);
      }
      results.push({ ...product, previousPriceMinor: current.priceMinor === undefined ? undefined : previous?.priceMinor, previousObservedAt: previous?.observedAt });
    }
    if (changed.size) { await AsyncStorage.multiSet([...changed].map((entryKey) => [entryKey, JSON.stringify(histories.get(entryKey))])); }
    return results;
  });
  writes = task.catch(() => undefined);
  return task;
}

export function clearDiscoveryHistory(): Promise<void> {
  const task = writes.then(async () => {
    const keys = (await AsyncStorage.getAllKeys()).filter((entryKey) => entryKey.startsWith(DISCOVERY_HISTORY_PREFIX));
    if (keys.length) { await AsyncStorage.multiRemove(keys); }
  });
  writes = task.catch(() => undefined);
  return task;
}
