jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { createTrackedProduct, deleteAllLocalData, getTrackedProduct, initializeDatabase, updateTrackedProducts, updateTrackingSettings } from '../database';

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
        attributes: [{ name: 'Size', value: 'EU 43' }],
        url: 'https://www.levelshoes.com/example-size-43.html'
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
          attributes: [{ name: 'Size', value: 'EU 43' }],
          url: 'https://www.levelshoes.com/example-size-43.html'
        }
      }
    });

    expect((await getTrackedProduct(id))?.variant).toEqual({
      id: 'SHOE-43',
      label: 'Size: EU 43',
      attributes: [{ name: 'Size', value: 'EU 43' }],
      url: 'https://www.levelshoes.com/example-size-43.html'
    });
  });

  it('persists local organization and alert preferences', async () => {
    const id = await createTrackedProduct({
      sourceUrl: 'https://www.noon.com/example',
      checkPreference: 'daily',
      alertMode: 'price_drop',
      minimumPriceDropMinor: 2500,
      restockAlertEnabled: false,
      folder: ' Running ',
      parsed: {
        siteKey: 'noon',
        canonicalUrl: 'https://www.noon.com/example',
        title: 'Example product',
        priceMinor: 10000,
        currency: 'AED',
        availability: 'in_stock'
      }
    });

    await updateTrackingSettings(id, {
      alertMode: 'price_drop',
      checkPreference: 'weekly',
      minimumPriceDropMinor: 5000,
      restockAlertEnabled: true,
      folder: 'Gifts',
      isActive: true
    });

    expect(await getTrackedProduct(id)).toEqual(expect.objectContaining({
      minimumPriceDropMinor: 5000,
      restockAlertEnabled: true,
      folder: 'Gifts',
      checkPreference: 'weekly'
    }));
  });

  it('reuses existing folder casing when saving another product', async () => {
    await createTrackedProduct({
      sourceUrl: 'https://www.noon.com/first',
      checkPreference: 'daily',
      alertMode: 'price_drop',
      folder: 'Running',
      parsed: { siteKey: 'noon', canonicalUrl: 'https://www.noon.com/first', title: 'First product', priceMinor: 10000, currency: 'AED', availability: 'in_stock' }
    });

    const id = await createTrackedProduct({
      sourceUrl: 'https://www.noon.com/second',
      checkPreference: 'daily',
      alertMode: 'price_drop',
      folder: ' running ',
      parsed: { siteKey: 'noon', canonicalUrl: 'https://www.noon.com/second', title: 'Second product', priceMinor: 10000, currency: 'AED', availability: 'in_stock' }
    });

    expect(await getTrackedProduct(id)).toEqual(expect.objectContaining({ folder: 'Running' }));
  });

  it('updates folders, activity, and archive state for selected products only', async () => {
    const first = await createTrackedProduct({
      sourceUrl: 'https://www.noon.com/first', checkPreference: 'daily', alertMode: 'price_drop', folder: 'Running',
      parsed: { siteKey: 'noon', canonicalUrl: 'https://www.noon.com/first', title: 'First', priceMinor: 10000, currency: 'AED', availability: 'in_stock' }
    });
    const second = await createTrackedProduct({
      sourceUrl: 'https://www.noon.com/second', checkPreference: 'daily', alertMode: 'price_drop',
      parsed: { siteKey: 'noon', canonicalUrl: 'https://www.noon.com/second', title: 'Second', priceMinor: 10000, currency: 'AED', availability: 'in_stock' }
    });

    await updateTrackedProducts([first, second], { folder: ' running ', isActive: false, isArchived: true });

    expect(await getTrackedProduct(first)).toEqual(expect.objectContaining({ folder: 'Running', isActive: false, isArchived: true }));
    expect(await getTrackedProduct(second)).toEqual(expect.objectContaining({ folder: 'Running', isActive: false, isArchived: true }));
  });
});
