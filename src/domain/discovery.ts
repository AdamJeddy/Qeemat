import {
  DiscoveryCategory,
  DiscoveryFilter,
  DiscoveryPreferences,
  DiscoveryProduct,
  SiteKey
} from './types';

export const DISCOVERY_CATEGORY_LABELS: Record<DiscoveryCategory, string> = {
  fashion: 'Fashion & footwear',
  beauty: 'Beauty & fragrance',
  electronics: 'Electronics',
  sport: 'Sport & outdoors'
};

export type DiscoveryCollection = {
  id: string;
  label: string;
  category: DiscoveryCategory;
  siteKey: SiteKey;
  collectionHandle: string;
};

/**
 * Discovery sources are deliberately explicit. A tracker-supported retailer is
 * only added here after its listing endpoint is proven on a real device.
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
    collectionHandle: 'outdoors'
  }
];

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
  observedAt: string
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
    id: `decathlon_uae:${product.id}`,
    siteKey: 'decathlon_uae',
    category,
    brand: product.vendor?.trim() || 'Decathlon',
    title: product.title,
    url: `https://decathlon.ae/products/${product.handle}`,
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
    (!filter.brand || product.brand === filter.brand) &&
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
  const picks = [...visible].sort((left, right) => discoveryScore(right, preferences) - discoveryScore(left, preferences));
  const newlyDiscovered = picks.filter((product) => !seen.has(product.id));
  const selectedCategories = new Set(preferences.categories);
  const favoriteBrands = new Set(preferences.favoriteBrands.map((brand) => brand.toLocaleLowerCase()));

  return {
    picks,
    newlyDiscovered,
    exploreDifferent: picks.filter((product) => !selectedCategories.has(product.category) && !favoriteBrands.has(product.brand.toLocaleLowerCase()))
  };
}

export function preferredDiscoveryBrands(categories: DiscoveryCategory[]): string[] {
  const choices: Partial<Record<DiscoveryCategory, string[]>> = {
    fashion: ['Kiprun', 'Quechua', 'Decathlon'],
    beauty: ['Sephora Collection', 'Dior', 'NARS'],
    electronics: ['Apple', 'Samsung', 'Sony'],
    sport: ['Kiprun', 'Quechua', 'Domyos', 'Kalenji', 'Decathlon']
  };

  return [...new Set(categories.flatMap((category) => choices[category] ?? []))];
}

function discoveryScore(product: DiscoveryProduct, preferences: DiscoveryPreferences): number {
  let score = 0;
  if (preferences.categories.includes(product.category)) {
    score += 100;
  }
  if (preferences.favoriteBrands.some((brand) => brand.localeCompare(product.brand, undefined, { sensitivity: 'accent' }) === 0)) {
    score += 50;
  }
  const budget = preferences.budgetsByCategory[product.category];
  if (budget !== undefined && product.priceMinor !== undefined && product.priceMinor <= budget) {
    score += 20;
  }
  return score;
}

function parseListingPrice(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? Math.round(price * 100) : undefined;
}
