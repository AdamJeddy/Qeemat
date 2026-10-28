import { buildSearchRequests, matchesProductSearch, parseSearchPage, rankSearchMatches } from '../discoverySearch';
import { DiscoveryProduct } from '../types';

const observedAt = '2026-10-28T09:00:00Z';
const product = (title: string, brand = 'Apple'): DiscoveryProduct => ({ id: title, title, brand, siteKey: 'noon', url: 'https://www.noon.com/p/', category: 'general', currency: 'AED', priceMinor: 100, availability: 'unknown', observedAt });

describe('retailer product search', () => {
  it('encodes user text and covers every Ounass audience without enabling unresolved sources', () => {
    const requests = buildSearchRequests('  Nike & shoes  ');
    expect(requests.find((entry) => entry.siteKey === 'nike_uae')?.url).toContain('q=Nike%20%26%20shoes');
    expect(requests.filter((entry) => entry.siteKey === 'ounass').map((entry) => entry.url)).toEqual(['women', 'men', 'kids'].map((audience) => `https://www.ounass.ae/${audience}?fh_location=%2F%24s%3DNike%20%26%20shoes`));
    expect(requests.filter((entry) => entry.siteKey === 'level_shoes').map((entry) => entry.url)).toEqual(['women', 'men', 'kids'].map((audience) => `https://www.levelshoes.com/search?term=Nike%20%26%20shoes&gender=${audience}`));
    expect(requests.some((entry) => entry.siteKey === 'sharaf_dg')).toBe(false);
    expect(requests.find((entry) => entry.siteKey === 'amazon_ae')?.url).toBe('https://www.amazon.ae/s?k=Nike%20%26%20shoes');
    expect(buildSearchRequests(' ')).toEqual([]);
    expect(() => buildSearchRequests('a'.repeat(119) + '😀')).not.toThrow();
  });
  it('keeps exact model tokens and rejects unrelated retailer alternatives', () => {
    expect(matchesProductSearch(product('iPhone 16 128GB'), 'iphone16')).toBe(true);
    expect(matchesProductSearch(product('iPhone 17 Pro 256GB'), 'iPhone 16')).toBe(false);
    expect(matchesProductSearch(product('Air Max 90', 'Nike'), 'nike air max')).toBe(true);
    expect(matchesProductSearch(product('Running shoes', 'Nike'), 'nike sneakers')).toBe(true);
    expect(matchesProductSearch(product('Crème hydratante', 'Brand'), 'creme')).toBe(true);
    expect(matchesProductSearch(product('Unrelated dress'), 'zzqeematnomatch827491')).toBe(false);
  });
  it('puts the named product before compatible accessories while retaining accessory searches', () => {
    const phone = product('iPhone 16 128GB Black');
    const cover = product('iPhone 16 protective case');
    expect(rankSearchMatches([cover, phone, product('iPhone 17')], 'iphone 16')).toEqual([phone, cover]);
    expect(rankSearchMatches([phone, cover], 'iphone 16 case')).toEqual([cover]);
  });
  it('reads only the Level Shoes search list, excluding recommendation state', () => {
    const request = buildSearchRequests('sneakers').find((entry) => entry.siteKey === 'level_shoes')!;
    const tile = { id: '1', name: 'Sneakers', rawSalePrice: 300, brandName: 'Nike', action: { url: '/shoe.html' } };
    const body = `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { __APOLLO_STATE__: { ROOT_QUERY: { '_productList:{"queryParam":"&term=sneakers"}': { products: [], analytics: { constructor: { request: { term: 'sneakers', page: 1 } } } }, recommendations: { products: [tile] } } } } } })}</script>`;
    expect(parseSearchPage(body, request, 'sneakers', observedAt)).toEqual({ products: [] });
    expect(parseSearchPage(body.replace('"products":[]', `"products":[${JSON.stringify(tile)}]`), request, 'sneakers', observedAt)?.products).toHaveLength(1);
  });
  it('does not call a challenge or an unparsed page an empty result', () => {
    const request = buildSearchRequests('Nike').find((entry) => entry.siteKey === 'sun_sand_sports')!;
    expect(parseSearchPage('<title>Just a moment...</title>Cloudflare cf_chl_opt', request, 'Nike', observedAt)).toBeUndefined();
    expect(parseSearchPage('<html><body>Loading...</body></html>', request, 'Nike', observedAt)).toBeUndefined();
    expect(parseSearchPage('<h1>No results found for Nike</h1>', request, 'Nike', observedAt)?.products).toEqual([]);
    expect(parseSearchPage('<h1>No results for &ldquo;Nike&rdquo;</h1>', request, 'Nike', observedAt)?.products).toEqual([]);
    expect(parseSearchPage('<p>Sorry, we couldn&#x27;t find what you are looking for.</p>', request, 'Nike', observedAt)?.products).toEqual([]);
    expect(parseSearchPage('<header>Your bag: 0 items</header><main>Loading</main>', request, 'Nike', observedAt)).toBeUndefined();
  });
  it('removes unrelated Faces fallback cards and retains an observed next-page URL', () => {
    const request = buildSearchRequests('Nike').find((entry) => entry.siteKey === 'faces_uae')!;
    const body = '<div class="product" data-pid="1"><div data-gtm-enhanced-ecommerce-impression="{&quot;item_name&quot;:&quot;Unrelated perfume&quot;,&quot;price&quot;:50}"><a href="/perfume.html"></a></div></div>';
    expect(parseSearchPage(body, request, 'Nike', observedAt)?.products).toEqual([]);
    const sss = buildSearchRequests('shoes').find((entry) => entry.siteKey === 'sun_sand_sports')!;
    const next = 'https://en-ae.sssports.com/on/demandware.store/Sites-UAE-Site/en_AE/Search-UpdateGrid?q=shoes&start=24&sz=24';
    const page = body.replace('Unrelated perfume', 'Running shoes') + `<button data-url="${next.replace(/&/g, '&amp;')}">More</button>`;
    expect(parseSearchPage(page, sss, 'shoes', observedAt)?.nextUrl).toBe(next);
    expect(parseSearchPage(page.replace('https://en-ae.sssports.com/on/', 'https://example.com/on/'), sss, 'shoes', observedAt)?.nextUrl).toBeUndefined();
  });
  it('continues WooCommerce pages when one record has no usable price', () => {
    const request = buildSearchRequests('helmet').find((entry) => entry.siteKey === 'ay_accessories')!;
    const records = Array.from({ length: 20 }, (_, index) => ({ id: index, name: `Helmet ${index}`, permalink: `https://ay-accessories.com/product/helmet-${index}/`, prices: { price: index === 19 ? '0' : '1000', currency_minor_unit: 2, currency_code: 'AED' } }));
    const page = parseSearchPage(JSON.stringify(records), request, 'helmet', observedAt);
    expect(page?.products).toHaveLength(19);
    expect(page?.nextUrl).toContain('&page=2');
  });
});
