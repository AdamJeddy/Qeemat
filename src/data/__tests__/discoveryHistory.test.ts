jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { recordDiscoveryObservations, getDiscoveryHistory } from '../discoveryHistory';
import { DiscoveryProduct } from '../../domain/types';
import { clearDiscoveryData } from '../discovery';

const item: DiscoveryProduct = { id: 'shoe-1', siteKey: 'nike_uae', category: 'footwear', brand: 'Nike', title: 'Shoe', url: 'https://www.nike.ae/en/shoe', priceMinor: 10000, currency: 'AED', availability: 'in_stock', observedAt: '2026-11-01T00:00:00Z' };
beforeEach(async () => { await AsyncStorage.clear(); });

test('records observations for every listing and compares the previous compatible price', async () => {
  const other = { ...item, id: 'shirt', url: 'https://www.nike.ae/en/shirt', category: 'clothing' as const };
  await recordDiscoveryObservations([item, other]);
  const [updated] = await recordDiscoveryObservations([{ ...item, priceMinor: 8000, observedAt: '2026-11-02T00:00:00Z' }]);
  expect(updated.previousPriceMinor).toBe(10000);
  expect(await getDiscoveryHistory(item)).toHaveLength(2);
  expect(await getDiscoveryHistory(other)).toHaveLength(1);
});

test('does not compare distinct listings, currencies, price units, or repeated observations', async () => {
  await recordDiscoveryObservations([item]);
  expect((await recordDiscoveryObservations([{ ...item, url: `${item.url}?variant=2`, priceMinor: 5000, observedAt: '2026-11-02T00:00:00Z' }]))[0].previousPriceMinor).toBeUndefined();
  expect((await recordDiscoveryObservations([{ ...item, currency: 'USD', priceMinor: 5000, observedAt: '2026-11-02T00:00:00Z' }]))[0].previousPriceMinor).toBeUndefined();
  expect((await recordDiscoveryObservations([{ ...item, priceBasis: 'kg', priceMinor: 5000, observedAt: '2026-11-03T00:00:00Z' }]))[0].previousPriceMinor).toBeUndefined();
  expect((await recordDiscoveryObservations([{ ...item, hasPriceRange: true, priceMinor: 5000, observedAt: '2026-11-04T00:00:00Z' }]))[0].previousPriceMinor).toBeUndefined();
  await recordDiscoveryObservations([item]);
  expect(await getDiscoveryHistory(item)).toHaveLength(4);
});

test('clearing discovery data also removes stored listing history', async () => {
  await recordDiscoveryObservations([item]);
  await clearDiscoveryData();
  expect(await getDiscoveryHistory(item)).toEqual([]);
});

test('flushes batched history reads without relying on background JS timers', async () => {
  let release = () => {};
  const read = jest.spyOn(AsyncStorage, 'multiGet').mockImplementationOnce((keys) => new Promise((resolve) => {
    release = () => resolve(keys.map((key) => [key, null] as const));
  }));
  const flush = jest.spyOn(AsyncStorage, 'flushGetRequests').mockImplementationOnce(() => release());
  try {
    await expect(recordDiscoveryObservations([item])).resolves.toHaveLength(1);
    expect(flush).toHaveBeenCalled();
  } finally { read.mockRestore(); flush.mockRestore(); }
});
