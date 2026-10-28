jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { fetchDecathlonCollection, loadDiscoveryCatalog as loadScopedCatalog } from '../discoveryCatalog';
import { DISCOVERY_COLLECTIONS } from '../discovery';
import { getDiscoveryAttempt, getDiscoveryCache, saveDiscoveryCache } from '../../data/discovery';
import { SUPPORTED_SITES } from '../sites';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DISCOVERY_SOURCE_MAPS } from '../discoverySources';

// Queue/cache regressions need several source memberships; production defaults
// remain a bounded batch, verified independently below.
const loadDiscoveryCatalog = (fetcher?: Parameters<typeof loadScopedCatalog>[0], options?: Parameters<typeof loadScopedCatalog>[1]) =>
  loadScopedCatalog(fetcher, { scope: { limit: 500 }, ...options });

jest.mock('../webViewFetcher', () => ({ fetchPageHtmlViaWebView: jest.fn().mockResolvedValue(null) }));

describe('fetchDecathlonCollection', () => {
  it('requests the public Shopify collection feed and normalizes its products', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [{
          id: 101,
          title: 'Domyos training mat',
          handle: 'domyos-training-mat',
          vendor: 'Domyos',
          images: [{ src: 'https://images.example/mat.jpg' }],
          variants: [{ price: '89.00', available: true }]
        }]
      })
    });

    const products = await fetchDecathlonCollection(
      DISCOVERY_COLLECTIONS.find((collection) => collection.id === 'decathlon-fitness')!,
      fetcher,
      '2026-10-25T10:00:00.000Z'
    );

    expect(fetcher).toHaveBeenCalledWith(
      'https://decathlon.ae/collections/fitness/products.json?limit=100',
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json' }) })
    );
    expect(products).toEqual([expect.objectContaining({
      id: 'decathlon_uae:101',
      category: 'fitness',
      priceMinor: 8900
    })]);
  });

  it('returns an error when a retailer listing is unavailable', async () => {
    await expect(fetchDecathlonCollection(
      DISCOVERY_COLLECTIONS.find((collection) => collection.id === 'decathlon-fitness')!,
      jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
      '2026-10-25T10:00:00.000Z'
    )).rejects.toThrow('Could not refresh Fitness');
  });
});

