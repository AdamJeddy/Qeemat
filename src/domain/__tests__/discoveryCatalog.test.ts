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
