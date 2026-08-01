jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { createTrackedProduct, deleteAllLocalData, getTrackedProduct, initializeDatabase } from '../database';

describe('createTrackedProduct', () => {
  beforeEach(async () => {
    await initializeDatabase();
    await deleteAllLocalData();
  });

  afterEach(async () => {
    await deleteAllLocalData();
  });

  it('persists the selected variant with a new tracker', async () => {
    const id = await createTrackedProduct({
      sourceUrl: 'https://www.levelshoes.com/example.html',
      checkPreference: 'daily',
      alertMode: 'price_drop',
      variant: {
        id: 'SHOE-43',
        label: 'Size: EU 43',
        attributes: [{ name: 'Size', value: 'EU 43' }]
      },
      parsed: {
        siteKey: 'level_shoes',
        canonicalUrl: 'https://www.levelshoes.com/example.html',
        title: 'Example sneaker',
        priceMinor: 49000,
        currency: 'AED',
        availability: 'in_stock',
        selectedVariant: {
          id: 'SHOE-43',
          label: 'Size: EU 43',
          attributes: [{ name: 'Size', value: 'EU 43' }]
        }
      }
    });

    expect((await getTrackedProduct(id))?.variant).toEqual({
      id: 'SHOE-43',
      label: 'Size: EU 43',
      attributes: [{ name: 'Size', value: 'EU 43' }]
    });
  });
});
