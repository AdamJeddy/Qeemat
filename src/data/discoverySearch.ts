import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProductSearchResult } from '../domain/discoverySearchCatalog';

const CACHE_KEY = 'qeemat.discovery.search.v1';
let writes: Promise<unknown> = Promise.resolve();
type SearchCache = Record<string, ProductSearchResult>;

async function read(): Promise<SearchCache> {
  try {
    const value = JSON.parse(await AsyncStorage.getItem(CACHE_KEY) ?? '{}');
    return value && !Array.isArray(value) && typeof value === 'object' ? value : {};
  } catch { return {}; }
}

export async function getProductSearchCache(query: string): Promise<ProductSearchResult | undefined> {
  const entry = (await read())[query.toLowerCase()];
  return entry?.query && Array.isArray(entry.sources) && Array.isArray(entry.products) ? entry : undefined;
}

export function saveProductSearchCache(result: ProductSearchResult): Promise<unknown> {
  const write = writes.then(async () => {
    const cache = await read();
    delete cache[result.query.toLowerCase()];
    const entries = Object.entries(cache).slice(-7);
    entries.push([result.query.toLowerCase(), result]);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  });
  writes = write.catch(() => undefined);
  return write;
}
