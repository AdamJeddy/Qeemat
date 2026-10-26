jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { fetchDecathlonCollection, loadDiscoveryCatalog } from '../discoveryCatalog';
import { DISCOVERY_COLLECTIONS } from '../discovery';
import { getDiscoveryCache, saveDiscoveryCache } from '../../data/discovery';
import { SUPPORTED_SITES } from '../sites';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      category: 'sport',
      priceMinor: 8900
    })]);
  });

  it('returns an error when a retailer listing is unavailable', async () => {
    await expect(fetchDecathlonCollection(
      DISCOVERY_COLLECTIONS[0],
      jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
      '2026-10-25T10:00:00.000Z'
    )).rejects.toThrow('Could not refresh Footwear');
  });
});

describe('multi-retailer discovery refresh', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('declares listing sources for every tracked retailer', () => {
    expect([...new Set(DISCOVERY_COLLECTIONS.map((source) => source.siteKey))].sort()).toEqual(SUPPORTED_SITES.map((site) => site.key).sort());
  });

  it.each([
    ['2026-10-25T10:00:00Z', '2026-10-25T11:00:00Z', 7900],
    ['2026-10-25T12:00:00Z', '2026-10-25T11:00:00Z', 8900],
    ['2026-10-25T11:00:00Z', '2026-10-25T11:00:00Z', 8900]
  ])('merges cached duplicates by observation time (%s, %s)', async (firstObservedAt, secondObservedAt, expectedPrice) => {
    const product = { id: 'decathlon_uae:101', siteKey: 'decathlon_uae' as const, category: 'sport' as const, title: 'Mat', brand: 'Domyos', url: 'https://decathlon.ae/products/mat', priceMinor: 8900, currency: 'AED', availability: 'in_stock' as const, observedAt: firstObservedAt };
    await saveDiscoveryCache('decathlon-footwear', [product], firstObservedAt);
    await saveDiscoveryCache('decathlon-fitness', [{ ...product, priceMinor: 7900, observedAt: secondObservedAt }], secondObservedAt);

    const result = await loadDiscoveryCatalog(jest.fn().mockResolvedValue({ ok: false }), { force: true });

    expect(result.products).toEqual([expect.objectContaining({ id: product.id, priceMinor: expectedPrice })]);
  });

  it('keeps a refreshed in-stock observation when an earlier collection fails', async () => {
    const observedAt = '2026-10-25T10:00:00Z';
    const product = { id: 'decathlon_uae:101', siteKey: 'decathlon_uae' as const, category: 'sport' as const, title: 'Mat', brand: 'Domyos', url: 'https://decathlon.ae/products/mat', priceMinor: 8900, currency: 'AED', availability: 'out_of_stock' as const, observedAt };
    await saveDiscoveryCache('decathlon-footwear', [product], observedAt);
    const fetcher = jest.fn(async (url: string) => ({
      ok: url.includes('/collections/fitness/'),
      json: async () => ({ products: [{ id: 101, title: 'Mat', handle: 'mat', vendor: 'Domyos', variants: [{ price: '79.00', available: true }] }] })
    }));
    const observations: string[] = [];

    const result = await loadDiscoveryCatalog(fetcher, { force: true, onUpdate: (catalog) => {
      observations.push(catalog.products[0].availability);
    } });

    expect(result.failedCollectionIds).toContain('decathlon-footwear');
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
      saveDiscoveryCache('salomon-outdoors', [{ ...product, id: 'salomon:1', siteKey: 'salomon_gcc' as const }], product.observedAt)
    ]);
    expect((await getDiscoveryCache('decathlon-fitness'))?.products).toHaveLength(1);
    expect((await getDiscoveryCache('salomon-outdoors'))?.products).toHaveLength(1);
    const fetcher = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    const updates: number[] = [];
    const result = await loadDiscoveryCatalog(fetcher, { force: true, onUpdate: (catalog) => updates.push(catalog.products.length) });
    expect(updates[0]).toBe(2);
    expect(result.products).toHaveLength(2);
    expect(result.stale).toBe(true);
    expect(result.failedCollectionIds).toContain('salomon-outdoors');
    expect((await getDiscoveryCache('decathlon-fitness'))?.products[0].id).toBe(product.id);
  });
});
