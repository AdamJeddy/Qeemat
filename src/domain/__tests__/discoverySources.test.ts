import { DISCOVERY_SOURCE_MAPS, selectDiscoveryCollections } from '../discoverySources';
import { SUPPORTED_SITES } from '../sites';
import { buildDiscoverySections, filterDiscoveryProducts } from '../discovery';
import { DiscoveryProduct } from '../types';

describe('retailer category browser', () => {
  it('keeps every listing identity unique and covers each supported retailer', () => {
    expect(new Set(DISCOVERY_SOURCE_MAPS.map((source) => source.id)).size).toBe(DISCOVERY_SOURCE_MAPS.length);
    expect([...new Set(DISCOVERY_SOURCE_MAPS.map((source) => source.siteKey))].sort()).toEqual(SUPPORTED_SITES.map((site) => site.key).sort());
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
  });

  it('keeps a product relevant in every collection it belongs to, with independent budgets', () => {
    const product: DiscoveryProduct = { id: 'shoe', siteKey: 'nike_uae', category: 'footwear', categories: ['footwear', 'sports'], collectionIds: ['running'], brand: 'Nike', title: 'Shoe', url: 'https://www.nike.ae/shoe', currency: 'AED', priceMinor: 20000, availability: 'in_stock', observedAt: '2026-10-26T10:00:00Z' };
    expect(filterDiscoveryProducts([product], { category: 'sports', collectionId: 'running' })).toEqual([product]);
    const preferences = { completed: true, categories: ['sports' as const], favoriteBrands: [], budgetsByCategory: { footwear: 10000, sports: 30000 }, seenProductIds: [], dismissedProductIds: [] };
    expect(buildDiscoverySections([product], preferences).picks).toEqual([product]);
    expect(buildDiscoverySections([product], { ...preferences, budgetsByCategory: { sports: 10000 } }).picks).toEqual([]);
  });
});
