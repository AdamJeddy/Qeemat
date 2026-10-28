jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../webViewFetcher', () => ({ fetchPageHtmlViaWebView: jest.fn().mockResolvedValue(null) }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadProductSearch } from '../discoverySearchCatalog';
import { buildSearchRequests } from '../discoverySearch';
import { fetchPageHtmlViaWebView } from '../webViewFetcher';

const response = (name: string) => ({ ok: true, json: async () => ({}), text: async () => `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name, url: '/shoe.html', offers: { price: 100 } })}</script>` });

describe('progressive retailer search', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });
  it('does not make fast HTTP stores wait behind browser-only stores', async () => {
    let release!: () => void;
    (fetchPageHtmlViaWebView as jest.Mock).mockImplementationOnce(() => new Promise<null>((resolve) => { release = () => resolve(null); }));
    let fastProductShown = false;
    const pending = loadProductSearch('shoes', { requests: buildSearchRequests('shoes').slice(0, 4), fetcher: jest.fn(async (url: string) => url.includes('puma.com') ? response('Running shoes') : { ...response(''), ok: false, text: async () => 'Blocked' }), onUpdate: (value) => { if (value.products.some((item) => item.siteKey === 'puma_uae')) { fastProductShown = true; } } });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const shownBeforeBrowserFinishes = fastProductShown;
    release(); await pending;
    expect(shownBeforeBrowserFinishes).toBe(true);
  });
  it('streams matches while other sources fail and distinguishes verified empty results', async () => {
    const requests = buildSearchRequests('shoes').filter((request) => ['nike_uae', 'sun_sand_sports', 'faces_uae'].includes(request.siteKey));
    const fetcher = jest.fn(async (url: string) => {
      if (url.includes('nike.ae')) { return response('Running shoes'); }
      if (url.includes('sssports')) { return { ...response(''), text: async () => '<h1>No results for shoes</h1>' }; }
      throw new Error('offline');
    });
    const updates: number[] = [];
    const result = await loadProductSearch('shoes', { requests, fetcher, onUpdate: (value) => updates.push(value.products.length) });
    expect(result.products).toHaveLength(1);
    expect(updates).toContain(1);
    expect(result.sources.map((source) => source.status)).toEqual(['ready', 'empty', 'unavailable']);
    const offline = await loadProductSearch('shoes', { requests, fetcher: jest.fn().mockRejectedValue(new Error('offline')), force: true });
    expect(offline.products).toHaveLength(1);
    expect(offline.sources[0]).toEqual(expect.objectContaining({ status: 'unavailable', observedAt: expect.any(String) }));
    expect((await loadProductSearch('different', { requests: [], fetcher })).products).toEqual([]);
  });
  it('does not publish or save an obsolete query after cancellation', async () => {
    let cancelled = false;
    const requests = buildSearchRequests('shoes').slice(0, 1);
    const updates: number[] = [];
    await loadProductSearch('shoes', { requests, isCancelled: () => cancelled, fetcher: jest.fn(async () => { cancelled = true; return response('shoes'); }), onUpdate: (value) => updates.push(value.products.length) });
    expect(updates).toEqual([0]);
    expect(await AsyncStorage.getItem('qeemat.discovery.search.v1')).toBeNull();
  });
  it('merges additional pages without dropping earlier products or making duplicate trackers', async () => {
    const requests = buildSearchRequests('shoes').filter((request) => request.siteKey === 'sun_sand_sports');
    const first = response('shoes');
    const nextUrl = 'https://en-ae.sssports.com/on/demandware.store/Sites-UAE-Site/en_AE/Search-UpdateGrid?q=shoes&start=24&sz=24';
    const result = await loadProductSearch('shoes', { requests, fetcher: jest.fn(async () => ({ ...first, text: async () => `${await first.text()}<button data-url="${nextUrl}">More</button>` })) });
    const more = await loadProductSearch('shoes', { previous: result, loadMore: true, fetcher: jest.fn(async () => ({ ...response('Other shoes'), text: async () => (await response('Other shoes').text()).replace('/shoe.html', '/other.html') })) });
    expect(more.products.map((item) => item.title)).toEqual(['shoes', 'Other shoes']);
    expect(more.sources[0].nextUrl).toBeUndefined();
  });
});
