import AsyncStorage from '@react-native-async-storage/async-storage';
import { listCachedDiscoveryCollectionIds } from '../data/discovery';
import { listSavedSearchSources, SavedSearchSource } from '../data/discoverySearch';
import { DiscoveryFetcher, loadDiscoveryCatalog } from './discoveryCatalog';
import { waitForDiscoveryTimeout } from './backgroundScheduler';
import { refreshSavedSearchSource } from './discoverySearchCatalog';
import { DISCOVERY_SOURCE_MAPS } from './discoverySources';

const CURSOR_KEY = 'qeemat.discovery.background.cursor.v1';
const BATCH_SIZE = 3;
type Dependencies = {
  collections: () => Promise<string[]>;
  searches: () => Promise<SavedSearchSource[]>;
  refreshCollection: (id: string) => Promise<unknown>;
  refreshSearch: (query: string, sourceId: string) => Promise<unknown>;
};
type Job = { key: string; run: () => Promise<unknown> };

/** Native deadlines continue while Android has paused ordinary JavaScript timers. */
export function createBackgroundFetcher(fetcher: DiscoveryFetcher, wait: (milliseconds: number) => Promise<void>): DiscoveryFetcher {
  return async (url, options) => {
    const controller = new AbortController();
    if (options?.signal?.aborted) { controller.abort(); }
    else { options?.signal?.addEventListener('abort', () => controller.abort(), { once: true }); }
    const deadline = wait(18000).then(() => { controller.abort(); throw new Error('Discovery request timed out'); });
    const response = await Promise.race([fetcher(url, { ...options, signal: controller.signal }), deadline]);
    return {
      ok: response.ok,
      ...('status' in response ? { status: response.status } : {}),
      json: () => Promise.race([response.json(), deadline]),
      ...(response.text ? { text: () => Promise.race([response.text!(), deadline]) } : {})
    };
  };
}

/** Rotate through saved sources in a small batch that fits the Android headless task. */
export async function runDiscoveryBackgroundRefresh(overrides: Partial<Dependencies> = {}): Promise<void> {
  const backgroundFetch = createBackgroundFetcher(fetch, waitForDiscoveryTimeout);
  const deps: Dependencies = {
    collections: listCachedDiscoveryCollectionIds,
    searches: listSavedSearchSources,
    refreshCollection: async (id) => {
      if (DISCOVERY_SOURCE_MAPS.some((source) => source.id === id)) { await loadDiscoveryCatalog(backgroundFetch, { scope: { collectionId: id } }); }
    },
    refreshSearch: (query, sourceId) => refreshSavedSearchSource(query, sourceId, backgroundFetch),
    ...overrides
  };
  console.info('[Discovery refresh] Loading saved sources');
  const [collectionIds, searchSources, cursor] = await Promise.all([deps.collections(), deps.searches(), AsyncStorage.getItem(CURSOR_KEY)]);
  const collectionJobs: Job[] = [...new Set(collectionIds)].sort().map((id) => ({ key: JSON.stringify(['collection', id]), run: () => deps.refreshCollection(id) }));
  const uniqueSearches = [...new Map(searchSources.map((source) => [JSON.stringify([source.query.toLowerCase(), source.sourceId]), source])).values()];
  const searchJobs: Job[] = uniqueSearches.sort((a, b) => `${a.query}\0${a.sourceId}`.localeCompare(`${b.query}\0${b.sourceId}`))
    .map(({ query, sourceId }) => ({ key: JSON.stringify(['search', query.toLowerCase(), sourceId]), run: () => deps.refreshSearch(query, sourceId) }));
  const jobs: Job[] = [];
  for (let i = 0; i < Math.max(collectionJobs.length, searchJobs.length); i++) {
    if (collectionJobs[i]) { jobs.push(collectionJobs[i]); }
    if (searchJobs[i]) { jobs.push(searchJobs[i]); }
  }
  if (!jobs.length) { console.info('[Discovery refresh] No saved sources'); return; }
  const start = (jobs.findIndex((job) => job.key === cursor) + 1) % jobs.length;
  for (let i = 0; i < Math.min(BATCH_SIZE, jobs.length); i++) {
    const job = jobs[(start + i) % jobs.length];
    console.info(`[Discovery refresh] Starting source ${i + 1}`);
    try { await job.run(); } catch { console.warn('[Discovery refresh] A source could not refresh'); }
    console.info(`[Discovery refresh] Finished source ${i + 1}`);
    await AsyncStorage.setItem(CURSOR_KEY, job.key);
    console.info(`[Discovery refresh] Saved progress ${i + 1}`);
  }
}
