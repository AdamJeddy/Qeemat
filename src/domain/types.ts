export type SiteKey = 'hm_uae' | 'zara_uae' | 'noon' | 'nike_uae' | 'sun_sand_sports' | 'level_shoes' | 'ay_accessories' | 'ounass' | 'amazon_ae' | 'adidas' | 'puma_uae' | 'decathlon_uae' | 'salomon_gcc' | 'sephora_uae' | 'faces_uae' | 'centrepoint_uae' | 'namshi' | 'the_deal' | 'sharaf_dg' | 'brands_for_less' | 'carrefour_uae';

export type Availability = 'in_stock' | 'out_of_stock' | 'unknown';

export type CheckPreference = 'daily' | 'every_3_days' | 'weekly';

export type AlertMode = 'price_drop' | 'any_change' | 'target_price';

export type CheckStatus =
  | 'invalid_url'
  | 'ok'
  | 'price_changed'
  | 'price_not_found'
  | 'variant_not_found'
  | 'network_error'
  | 'unsupported_page'
  | 'blocked'
  | 'site_parser_failed';

export type SnapshotSource = 'unknown' | 'manual_single' | 'manual_batch' | 'background';

/** Categories currently supported by the local discovery experience. */
export type DiscoveryCategory = import('./discoveryCategories').ShoppingCategory |
  'fashion' | 'beauty' | 'electronics' | 'sport' | 'home_department' | 'groceries' | 'general';

export type DiscoveryProduct = {
  previousPriceMinor?: number;
  previousObservedAt?: string;
  priceBasis?: import('./priceBasis').PriceBasis;
  /** Stable identifier from the retailer catalogue. */
  id: string;
  siteKey: SiteKey;
  category: DiscoveryCategory;
  /** A product can appear in several retailer categories without becoming duplicates. */
  categories?: DiscoveryCategory[];
  collectionIds?: string[];
  brand: string;
  title: string;
  url: string;
  /** Retailer-supplied product type used only to match product searches. */
  searchCategory?: string;
  imageUrl?: string;
  /** Lowest currently-observed purchasable price, in currency minor units. */
  priceMinor?: number;
  /** True when the listing exposes multiple purchasable variant prices. */
  hasPriceRange?: boolean;
  currency: string;
  availability: Availability;
  observedAt: string;
};

export type DiscoveryPreferences = {
  completed: boolean;
  categories: DiscoveryCategory[];
  favoriteBrands: string[];
  budgetsByCategory: Partial<Record<DiscoveryCategory, number>>;
  dismissedProductIds: string[];
  seenProductIds: string[];
};

/** One retailer's offer inside a cross-retailer product group. */
export type DiscoveryOffer = {
  product: DiscoveryProduct;
  /** Original position in the source list, used for stable tie-breaks. */
  order: number;
  /**
   * True when this offer can be compared on price: it has a single AED price
   * on the same pack/weight basis as the other comparable offers in its group.
   */
  comparable: boolean;
  /** Difference from the group's lowest comparable price, in minor units. */
  priceDeltaMinor?: number;
};

/** How strongly a grouped product relates to the shopper's watchlist. */
export type DiscoveryRelevance = {
  score: number;
  /** 2 = brand, keyword or tracked-product match; 1 = category; 0 = no watchlist signal. */
  tier: 0 | 1 | 2;
  /** Short, honest explanation such as `Because you track running shoes`. */
  reason?: string;
};

/**
 * The same product observed at one or more retailers. Created locally from
 * retailer listings; there is no cross-retailer product identifier, so grouping
 * stays conservative (brand plus a matching product signature).
 */
export type DiscoveryProductGroup = {
  /** Stable local key derived from brand and product signature. */
  id: string;
  title: string;
  brand: string;
  category: DiscoveryCategory;
  categories: DiscoveryCategory[];
  imageUrl?: string;
  currency: string;
  /** One offer per retailer, lowest comparable price first. */
  offers: DiscoveryOffer[];
  /**
   * Lowest usable offer. Only set when at least two offers are comparable, so
   * the UI never claims a "best source" from unrelated prices.
   */
  bestOffer?: DiscoveryOffer;
  comparableOfferCount: number;
  /** Saving between the lowest and highest comparable offer, in minor units. */
  priceSpreadMinor?: number;
  /**
   * Lowest comparable price from the previous observation set, only when every
   * compared offer had a previous observation (so the comparison is fair).
   */
  previousBestPriceMinor?: number;
  observedAt: string;
  /** Matched active watchlist product, when matched conservatively. */
  trackedProduct?: TrackedProduct;
  relevance?: DiscoveryRelevance;
};

export type DiscoveryFilter = {
  collectionId?: string;
  category?: DiscoveryCategory;
  siteKey?: SiteKey;
  brand?: string;
  maximumPriceMinor?: number;
};

