import {
  DiscoveryCategory,
  DiscoveryFilter,
  DiscoveryPreferences,
  DiscoveryProduct,
  ProductVariant,
  SiteKey
} from './types';

export const DISCOVERY_CATEGORY_LABELS: Record<DiscoveryCategory, string> = {
  fashion: 'Fashion & footwear',
  beauty: 'Beauty & fragrance',
  electronics: 'Electronics',
  sport: 'Sport & outdoors'
};

/** Broad interests are collected before every retailer category is available. */
export const DISCOVERY_INTEREST_CATEGORIES: DiscoveryCategory[] = [
  'fashion',
  'beauty',
  'electronics',
  'sport'
];

export type DiscoveryCollection = {
  id: string;
  label: string;
  category: DiscoveryCategory;
  siteKey: SiteKey;
  collectionHandle?: string;
  url?: string;
  provider?: 'shopify' | 'html' | 'woocommerce';
};

/**
 * Retailer listing sources are explicit and independently cached. Sources that
 * fail extraction or are blocked retain their cache and report a failure.
 */
export const DISCOVERY_COLLECTIONS: DiscoveryCollection[] = [
  {
    id: 'decathlon-footwear',
    label: 'Footwear',
    category: 'fashion',
    siteKey: 'decathlon_uae',
    collectionHandle: 'men-footwear'
  },
  {
    id: 'decathlon-fitness',
    label: 'Fitness',
    category: 'sport',
    siteKey: 'decathlon_uae',
    collectionHandle: 'fitness'
  },
  {
    id: 'decathlon-outdoors',
    label: 'Outdoors',
    category: 'sport',
    siteKey: 'decathlon_uae',
    collectionHandle: 'hike-camp'
  },
  { id: 'nike-shoes', label: 'Nike shoes', category: 'fashion', siteKey: 'nike_uae', url: 'https://www.nike.ae/en/mens/shoes', provider: 'html' },
  { id: 'nike-women', label: 'Nike women', category: 'fashion', siteKey: 'nike_uae', url: 'https://www.nike.ae/en/womens/shoes', provider: 'html' },
  { id: 'sss-shoes', label: 'Sun & Sand shoes', category: 'sport', siteKey: 'sun_sand_sports', url: 'https://en-ae.sssports.com/mens/shoes', provider: 'html' },
  { id: 'level-sneakers', label: 'Level Shoes sneakers', category: 'fashion', siteKey: 'level_shoes', url: 'https://www.levelshoes.com/men/shoes/sneakers.html', provider: 'html' },
  { id: 'ay-gear', label: 'Motorcycle gear', category: 'sport', siteKey: 'ay_accessories', url: 'https://ay-accessories.com/wp-json/wc/store/v1/products?per_page=24', provider: 'woocommerce' },
  { id: 'ounass-beauty', label: 'Ounass beauty', category: 'beauty', siteKey: 'ounass', url: 'https://www.ounass.ae/women/beauty', provider: 'html' },
  { id: 'ounass-fashion', label: 'Ounass clothing', category: 'fashion', siteKey: 'ounass', url: 'https://www.ounass.ae/women/clothing', provider: 'html' },
  { id: 'noon-audio', label: 'Noon headphones', category: 'electronics', siteKey: 'noon', url: 'https://www.noon.com/uae-en/electronics-and-mobiles/portable-audio-and-video/headphones-24056/', provider: 'html' },
  { id: 'amazon-audio', label: 'Amazon UAE headphones', category: 'electronics', siteKey: 'amazon_ae', url: 'https://www.amazon.ae/s?k=headphones', provider: 'html' },
  { id: 'adidas-shoes', label: 'Adidas shoes', category: 'fashion', siteKey: 'adidas', url: 'https://www.adidas.ae/en/men-all-shoes', provider: 'html' },
  { id: 'puma-shoes', label: 'Puma shoes', category: 'sport', siteKey: 'puma_uae', url: 'https://ae.puma.com/ae/en/men/shoes', provider: 'html' },
  { id: 'salomon-outdoors', label: 'Salomon outdoors', category: 'sport', siteKey: 'salomon_gcc', url: 'https://salomongcc.com/collections/shop-all-products/products.json?limit=24', provider: 'shopify' },
  { id: 'sephora-featured', label: 'Sephora featured beauty', category: 'beauty', siteKey: 'sephora_uae', url: 'https://www.sephora.me/ae-en', provider: 'html' },
  { id: 'faces-skincare', label: 'Faces skincare', category: 'beauty', siteKey: 'faces_uae', url: 'https://www.faces.ae/en/skincare', provider: 'html' },
  { id: 'centrepoint-women', label: 'Centrepoint women', category: 'fashion', siteKey: 'centrepoint_uae', url: 'https://www.centrepointstores.com/ae/en/c/women', provider: 'html' },
  { id: 'namshi-shoes', label: 'Namshi shoes', category: 'fashion', siteKey: 'namshi', url: 'https://www.namshi.com/uae-en/men-shoes/all-collection/', provider: 'html' },
  { id: 'deal-clothing', label: 'The Deal clothing', category: 'fashion', siteKey: 'the_deal', url: 'https://www.thedealoutlet.com/ae-en/flash_sale_26/women/clothing', provider: 'html' },
  { id: 'sharaf-electronics', label: 'Sharaf DG headphones', category: 'electronics', siteKey: 'sharaf_dg', url: 'https://uae.sharafdg.com/headphones-and-earphones/', provider: 'html' },
  { id: 'bfl-women', label: 'Brands For Less women', category: 'fashion', siteKey: 'brands_for_less', url: 'https://www.brandsforless.com/en-ae/women/', provider: 'html' }
];

