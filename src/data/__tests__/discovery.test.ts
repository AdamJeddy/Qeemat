jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearDiscoveryData,
  dismissDiscoveryProduct,
  getDiscoveryCache,
  getDiscoveryAttempt,
  getDiscoveryPreferences,
  markDiscoveryProductsSeen,
  saveDiscoveryCache,
  saveDiscoveryAttempt,
  saveDiscoveryPreferences
} from '../discovery';
import { DiscoveryProduct } from '../../domain/types';
import { buildDiscoverySections } from '../../domain/discovery';

const product: DiscoveryProduct = {
  id: 'decathlon_uae:123',
  siteKey: 'decathlon_uae',
  category: 'sport',
  brand: 'Domyos',
  title: 'Exercise bike',
  url: 'https://decathlon.ae/products/exercise-bike',
  priceMinor: 170000,
  currency: 'AED',
  availability: 'in_stock',
  observedAt: '2026-10-25T10:00:00.000Z'
};

describe('discovery persistence', () => {
  beforeEach(async () => {
    await clearDiscoveryData();
    await AsyncStorage.clear();
  });

  it('starts with skippable empty preferences', async () => {
    await expect(getDiscoveryPreferences()).resolves.toMatchObject({
      completed: false,
      categories: [],
      favoriteBrands: [],
      budgetsByCategory: {}
    });
  });

  it.each(['decathlon_uae', 'salomon_gcc'] as const)('shares dismissal between listing and search for %s, in either direction', async (siteKey) => {
    const host = siteKey === 'decathlon_uae' ? 'decathlon.ae' : 'salomongcc.com';
    const listing = { ...product, id: `${siteKey}:123`, siteKey, url: `https://${host}/products/shoe` };
    const search = { ...listing, id: `${siteKey}:/products/shoe` };
    await dismissDiscoveryProduct(listing.id, listing);
    expect(buildDiscoverySections([search], await getDiscoveryPreferences()).picks).toHaveLength(0);
    await clearDiscoveryData();
    await dismissDiscoveryProduct(search.id, search);
    expect(buildDiscoverySections([listing], await getDiscoveryPreferences()).picks).toHaveLength(0);
  });

  it.each(['decathlon_uae', 'salomon_gcc'] as const)('reconciles previously dismissed %s catalogue IDs through cached products', async (siteKey) => {
    const host = siteKey === 'decathlon_uae' ? 'decathlon.ae' : 'salomongcc.com';
    const listing = { ...product, id: `${siteKey}:123`, siteKey, url: `https://${host}/products/shoe` };
    const search = { ...listing, id: `${siteKey}:/products/shoe` };
    await saveDiscoveryCache(`${siteKey === 'decathlon_uae' ? 'decathlon' : 'salomon'}-test`, [listing], listing.observedAt);
    await dismissDiscoveryProduct(listing.id);
    expect(buildDiscoverySections([search], await getDiscoveryPreferences()).picks).toHaveLength(0);
  });

  it('can resolve older feedback after its product is cached later', async () => {
    const listing = { ...product, id: 'decathlon_uae:123', url: 'https://decathlon.ae/products/shoe' };
    const search = { ...listing, id: 'decathlon_uae:/products/shoe' };
    await dismissDiscoveryProduct(listing.id);
    expect((await getDiscoveryPreferences()).dismissedProductIds).toContain(listing.id);
    await saveDiscoveryCache('decathlon-test', [listing], listing.observedAt);
    expect(buildDiscoverySections([search], await getDiscoveryPreferences()).picks).toHaveLength(0);
  });

  it('migrates broad interests and budgets while retaining feedback and seen history', async () => {
    await saveDiscoveryPreferences({
      completed: true,
      categories: ['sport'],
      favoriteBrands: ['Domyos'],
      budgetsByCategory: { sport: 200000 }
    });
    await markDiscoveryProductsSeen([product.id]);
    await dismissDiscoveryProduct(product.id);

    await expect(getDiscoveryPreferences()).resolves.toMatchObject({
      completed: true,
      categories: ['footwear', 'clothing', 'fitness', 'sports', 'outdoors', 'cycling', 'swimming', 'motorcycle', 'marine'],
      favoriteBrands: ['Domyos'],
      budgetsByCategory: { footwear: 200000, fitness: 200000, swimming: 200000 },
      seenProductIds: [product.id],
      dismissedProductIds: [product.id]
    });
  });

  it('stores the latest successful listing independently by collection', async () => {
    await saveDiscoveryCache('decathlon-fitness', [product], '2026-10-25T10:00:00.000Z');

    await expect(getDiscoveryCache('decathlon-fitness')).resolves.toEqual({
      products: [product],
      fetchedAt: '2026-10-25T10:00:00.000Z',
      parserVersion: 5
    });
    await expect(getDiscoveryCache('decathlon-outdoors')).resolves.toBeUndefined();
  });

  it('removes preferences and cached listings with other local data', async () => {
    await saveDiscoveryPreferences({
      completed: true,
      categories: ['sport'],
      favoriteBrands: [],
      budgetsByCategory: {}
    });
    await saveDiscoveryCache('decathlon-fitness', [product], '2026-10-25T10:00:00.000Z');

    await saveDiscoveryAttempt('decathlon-fitness', true);
    await clearDiscoveryData();

    await expect(getDiscoveryPreferences()).resolves.toMatchObject({ completed: false, categories: [] });
    await expect(getDiscoveryCache('decathlon-fitness')).resolves.toBeUndefined();
    await expect(getDiscoveryAttempt('decathlon-fitness')).resolves.toBeUndefined();
  });
});
