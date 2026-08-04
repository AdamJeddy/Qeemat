export type SiteKey = 'noon' | 'nike_uae' | 'sun_sand_sports' | 'level_shoes' | 'ay_accessories' | 'ounass' | 'amazon_ae' | 'adidas' | 'puma_uae' | 'decathlon_uae' | 'sephora_uae' | 'faces_uae' | 'namshi' | 'sharaf_dg' | 'brands_for_less';

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

export type SupportedSite = {
  key: SiteKey;
  displayName: string;
  shortName: string;
  hostnames: string[];
  status: 'supported' | 'experimental';
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
  targetPriceMinor?: number;
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
  parsed: ParsedProduct;
  sourceUrl: string;
  checkPreference: CheckPreference;
  alertMode: AlertMode;
  targetPriceMinor?: number;
  variant?: VariantSelection;
};

export type PriceDirection = 'up' | 'down' | 'first';

export type ActivityEvent = {
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
