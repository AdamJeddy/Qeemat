import { DISCOVERY_SOURCE_MAPS, selectDiscoveryCollections } from '../discoverySources';
import { SUPPORTED_SITES } from '../sites';
import { buildDiscoverySections, filterDiscoveryProducts, DISCOVERY_CATEGORY_LABELS } from '../discovery';
import { DISCOVERY_CATEGORY_GROUPS } from '../discoveryCategories';
import { DiscoveryProduct } from '../types';

describe('retailer category browser', () => {
  it('classifies the actual department rather than an unrelated word in its parent URL', () => {
    const source = (site: string, label: string) => DISCOVERY_SOURCE_MAPS.find((item) => item.siteKey === site && item.label === label);
    expect(source('noon', 'Bean bags')?.category).toBe('furniture');
    expect(source('noon', 'Mats & carpets')?.category).toBe('home');
    expect(source('faces_uae', 'Brushes and Sponges')?.category).toBe('beauty_tools');
    expect(source('amazon_ae', 'History')?.category).toBe('books');
    expect(source('noon', 'Guitars')?.category).toBe('musical_instruments');
    expect(DISCOVERY_SOURCE_MAPS.find((item) => item.url?.endsWith('/women/beauty/tools-accessories'))?.category).toBe('beauty_tools');
    expect(DISCOVERY_SOURCE_MAPS.find((item) => item.url?.endsWith('/c/household-kitchen-kitchentoolsandutensils'))?.category).toBe('kitchen');
    expect(DISCOVERY_SOURCE_MAPS.find((item) => item.url?.endsWith('/c/baby-feeding-accessories-bottlebrushes'))?.category).toBe('baby');
    expect(DISCOVERY_SOURCE_MAPS.find((item) => item.url?.endsWith('/home_and_lifestyle-office_and_school_supplies/'))?.category).toBe('stationery');
    expect(DISCOVERY_SOURCE_MAPS.find((item) => item.url?.endsWith('/home_and_lifestyle-bedding/'))?.category).toBe('bedding');
  });
  it('keeps every listing identity unique and covers each supported retailer', () => {
    expect(new Set(DISCOVERY_SOURCE_MAPS.map((source) => source.id)).size).toBe(DISCOVERY_SOURCE_MAPS.length);
    expect([...new Set(DISCOVERY_SOURCE_MAPS.map((source) => source.siteKey))].sort()).toEqual(SUPPORTED_SITES.map((site) => site.key).sort());
  });
  it('only registers known interests and retailer-owned HTTPS URLs, with supply mapped for every quiz choice', () => {
    for (const source of DISCOVERY_SOURCE_MAPS) {
      expect(DISCOVERY_CATEGORY_LABELS[source.category]).toBeDefined();
      expect(source.url).toMatch(/^https:\/\//);
      const hostname = source.url?.match(/^https:\/\/([^/]+)\//)?.[1].replace(/^www\./, '');
      expect(SUPPORTED_SITES.find((site) => site.key === source.siteKey)?.hostnames.map((host) => host.replace(/^www\./, ''))).toContain(hostname);
    }
    for (const category of DISCOVERY_CATEGORY_GROUPS.flatMap((group) => group.categories)) {
      expect(DISCOVERY_SOURCE_MAPS.some((source) => source.category === category)).toBe(true);
    }
  });

  it('loads a bounded, varied selection instead of fetching every mapped page', () => {
    const sources = selectDiscoveryCollections();
    expect(sources.length).toBeLessThanOrEqual(24);
    expect(new Set(sources.map((source) => source.siteKey)).size).toBeGreaterThanOrEqual(15);
    expect(sources.every((source) => !source.isDepartment)).toBe(true);
  });

  it('uses declared interests to choose pages and supports a second batch without repeats', () => {
    const first = selectDiscoveryCollections({ categories: ['skincare', 'phones'] });
    const second = selectDiscoveryCollections({ categories: ['skincare', 'phones'], offset: 24 });
    expect(first.length).toBe(24);
    expect(new Set(first.map((source) => source.category))).toEqual(new Set(['skincare', 'phones']));
    expect(second.some((source) => first.some((other) => source.id === other.id))).toBe(false);
  });

  it('can fetch any individual mapped PLP, including a mixed department, on demand', () => {
    const source = DISCOVERY_SOURCE_MAPS.find((item) => item.category === 'groceries')!;
    expect(source).toBeDefined();
    expect(selectDiscoveryCollections({ collectionId: source.id })).toEqual([source]);
    expect(selectDiscoveryCollections({ siteKey: 'carrefour_uae', categories: ['fresh_food'] }).every((item) => item.siteKey === 'carrefour_uae' && item.category === 'fresh_food')).toBe(true);
    expect(selectDiscoveryCollections({ siteKey: 'brands_for_less' }).every((item) => item.siteKey === 'brands_for_less' && !item.isDepartment)).toBe(true);
    expect(selectDiscoveryCollections({ siteKey: 'brands_for_less', categories: ['footwear'] }).length).toBeGreaterThan(1);
  });

  it('keeps a product relevant in every collection it belongs to, with independent budgets', () => {
    const product: DiscoveryProduct = { id: 'shoe', siteKey: 'nike_uae', category: 'footwear', categories: ['footwear', 'sports'], collectionIds: ['running'], brand: 'Nike', title: 'Shoe', url: 'https://www.nike.ae/shoe', currency: 'AED', priceMinor: 20000, availability: 'in_stock', observedAt: '2026-10-26T10:00:00Z' };
    expect(filterDiscoveryProducts([product], { category: 'sports', collectionId: 'running' })).toEqual([product]);
    const preferences = { completed: true, categories: ['sports' as const], favoriteBrands: [], budgetsByCategory: { footwear: 10000, sports: 30000 }, seenProductIds: [], dismissedProductIds: [] };
    expect(buildDiscoverySections([product], preferences).picks).toEqual([product]);
    expect(buildDiscoverySections([product], { ...preferences, budgetsByCategory: { sports: 10000 } }).picks).toEqual([]);
  });
});
