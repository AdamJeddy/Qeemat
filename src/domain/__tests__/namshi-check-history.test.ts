jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import {
  createTrackedProduct,
  deleteAllLocalData,
  getProductWithSnapshots,
  getTrackedProduct,
  initializeDatabase
} from '../../data/database';
import { checkProductNow } from '../checker';
import { VariantSelection } from '../types';

describe('Namshi background check history', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-19T12:00:00.000Z'));
    await initializeDatabase();
    await deleteAllLocalData();
  });

  afterEach(async () => {
    await deleteAllLocalData();
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('records the missing saved M size as sold out while retaining its AED 38 price and earlier history', async () => {
    const productUrl = 'https://www.namshi.com/uae-en/buy-puma-short-puma-sport-graphic-9/V11AE4F2FC01E6AB59754V/p/';
    const variant: VariantSelection = {
      id: 'namshi:size:m',
      label: 'Size: M',
      attributes: [{ name: 'Size', value: 'M' }],
      url: productUrl
    };
    const productId = await createTrackedProduct({
      sourceUrl: productUrl,
      checkPreference: 'daily',
      alertMode: 'price_drop',
      variant,
      parsed: {
        siteKey: 'namshi',
        canonicalUrl: productUrl,
        title: 'Puma Short Puma Sport Graphic 9',
        priceMinor: 3800,
        currency: 'AED',
        availability: 'in_stock',
        selectedVariant: variant
      }
    });
    const original = await getProductWithSnapshots(productId);
    const tracked = await getTrackedProduct(productId);
    if (!tracked || !original) {
      throw new Error('The starting tracked size was not persisted.');
    }

    // Reduced from the issue #52 product response fetched on 2026-10-20:
    // explicit product OOS, a generic AED 249 offer, and no size controls.
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      url: productUrl,
      text: async () => `
        <html><head>
          <link rel="canonical" href="${productUrl}" />
          <script type="application/ld+json">${JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: 'Puma  Short Puma Sport Graphic 9 for Men | Best Price UAE',
            sku: 'V11AE4F2FC01E6AB59754V-11',
            offers: {
              '@type': 'Offer',
              url: productUrl,
              availability: 'https://schema.org/OutOfStock',
              price: '249',
              priceCurrency: 'AED'
            }
          })}</script>
        </head><body></body></html>
      `
    })) as unknown as typeof fetch;
    jest.setSystemTime(new Date('2026-10-20T12:00:00.000Z'));

    await checkProductNow(tracked, 'background');

    const updated = await getProductWithSnapshots(productId);
    expect(updated?.product).toEqual(expect.objectContaining({
      lastAvailability: 'out_of_stock',
      lastErrorCode: 'ok',
      currentPriceMinor: 3800,
      variant
    }));
    expect(updated?.snapshots).toHaveLength(2);
    expect(updated?.snapshots[0]).toEqual(expect.objectContaining({
      availability: 'out_of_stock',
      status: 'ok',
      source: 'background',
      checkedAt: '2026-10-20T12:00:00.000Z'
    }));
    expect(updated?.snapshots[0].priceMinor).toBeUndefined();
    expect(updated?.snapshots[0].errorCode).toBeUndefined();
    expect(updated?.snapshots[1]).toEqual(original.snapshots[0]);
    expect(updated?.snapshots[1].priceMinor).toBe(3800);
  });
});