export type SupportedSite = {
  key: SiteKey;
  displayName: string;
  shortName: string;
  hostnames: string[];
  status: 'supported' | 'experimental';
  /** False when tracking is available but no verified discovery source exists yet. */
  discoveryAvailable?: boolean;
  notes: string;
  /** Minimum hours that must elapse between checks for this site.
   *  When set, overrides shorter user check preferences. */
  minimumIntervalHours?: number;
  /** Local favicon asset for displaying a mini site icon in the UI. */
  iconAsset?: ReturnType<typeof require>;
};

export type VariantAttribute = {
  name: string;
  value: string;
};

export type ProductVariant = {
  priceBasis?: import('./priceBasis').PriceBasis;
  /** Stable source identifier, normally a SKU or source variation ID. */
  id: string;
  /** Human-readable combination as the source describes it. */
  label: string;
  attributes: VariantAttribute[];
  /** Source URL that preselects this exact configuration, when the store provides one. */
  url?: string;
  priceMinor?: number;
  currency?: string;
  availability: Availability;
  sku?: string;
  imageUrl?: string;
};

export type VariantSelection = Pick<ProductVariant, 'id' | 'label' | 'attributes' | 'url'>;

export type ParsedProduct = {
  sourceMetadata?: import('./productMetadata').ProductMetadata;
  priceBasis?: import('./priceBasis').PriceBasis;
  siteKey: SiteKey;
  canonicalUrl: string;
  title: string;
  imageUrl?: string;
  priceMinor?: number;
  currency?: string;
  availability: Availability;
  rawPriceText?: string;
  sku?: string;
  /** Variants proven by the initial product-page response, when available. */
  variants?: ProductVariant[];
  /** Exact variant resolved for a saved tracker. */
  selectedVariant?: VariantSelection;
};

export type TrackedProduct = {
  sourceMetadata?: import('./productMetadata').ProductMetadata;
  /** Brand supplied by the listing when the tracker was created. */
  brand?: string;
  /** Shopper-selected or source-provided category for discovery. */
  category?: import('./discoveryCategories').ShoppingCategory;
  /** True when the shopper explicitly chose no category. */
  categoryExcluded?: boolean;
  priceBasis?: import('./priceBasis').PriceBasis;
  id: number;
  url: string;
  canonicalUrl: string;
  siteKey: SiteKey;
  title: string;
  imageUrl?: string;
  currency: string;
  currentPriceMinor?: number;
  /** Previous price from the check before the most recent one. Used to compute price direction on cards. */
  previousPriceMinor?: number;
  /** Price before the most recent actual price change; preserved across later unchanged checks. */
  lastPriceChangeMinor?: number;
  /** When the most recent actual price change was detected. */
  lastPriceChangeAt?: string;
  targetPriceMinor?: number;
  /** Minimum AED amount a price must drop before a price-drop alert is sent. */
  minimumPriceDropMinor?: number;
  /** Defaults to true for existing trackers. */
  restockAlertEnabled?: boolean;
  /** Optional local-only grouping for the watchlist. */
  folder?: string;
  /** Archived products stay local but are hidden from the active watchlist and checks. */
  isArchived?: boolean;
  alertMode: AlertMode;
  checkPreference: CheckPreference;
  isActive: boolean;
  lastCheckedAt?: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastErrorCode?: CheckStatus;
  /** Availability from the most recent successful check. Used to show OOS state on cards. */
  lastAvailability?: Availability;
  /** Immutable source-provided choice for a variant-specific tracker. */
  variant?: VariantSelection;
  createdAt: string;
  updatedAt: string;
};

export type PriceSnapshot = {
  priceBasis?: import('./priceBasis').PriceBasis;
  id: number;
  trackedProductId: number;
  priceMinor?: number;
  currency?: string;
  availability: Availability;
  status: CheckStatus;
  errorCode?: CheckStatus;
  rawPriceText?: string;
  source: SnapshotSource;
  checkedAt: string;
};

export type ProductWithSnapshots = {
  product: TrackedProduct;
  snapshots: PriceSnapshot[];
};

export type ProductDraft = {
  brand?: string;
  category?: import('./discoveryCategories').ShoppingCategory;
  categoryExcluded?: boolean;
  parsed: ParsedProduct;
  sourceUrl: string;
  checkPreference: CheckPreference;
  alertMode: AlertMode;
  targetPriceMinor?: number;
  minimumPriceDropMinor?: number;
  restockAlertEnabled?: boolean;
  folder?: string;
  variant?: VariantSelection;
};

export type PriceDirection = 'up' | 'down' | 'first';

export type ActivityEvent = {
  priceBasis?: import('./priceBasis').PriceBasis;
  id: number;
  trackedProductId: number;
  productTitle: string;
  productImageUrl?: string;
  previousPriceMinor?: number;
  newPriceMinor: number;
  currency: string;
  priceDirection: PriceDirection;
  source: SnapshotSource;
  checkedAt: string;
  /** When set, this event represents an availability change rather than a price change. */
  availability?: Availability;
};
