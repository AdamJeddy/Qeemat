jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearDiscoveryData,
  dismissDiscoveryProduct,
  getDiscoveryCache,
  getDiscoveryPreferences,
  markDiscoveryProductsSeen,
  saveDiscoveryCache,
  saveDiscoveryPreferences
} from '../discovery';
import { DiscoveryProduct } from '../../domain/types';

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
      parserVersion: 3
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

    await clearDiscoveryData();

    await expect(getDiscoveryPreferences()).resolves.toMatchObject({ completed: false, categories: [] });
    await expect(getDiscoveryCache('decathlon-fitness')).resolves.toBeUndefined();
  });
});