export function discoverySourceUrl(collection: DiscoveryCollection): string {
  return collection.url ?? `https://decathlon.ae/collections/${collection.collectionHandle}/products.json?limit=24`;
}

export function discoveryCollectionPageUrl(collection: DiscoveryCollection): string {
  if (collection.provider === 'woocommerce') { return 'https://ay-accessories.com/shop/'; }
  return discoverySourceUrl(collection).replace(/\/products\.json\?.*$/, '');
}

export const DEFAULT_DISCOVERY_PREFERENCES: DiscoveryPreferences = {
  completed: false,
  categories: [],
  favoriteBrands: [],
  budgetsByCategory: {},
  dismissedProductIds: [],
  seenProductIds: []
};

type ShopifyVariant = {
  price?: string;
  available?: boolean;
};

type ShopifyListingProduct = {
  id?: number | string;
  title?: string;
  handle?: string;
  vendor?: string;
  images?: unknown[];
  variants?: unknown[];
};

export function parseDecathlonListing(
  product: unknown,
  category: DiscoveryCategory,
  observedAt: string,
  siteKey: SiteKey = 'decathlon_uae'
): DiscoveryProduct | undefined {
  if (!isShopifyListingProduct(product) || product.id === undefined || !product.title || !product.handle) {
    return undefined;
  }

  const variants = (product.variants ?? []).filter(isShopifyVariant);
  const purchasableVariants = variants.filter((variant) => variant.available !== false);
  const priceVariants = purchasableVariants.length > 0 ? purchasableVariants : variants;
  const prices = priceVariants
    .map((variant) => parseListingPrice(variant.price))
    .filter((price): price is number => price !== undefined);

  return {
    id: `${siteKey}:${product.id}`,
    siteKey,
    category,
    brand: product.vendor?.trim() || (siteKey === 'salomon_gcc' ? 'Salomon' : 'Decathlon'),
    title: product.title,
    url: `https://${siteKey === 'salomon_gcc' ? 'salomongcc.com' : 'decathlon.ae'}/products/${product.handle}`,
    imageUrl: product.images?.map(readShopifyImageUrl).find((url) => url !== undefined),
    priceMinor: prices.length ? Math.min(...prices) : undefined,
    hasPriceRange: new Set(prices).size > 1,
    currency: 'AED',
    availability: purchasableVariants.length > 0 ? 'in_stock' : variants.length > 0 ? 'out_of_stock' : 'unknown',
    observedAt
  };
}

function isShopifyListingProduct(value: unknown): value is ShopifyListingProduct {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (typeof candidate.id === 'string' || typeof candidate.id === 'number') &&
    typeof candidate.title === 'string' &&
    typeof candidate.handle === 'string' &&
    (candidate.vendor === undefined || typeof candidate.vendor === 'string') &&
    (candidate.images === undefined || Array.isArray(candidate.images)) &&
    (candidate.variants === undefined || Array.isArray(candidate.variants));
}

function isShopifyVariant(value: unknown): value is ShopifyVariant {
  return Boolean(value) && typeof value === 'object';
}

function readShopifyImageUrl(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const src = (value as { src?: unknown }).src;
  return typeof src === 'string' ? src : undefined;
}

export function filterDiscoveryProducts(products: DiscoveryProduct[], filter: DiscoveryFilter): DiscoveryProduct[] {
  return products.filter((product) =>
    (!filter.category || product.category === filter.category) &&
    (!filter.siteKey || product.siteKey === filter.siteKey) &&
    (!filter.brand || product.brand.toLocaleLowerCase() === filter.brand.toLocaleLowerCase()) &&
    (filter.maximumPriceMinor === undefined || (product.priceMinor !== undefined && product.priceMinor <= filter.maximumPriceMinor))
  );
}

