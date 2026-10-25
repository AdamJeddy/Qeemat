jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { fetchDecathlonCollection } from '../discoveryCatalog';
import { DISCOVERY_COLLECTIONS } from '../discovery';

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
      'https://decathlon.ae/collections/fitness/products.json?limit=24',
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
