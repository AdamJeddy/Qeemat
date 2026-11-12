import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProductSearchResult } from '../domain/discoverySearchCatalog';

const CACHE_KEY = 'qeemat.discovery.search.v1';
export const SEARCH_SOURCE_KEY = 'qeemat.discovery.search.sources.v1';
let writes: Promise<unknown> = Promise.resolve();
type SearchCache = Record<string, ProductSearchResult>;
export type SavedSearchSource = { query: string; sourceId: string };

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

async function readSavedSourceRegistry(): Promise<SavedSearchSource[]> {
  let stored: SavedSearchSource[] = [];
  try {
    const value = JSON.parse(await AsyncStorage.getItem(SEARCH_SOURCE_KEY) ?? '[]');
    if (Array.isArray(value)) { stored = value.filter((item) => typeof item?.query === 'string' && typeof item?.sourceId === 'string'); }
  } catch { /* Fall back to current cached searches. */ }
  return stored;
}

export async function listSavedSearchSources(): Promise<SavedSearchSource[]> {
  const stored = await readSavedSourceRegistry();
  const cached = Object.values(await read()).flatMap((entry) => typeof entry?.query === 'string' && Array.isArray(entry.sources)
    ? entry.sources.filter((source) => source?.request?.id && source.products?.length).map((source) => ({ query: entry.query, sourceId: source.request.id })) : []);
  return [...new Map([...stored, ...cached].map((item) => [JSON.stringify([item.query.toLowerCase(), item.sourceId]), item])).values()];
}

export function rememberSearchSource(query: string, sourceId: string): Promise<unknown> {
  const write = writes.then(async () => {
    const sources = await readSavedSourceRegistry();
    if (!sources.some((item) => item.query.toLowerCase() === query.toLowerCase() && item.sourceId === sourceId)) {
      sources.push({ query, sourceId });
      await AsyncStorage.setItem(SEARCH_SOURCE_KEY, JSON.stringify(sources));
    }
  });
  writes = write.catch(() => undefined);
  return write;
}

export function updateProductSearchCache(query: string, update: (current: ProductSearchResult) => ProductSearchResult): Promise<unknown> {
  const write = writes.then(async () => {
    const cache = await read();
    const current = cache[query.toLowerCase()];
    if (current && Array.isArray(current.sources) && Array.isArray(current.products)) {
      cache[query.toLowerCase()] = update(current);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    }
  });
  writes = write.catch(() => undefined);
  return write;
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