export function buildDiscoverySections(products: DiscoveryProduct[], preferences: DiscoveryPreferences): {
  picks: DiscoveryProduct[];
  newlyDiscovered: DiscoveryProduct[];
  exploreDifferent: DiscoveryProduct[];
} {
  const dismissed = new Set(preferences.dismissedProductIds);
  const seen = new Set(preferences.seenProductIds);
  const visible = products.filter((product) => !dismissed.has(product.id) && product.availability !== 'out_of_stock');
  const relevant = visible.filter((product) => {
    const budget = preferences.budgetsByCategory[product.category];
    return (!preferences.categories.length || preferences.categories.includes(product.category)) &&
      (budget === undefined || (product.priceMinor !== undefined && product.priceMinor <= budget));
  });
  // Round-robin equally relevant retailers/categories so a large source cannot
  // occupy the entire first screen, even when all interests are selected.
  const tiers = new Map<number, DiscoveryProduct[]>();
  for (const product of relevant) {
    const score = discoveryScore(product, preferences);
    tiers.set(score, [...(tiers.get(score) ?? []), product]);
  }
  const picks: DiscoveryProduct[] = [];
  for (const [, tier] of [...tiers].sort(([left], [right]) => right - left)) {
    const categoryQueues = DISCOVERY_INTEREST_CATEGORIES.map((category) => {
      const stores = new Map<string, DiscoveryProduct[]>();
      for (const product of tier.filter((item) => item.category === category)) {
        stores.set(product.siteKey, [...(stores.get(product.siteKey) ?? []), product]);
      }
      return roundRobin([...stores.values()]);
    });
    picks.push(...roundRobin(categoryQueues));
  }
  const newlyDiscovered = picks.filter((product) => !seen.has(product.id));
  const favoriteBrands = new Set(preferences.favoriteBrands.map((brand) => brand.toLocaleLowerCase()));

  return {
    picks,
    newlyDiscovered,
    exploreDifferent: favoriteBrands.size ? picks.filter((product) => !favoriteBrands.has(product.brand.toLocaleLowerCase())) : []
  };
}

export function preferredDiscoveryBrands(categories: DiscoveryCategory[]): string[] {
  const choices: Partial<Record<DiscoveryCategory, string[]>> = {
    fashion: ['Nike', 'Adidas', 'Puma', 'New Balance', 'ASICS', 'Skechers', 'On', 'Converse', 'Vans', 'Calvin Klein', 'Ralph Lauren', 'Quechua'],
    beauty: ['Sephora Collection', 'Dior', 'NARS', 'Chanel', 'Huda Beauty', 'Charlotte Tilbury', 'Estee Lauder', 'Clinique', 'Kiehl\'s', 'Lancôme', 'Kayali'],
    electronics: ['Apple', 'Samsung', 'Sony', 'Bose', 'JBL', 'Anker', 'Huawei', 'Lenovo', 'HP', 'Asus'],
    sport: ['Nike', 'Adidas', 'Puma', 'Salomon', 'Kiprun', 'Quechua', 'Domyos', 'Kalenji', 'Decathlon']
  };

  return [...new Set(categories.flatMap((category) => choices[category] ?? []))];
}

export function uniqueDiscoveryBrands(brands: string[]): string[] {
  const result = new Map<string, string>();
  for (const brand of brands) {
    const key = brand.trim().toLocaleLowerCase();
    if (key && key !== 'other brands' && !result.has(key)) { result.set(key, brand.trim()); }
  }
  return [...result.values()].sort((left, right) => left.localeCompare(right));
}

/** Keep retailer identifiers for saving, but ask shoppers only for real options
 * when those options unambiguously identify the exact retailer variant. */
export function discoveryVariantChoices(variants: ProductVariant[]): ProductVariant[] {
  const choices = variants.map((variant) => ({ ...variant, attributes: variant.attributes.filter((attribute) => attribute.name.toLowerCase() !== 'model code') }));
  const signatures = choices.map((variant) => variant.attributes.map((attribute) => `${attribute.name}:${attribute.value}`).sort().join('|'));
  return choices.every((variant) => variant.attributes.length) && new Set(signatures).size === variants.length ? choices : variants;
}

function discoveryScore(product: DiscoveryProduct, preferences: DiscoveryPreferences): number {
  let score = 0;
  if (preferences.categories.includes(product.category)) {
    score += 1000;
  }
  if (preferences.favoriteBrands.some((brand) => brand.localeCompare(product.brand, undefined, { sensitivity: 'accent' }) === 0)) {
    score += 50;
  }
  return score;
}

function roundRobin(queues: DiscoveryProduct[][]): DiscoveryProduct[] {
  const result: DiscoveryProduct[] = [];
  while (queues.some((queue) => queue.length)) {
    for (const queue of queues) { const product = queue.shift(); if (product) { result.push(product); } }
  }
  return result;
}

function parseListingPrice(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? Math.round(price * 100) : undefined;
}
