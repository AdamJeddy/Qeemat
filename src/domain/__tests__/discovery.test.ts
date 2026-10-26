import {
  buildDiscoverySections,
  filterDiscoveryProducts,
  discoveryVariantChoices,
  uniqueDiscoveryBrands,
  parseDecathlonListing
} from '../discovery';
import { DiscoveryPreferences, DiscoveryProduct } from '../types';
import { resolveSelectedVariant } from '../variants';

const preferences: DiscoveryPreferences = {
  completed: true,
  categories: ['fashion'],
  favoriteBrands: ['Kiprun'],
  budgetsByCategory: { fashion: 20000 },
  dismissedProductIds: [],
  seenProductIds: []
};

const products: DiscoveryProduct[] = [
  {
    id: 'decathlon_uae:shoe',
    siteKey: 'decathlon_uae',
    category: 'fashion',
    brand: 'Kiprun',
    title: 'Kiprun running shoes',
    url: 'https://decathlon.ae/products/shoe',
    imageUrl: 'https://images.example/shoe.jpg',
    priceMinor: 17500,
    currency: 'AED',
    availability: 'in_stock',
    observedAt: '2026-10-25T10:00:00.000Z'
  },
  {
    id: 'decathlon_uae:coat',
    siteKey: 'decathlon_uae',
    category: 'fashion',
    brand: 'Quechua',
    title: 'Hiking coat',
    url: 'https://decathlon.ae/products/coat',
    priceMinor: 29000,
    currency: 'AED',
    availability: 'in_stock',
    observedAt: '2026-10-25T10:00:00.000Z'
  },
  {
    id: 'decathlon_uae:tent',
    siteKey: 'decathlon_uae',
    category: 'sport',
    brand: 'Quechua',
    title: 'Two person tent',
    url: 'https://decathlon.ae/products/tent',
    priceMinor: 18000,
    currency: 'AED',
    availability: 'in_stock',
    observedAt: '2026-10-25T10:00:00.000Z'
  },
  {
    id: 'decathlon_uae:hidden',
    siteKey: 'decathlon_uae',
    category: 'fashion',
    brand: 'Kiprun',
    title: 'Dismissed shoe',
    url: 'https://decathlon.ae/products/hidden',
    priceMinor: 15000,
    currency: 'AED',
    availability: 'in_stock',
    observedAt: '2026-10-25T10:00:00.000Z'
  }
];

describe('buildDiscoverySections', () => {
  it('ranks selected interests, budgets, and favourite brands above other products', () => {
    const sections = buildDiscoverySections(products, preferences);

    expect(sections.picks.map((product) => product.id)).toEqual([
      'decathlon_uae:shoe',
      'decathlon_uae:hidden'
    ]);
    expect(sections.exploreDifferent).toEqual([]);
  });

  it('hides dismissed products and labels unseen products as newly discovered', () => {
    const sections = buildDiscoverySections(products, {
      ...preferences,
      dismissedProductIds: ['decathlon_uae:hidden'],
      seenProductIds: ['decathlon_uae:shoe']
    });

    expect(sections.picks.map((product) => product.id)).not.toContain('decathlon_uae:hidden');
    expect(sections.newlyDiscovered).toEqual([]);
  });

  it('spreads equally relevant picks across retailers when every interest is selected', () => {
    const nike = { ...products[0], id: 'nike:1', siteKey: 'nike_uae' as const, brand: 'Nike' };
    const beauty = { ...products[0], id: 'sephora:1', siteKey: 'sephora_uae' as const, category: 'beauty' as const, brand: 'Dior' };
    const result = buildDiscoverySections([...products, nike, beauty], {
      ...preferences, categories: ['fashion', 'beauty', 'electronics', 'sport'], favoriteBrands: [], budgetsByCategory: {}
    });
    expect(result.picks.slice(0, 4).map((product) => product.id)).toEqual([products[0].id, beauty.id, products[2].id, nike.id]);
  });
});

describe('filterDiscoveryProducts', () => {
  it('applies category, retailer, brand, and observed-price filters together', () => {
    expect(filterDiscoveryProducts(products, {
      category: 'fashion',
      siteKey: 'decathlon_uae',
      brand: 'Kiprun',
      maximumPriceMinor: 20000
    }).map((product) => product.id)).toEqual(['decathlon_uae:shoe', 'decathlon_uae:hidden']);
  });
});

describe('discovery choices', () => {
  it('deduplicates retailer brand casing while retaining the preferred display name', () => {
    expect(uniqueDiscoveryBrands(['Adidas', 'adidas', 'Nike', 'nike', 'Other brands'])).toEqual(['Adidas', 'Nike']);
  });

  it('hides model identifiers only when shopper choices still identify the exact variant', () => {
    const variants = [
      { id: 'black-42', label: 'Black 42', currency: 'AED', priceMinor: 10500, availability: 'in_stock' as const, attributes: [{ name: 'Model Code', value: '123' }, { name: 'Size', value: '42' }, { name: 'Color', value: 'Black' }] },
      { id: 'beige-42', label: 'Beige 42', currency: 'AED', priceMinor: 10500, availability: 'in_stock' as const, attributes: [{ name: 'Model Code', value: '456' }, { name: 'Size', value: '42' }, { name: 'Color', value: 'Beige' }] }
    ];
    const choices = discoveryVariantChoices(variants);
    expect(choices[0].attributes.map((attribute) => attribute.name)).toEqual(['Size', 'Color']);
    expect(resolveSelectedVariant(choices, { Size: '42', Color: 'Beige' })?.id).toBe('beige-42');
    expect(discoveryVariantChoices([{ ...variants[0] }, { ...variants[1], attributes: [{ name: 'Model Code', value: '456' }, { name: 'Size', value: '42' }, { name: 'Color', value: 'Black' }] }])[0].attributes).toHaveLength(3);
  });
});

describe('parseDecathlonListing', () => {
  it('uses the lowest available variant price and a direct product URL', () => {
    const parsed = parseDecathlonListing({
      id: 123,
      title: 'Kiprun KD900X running shoes',
      handle: 'kiprun-kd900x',
      vendor: 'Kiprun',
      images: [{ src: 'https://images.example/shoe.jpg' }],
      variants: [
        { price: '239.00', available: true },
        { price: '199.00', available: true }
      ]
    }, 'fashion', '2026-10-25T10:00:00.000Z');

    expect(parsed).toMatchObject({
      id: 'decathlon_uae:123',
      title: 'Kiprun KD900X running shoes',
      url: 'https://decathlon.ae/products/kiprun-kd900x',
      imageUrl: 'https://images.example/shoe.jpg',
      priceMinor: 19900,
      hasPriceRange: true,
      availability: 'in_stock',
      category: 'fashion'
    });
  });

  it('rejects malformed retailer listing records without throwing', () => {
    expect(parseDecathlonListing({
      id: 123,
      title: 'Broken listing',
      handle: 'broken-listing',
      images: {},
      variants: null
    }, 'fashion', '2026-10-25T10:00:00.000Z')).toBeUndefined();
  });
});
