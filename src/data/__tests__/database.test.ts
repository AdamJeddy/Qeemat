jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { createTrackedProduct, deleteAllLocalData, deleteTrackedProducts, deriveLastPriceChange, getTrackedProduct, initializeDatabase, recordSuccessfulCheck, updateTrackedProducts, updateTrackingSettings } from '../database';
import { PriceSnapshot } from '../../domain/types';

describe('createTrackedProduct', () => {
  beforeEach(async () => {
    await initializeDatabase();
    await deleteAllLocalData();
  });

  afterEach(async () => {
    await deleteAllLocalData();
  });

  it('saves a product category and lets the user change or clear it', async () => {
    const id = await createTrackedProduct({ sourceUrl: 'https://www.noon.com/example', checkPreference: 'daily', alertMode: 'price_drop', category: 'footwear', brand: 'Example', parsed: {
      siteKey: 'noon', canonicalUrl: 'https://www.noon.com/example', title: 'Shoes', priceMinor: 10000, currency: 'AED', availability: 'in_stock'
    } });
    expect((await getTrackedProduct(id))?.category).toBe('footwear');
    expect((await getTrackedProduct(id))?.brand).toBe('Example');
    await updateTrackingSettings(id, { alertMode: 'price_drop', checkPreference: 'daily', isActive: true, category: 'clothing' });
    expect((await getTrackedProduct(id))?.category).toBe('clothing');
    await updateTrackingSettings(id, { alertMode: 'price_drop', checkPreference: 'daily', isActive: true, category: null });
    expect((await getTrackedProduct(id))?.category).toBeUndefined();
    expect((await getTrackedProduct(id))?.categoryExcluded).toBe(true);
  });

  it('keeps source metadata on creation and updates it without losing missing fields or a user category', async () => {
    const parsed = { siteKey: 'nike_uae' as const, canonicalUrl: 'https://www.nike.ae/en/example.html', title: 'Runner', priceMinor: 10000, currency: 'AED', availability: 'in_stock' as const,
      sourceMetadata: { categoryPath: ['Women', 'Shoes'], productType: 'Running shoes', brand: 'Nike', attributes: { material: 'Mesh' } } };
    const id = await createTrackedProduct({ sourceUrl: parsed.canonicalUrl, checkPreference: 'daily', alertMode: 'price_drop', category: 'clothing', parsed });
    const tracked = (await getTrackedProduct(id))!;
    expect(tracked.sourceMetadata).toEqual(parsed.sourceMetadata);
    expect(tracked.brand).toBe('Nike');
    await recordSuccessfulCheck(tracked, { ...parsed, sourceMetadata: { productType: 'Trail running shoes', attributes: { color: 'Blue' } } }, 'manual_single');
    const updated = (await getTrackedProduct(id))!;
    expect(updated.category).toBe('clothing');
    expect(updated.sourceMetadata).toEqual({ categoryPath: ['Women', 'Shoes'], productType: 'Trail running shoes', brand: 'Nike', attributes: { material: 'Mesh', color: 'Blue' } });
    await recordSuccessfulCheck(updated, { ...parsed, sourceMetadata: undefined }, 'manual_single');
    expect((await getTrackedProduct(id))?.sourceMetadata).toEqual(updated.sourceMetadata);
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

  it('deletes every selected product in one storage update', async () => {
    const ids = await Promise.all(['first', 'second', 'third'].map((name) => createTrackedProduct({
      sourceUrl: `https://www.noon.com/${name}`,
      checkPreference: 'daily',
      alertMode: 'price_drop',
      parsed: { siteKey: 'noon', canonicalUrl: `https://www.noon.com/${name}`, title: name, priceMinor: 10000, currency: 'AED', availability: 'in_stock' }
    })));

    await deleteTrackedProducts(ids);

    await expect(Promise.all(ids.map(getTrackedProduct))).resolves.toEqual([undefined, undefined, undefined]);
  });
});

describe('price change memory', () => {
  beforeEach(async () => {
    await initializeDatabase();
    await deleteAllLocalData();
  });

  afterEach(async () => {
    await deleteAllLocalData();
  });

  const parsed = (priceMinor: number) => ({
    siteKey: 'noon' as const,
    canonicalUrl: 'https://www.noon.com/price-memory',
    title: 'Price memory product',
    priceMinor,
    currency: 'AED',
    availability: 'in_stock' as const
  });

  it('keeps the last real price change after later unchanged checks', async () => {
    const id = await createTrackedProduct({
      sourceUrl: 'https://www.noon.com/price-memory',
      checkPreference: 'daily',
      alertMode: 'price_drop',
      parsed: parsed(10000)
    });
    const initial = (await getTrackedProduct(id))!;

    const firstCheck = await recordSuccessfulCheck(initial, parsed(9000), 'manual_single');
    expect(firstCheck.status).toBe('price_changed');
    let updated = (await getTrackedProduct(id))!;
    expect(updated.lastPriceChangeMinor).toBe(10000);
    expect(updated.lastPriceChangeAt).toBeDefined();

    await recordSuccessfulCheck(updated, parsed(9000), 'manual_single');
    updated = (await getTrackedProduct(id))!;
    expect(updated.lastPriceChangeMinor).toBe(10000);
    expect(updated.lastPriceChangeAt).toBeDefined();
    expect(updated.lastErrorCode).toBe('ok');

    await recordSuccessfulCheck(updated, parsed(9500), 'manual_single');
    updated = (await getTrackedProduct(id))!;
    expect(updated.lastPriceChangeMinor).toBe(9000);
  });

  it('derives the most recent change from stored snapshots', () => {
    const snapshots: PriceSnapshot[] = [
      { id: 1, trackedProductId: 1, priceMinor: 10000, currency: 'AED', availability: 'in_stock', status: 'ok', source: 'manual_single', checkedAt: '2026-10-31T00:00:00.000Z' },
      { id: 2, trackedProductId: 1, priceMinor: 9000, currency: 'AED', availability: 'in_stock', status: 'price_changed', source: 'manual_single', checkedAt: '2026-11-01T00:00:00.000Z' },
      { id: 3, trackedProductId: 1, priceMinor: 9000, currency: 'AED', availability: 'in_stock', status: 'ok', source: 'manual_single', checkedAt: '2026-11-02T00:00:00.000Z' },
      { id: 4, trackedProductId: 1, priceMinor: 9500, currency: 'AED', availability: 'in_stock', status: 'price_changed', source: 'manual_single', checkedAt: '2026-11-03T00:00:00.000Z' }
    ];

    expect(deriveLastPriceChange(snapshots)).toEqual({
      previousPriceMinor: 9000,
      at: '2026-11-03T00:00:00.000Z'
    });
    expect(deriveLastPriceChange(snapshots.slice(0, 2))).toEqual({
      previousPriceMinor: 10000,
      at: '2026-11-01T00:00:00.000Z'
    });
    expect(deriveLastPriceChange([snapshots[0]])).toBeUndefined();
  });
});