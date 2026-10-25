import {
  buildDiscoverySections,
  filterDiscoveryProducts,
  parseDecathlonListing
} from '../discovery';
import { DiscoveryPreferences, DiscoveryProduct } from '../types';

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
      'decathlon_uae:hidden',
      'decathlon_uae:coat',
      'decathlon_uae:tent'
    ]);
    expect(sections.exploreDifferent.map((product) => product.id)).toEqual(['decathlon_uae:tent']);
  });

  it('hides dismissed products and labels unseen products as newly discovered', () => {
    const sections = buildDiscoverySections(products, {
      ...preferences,
      dismissedProductIds: ['decathlon_uae:hidden'],
      seenProductIds: ['decathlon_uae:shoe']
    });

    expect(sections.picks.map((product) => product.id)).not.toContain('decathlon_uae:hidden');
    expect(sections.newlyDiscovered.map((product) => product.id)).toEqual([
      'decathlon_uae:coat',
      'decathlon_uae:tent'
    ]);
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