describe('multi-retailer discovery refresh', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it.each([true, false])('does not cache a cancelled request as a failure or success (response succeeds: %s)', async (success) => {
    let cancel = false;
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const ready = new Promise<void>((resolve) => { started = resolve; });
    const fetcher = jest.fn(async () => {
      started(); await gate;
      return { ok: success, json: async () => ({ products: [{ id: 42, title: 'Mat', handle: 'mat', variants: [{ price: '10' }] }] }) };
    });
    const scope = { collectionId: 'decathlon-fitness' };
    const pending = loadScopedCatalog(fetcher, { scope, isCancelled: () => cancel });
    await ready; cancel = true; release(); await pending;
    expect(await getDiscoveryAttempt(scope.collectionId)).toBeUndefined();
    expect(await getDiscoveryCache(scope.collectionId)).toBeUndefined();
    const retry = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [{ id: 42, title: 'Mat', handle: 'mat', variants: [{ price: '10' }] }] }) });
    expect((await loadScopedCatalog(retry, { scope })).products).toHaveLength(1);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed attempt when cancellation skips a browser fallback', async () => {
    const source = DISCOVERY_SOURCE_MAPS.find((item) => item.siteKey === 'nike_uae' && item.provider === 'html')!;
    let cancel = false;
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const ready = new Promise<void>((resolve) => { started = resolve; });
    const nativeFetch = jest.requireMock('../webViewFetcher').fetchPageHtmlViaWebView as jest.Mock;
    nativeFetch.mockClear();
    const fetcher = jest.fn(async () => { started(); await gate; return { ok: false, json: async () => ({}) }; });
    const pending = loadScopedCatalog(fetcher, { scope: { collectionId: source.id }, isCancelled: () => cancel });
    await ready; cancel = true; release(); await pending;
    expect(nativeFetch).not.toHaveBeenCalled();
    expect(await getDiscoveryAttempt(source.id)).toBeUndefined();
  });

  it('reuses listings for 24 hours, but supports an explicit refresh', async () => {
    const now = jest.spyOn(Date, 'now');
    const start = Date.parse('2026-10-28T00:00:00Z');
    now.mockReturnValue(start);
    const scope = { collectionId: 'decathlon-fitness' };
    const product = { id: 'mat', siteKey: 'decathlon_uae' as const, category: 'fitness' as const, brand: 'Domyos', title: 'Mat', url: 'https://decathlon.ae/products/mat', priceMinor: 5000, currency: 'AED', availability: 'in_stock' as const, observedAt: new Date(start).toISOString() };
    await saveDiscoveryCache(scope.collectionId, [product], product.observedAt);
    const fetcher = jest.fn().mockResolvedValue({ ok: false });
    try {
      now.mockReturnValue(start + 23 * 60 * 60 * 1000);
      const cached = await loadScopedCatalog(fetcher, { scope });
      expect(fetcher).not.toHaveBeenCalled();
      expect(cached.stale).toBe(false);
      expect(cached.refreshing).toBe(false);
      now.mockReturnValue(start + 24 * 60 * 60 * 1000);
      await loadScopedCatalog(fetcher, { scope });
      expect(fetcher).toHaveBeenCalledTimes(1);
      await loadScopedCatalog(fetcher, { scope, force: true });
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally { now.mockRestore(); }
  });

  it('does not retry failed stores on every visit, but retries after a day or manually', async () => {
    const now = jest.spyOn(Date, 'now');
    const start = Date.parse('2026-10-28T00:00:00Z');
    now.mockReturnValue(start);
    const fetcher = jest.fn().mockResolvedValue({ ok: false });
    const scope = { collectionId: 'decathlon-fitness' };
    try {
      await loadScopedCatalog(fetcher, { scope });
      await loadScopedCatalog(fetcher, { scope });
      expect(fetcher).toHaveBeenCalledTimes(1);
      const cached = await loadScopedCatalog(fetcher, { scope });
      expect(cached.failedCollectionIds).toEqual(['decathlon-fitness']);
      now.mockReturnValue(start + 24 * 60 * 60 * 1000);
      await loadScopedCatalog(fetcher, { scope });
      expect(fetcher).toHaveBeenCalledTimes(2);
      await loadScopedCatalog(fetcher, { scope, force: true });
      expect(fetcher).toHaveBeenCalledTimes(3);
    } finally { now.mockRestore(); }
  });

  it('bounds an ordinary feed load without requiring callers to supply a scope', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: false });
    const result = await loadScopedCatalog(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(24);
    expect(result.sources).toHaveLength(24);
  });

  it('fetches just the selected mapped page and preserves its browsing membership', async () => {
    const source = DISCOVERY_SOURCE_MAPS.find((item) => item.id === 'decathlon-fitness')!;
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [{ id: 987, title: 'Training mat', handle: 'training-mat', variants: [{ price: '50', available: true }] }] }) });
    const result = await loadDiscoveryCatalog(fetcher, { scope: { collectionId: source.id } });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.products).toEqual([expect.objectContaining({ category: 'fitness', categories: ['fitness'], collectionIds: [source.id], priceMinor: 5000 })]);
    expect(result.sources).toHaveLength(1);
  });

  it('declares listing sources for every tracked retailer', () => {
    expect([...new Set(DISCOVERY_COLLECTIONS.map((source) => source.siteKey))].sort()).toEqual(SUPPORTED_SITES.map((site) => site.key).sort());
  });

  it('serializes overlapping loads so an older response cannot replace a newer refresh', async () => {
    let releaseOlder!: () => void;
    let markOlderStarted!: () => void;
    const olderGate = new Promise<void>((resolve) => { releaseOlder = resolve; });
    const olderStarted = new Promise<void>((resolve) => { markOlderStarted = resolve; });
    const response = (price: string) => ({
      ok: true,
      json: async () => ({ products: [{ id: 101, title: 'Mat', handle: 'mat', vendor: 'Domyos', variants: [{ price, available: true }] }] })
    });
    const olderFetcher = jest.fn(async (url: string) => {
      if (!url.includes('/collections/fitness/')) { return { ok: false, json: async () => ({}) }; }
      markOlderStarted();
      await olderGate;
      return response('89.00');
    });
    const newerFetcher = jest.fn(async (url: string) => url.includes('/collections/fitness/')
      ? response('79.00') : { ok: false, json: async () => ({}) });
    const updates: { load: string; price?: number }[] = [];
    const older = loadDiscoveryCatalog(olderFetcher, { onUpdate: (catalog) => {
      updates.push({ load: 'older', price: catalog.products[0]?.priceMinor });
    } });
    await olderStarted;
    const newer = loadDiscoveryCatalog(newerFetcher, { force: true, onUpdate: (catalog) => {
      updates.push({ load: 'newer', price: catalog.products[0]?.priceMinor });
    } });
    // Let all unblocked work settle while the older retailer response is held.
    await new Promise<void>((resolve) => setImmediate(resolve));
    const newerStartedEarly = newerFetcher.mock.calls.length > 0;
    releaseOlder();
    await Promise.all([older, newer]);

    expect((await getDiscoveryCache('decathlon-fitness'))?.products[0].priceMinor).toBe(7900);
    expect(newerStartedEarly).toBe(false);
    expect(updates[updates.length - 1]).toEqual({ load: 'newer', price: 7900 });
    expect(updates.slice(updates.findIndex((update) => update.load === 'newer')))
      .not.toContainEqual(expect.objectContaining({ load: 'older' }));
  });

  it('allows a queued load to proceed after the previous load rejects', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    const failed = loadDiscoveryCatalog(fetcher, { onUpdate: () => { throw new Error('Subscriber failed'); } });
    const next = loadDiscoveryCatalog(fetcher);

    await expect(failed).rejects.toThrow('Subscriber failed');
    await expect(next).resolves.toEqual(expect.objectContaining({ products: [] }));
  });

  it.each([
    ['2026-10-25T10:00:00Z', '2026-10-25T11:00:00Z', 7900],
    ['2026-10-25T12:00:00Z', '2026-10-25T11:00:00Z', 8900],
    ['2026-10-25T11:00:00Z', '2026-10-25T11:00:00Z', 8900]
  ])('merges cached duplicates by observation time (%s, %s)', async (firstObservedAt, secondObservedAt, expectedPrice) => {
    const product = { id: 'decathlon_uae:101', siteKey: 'decathlon_uae' as const, category: 'sport' as const, title: 'Mat', brand: 'Domyos', url: 'https://decathlon.ae/products/mat', priceMinor: 8900, currency: 'AED', availability: 'in_stock' as const, observedAt: firstObservedAt };
    await saveDiscoveryCache('decathlon-hiking-shoes-1', [product], firstObservedAt);
    await saveDiscoveryCache('decathlon-fitness', [{ ...product, priceMinor: 7900, observedAt: secondObservedAt }], secondObservedAt);

    const result = await loadDiscoveryCatalog(jest.fn().mockResolvedValue({ ok: false }), { force: true });

    expect(result.products).toEqual([expect.objectContaining({ id: product.id, priceMinor: expectedPrice })]);
  });

  it('keeps a refreshed in-stock observation when an earlier collection fails', async () => {
    const observedAt = '2026-10-25T10:00:00Z';
    const product = { id: 'decathlon_uae:101', siteKey: 'decathlon_uae' as const, category: 'sport' as const, title: 'Mat', brand: 'Domyos', url: 'https://decathlon.ae/products/mat', priceMinor: 8900, currency: 'AED', availability: 'out_of_stock' as const, observedAt };
    await saveDiscoveryCache('decathlon-hiking-shoes-1', [product], observedAt);
    const fetcher = jest.fn(async (url: string) => ({
      ok: url.includes('/collections/fitness/'),
      json: async () => ({ products: [{ id: 101, title: 'Mat', handle: 'mat', vendor: 'Domyos', variants: [{ price: '79.00', available: true }] }] })
    }));
    const observations: string[] = [];

    const result = await loadDiscoveryCatalog(fetcher, { force: true, onUpdate: (catalog) => {
      observations.push(catalog.products[0].availability);
    } });

    expect(result.failedCollectionIds).toContain('decathlon-hiking-shoes-1');
    expect(result.failedCollectionIds).not.toContain('decathlon-fitness');
    expect(result.products).toEqual([expect.objectContaining({ id: product.id, priceMinor: 7900, availability: 'in_stock' })]);
    expect(Date.parse(result.products[0].observedAt)).toBeGreaterThan(Date.parse(observedAt));
    expect(observations[0]).toBe('out_of_stock');
    expect(observations.slice(observations.indexOf('in_stock'))).not.toContain('out_of_stock');
  });

  it('preserves successful retailer caches during concurrent writes and partial failure', async () => {
    const product = { id: 'decathlon:1', siteKey: 'decathlon_uae' as const, category: 'sport' as const, title: 'Mat', brand: 'Domyos', url: 'https://decathlon.ae/products/mat', priceMinor: 8900, currency: 'AED', availability: 'in_stock' as const, observedAt: '2026-10-25T10:00:00Z' };
    await Promise.all([
      saveDiscoveryCache('decathlon-fitness', [product], product.observedAt),
      saveDiscoveryCache('salomon-salomon-accessories', [{ ...product, id: 'salomon:1', siteKey: 'salomon_gcc' as const }], product.observedAt)
    ]);
    expect((await getDiscoveryCache('decathlon-fitness'))?.products).toHaveLength(1);
    expect((await getDiscoveryCache('salomon-salomon-accessories'))?.products).toHaveLength(1);
    const fetcher = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    const updates: number[] = [];
    const result = await loadDiscoveryCatalog(fetcher, { force: true, onUpdate: (catalog) => updates.push(catalog.products.length) });
    expect(updates[0]).toBe(2);
    expect(result.products).toHaveLength(2);
    expect(result.stale).toBe(true);
    expect(result.failedCollectionIds).toContain('salomon-salomon-accessories');
    expect((await getDiscoveryCache('decathlon-fitness'))?.products[0].id).toBe(product.id);
  });
});
