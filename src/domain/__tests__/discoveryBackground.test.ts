jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runDiscoveryBackgroundRefresh } from '../discoveryBackground';

beforeEach(async () => { await AsyncStorage.clear(); });

test('rotates bounded background work across cached collections and saved searches', async () => {
  const collections = jest.fn().mockResolvedValue(['a', 'b', 'c', 'd']);
  const searches = jest.fn().mockResolvedValue([{ query: 'sneakers', sourceId: 'search-nike_uae' }, { query: 'jeans', sourceId: 'search-zara_uae-woman' }]);
  const refreshCollection = jest.fn().mockResolvedValue(undefined);
  const refreshSearch = jest.fn().mockResolvedValue(undefined);
  const dependencies = { collections, searches, refreshCollection, refreshSearch };
  await runDiscoveryBackgroundRefresh(dependencies);
  expect(refreshCollection.mock.calls.length + refreshSearch.mock.calls.length).toBe(3);
  expect(refreshCollection).toHaveBeenCalled();
  expect(refreshSearch).toHaveBeenCalled();
  await runDiscoveryBackgroundRefresh(dependencies);
  expect(refreshCollection.mock.calls.length + refreshSearch.mock.calls.length).toBe(6);
  expect(new Set(refreshCollection.mock.calls.map(([id]) => id))).toEqual(new Set(['a', 'b', 'c', 'd']));
});

test('continues to other sources when a retailer fails', async () => {
  const refreshCollection = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  await runDiscoveryBackgroundRefresh({ collections: async () => ['a', 'b'], searches: async () => [], refreshCollection, refreshSearch: jest.fn() });
  expect(refreshCollection).toHaveBeenCalledTimes(2);
});

test('native deadline aborts a stalled request even without JavaScript timers', async () => {
  let expire!: () => void;
  const wait = jest.fn(() => new Promise<void>((resolve) => { expire = resolve; }));
  const fetcher = jest.fn((_url, options) => new Promise<any>((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const { createBackgroundFetcher } = require('../discoveryBackground');
  const pending = createBackgroundFetcher(fetcher, wait)('https://example.test');
  expire();
  await expect(pending).rejects.toThrow();
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
});

test('native deadline also covers a stalled response body', async () => {
  let expire!: () => void;
  const wait = () => new Promise<void>((resolve) => { expire = resolve; });
  const { createBackgroundFetcher } = require('../discoveryBackground');
  const response = await createBackgroundFetcher(async () => ({ ok: true, json: () => new Promise(() => {}) }), wait)('https://example.test');
  const body = response.json();
  expire();
  await expect(body).rejects.toThrow('timed out');
});
