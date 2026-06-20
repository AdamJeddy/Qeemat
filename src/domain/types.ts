export type SiteKey = 'noon' | 'nike_uae' | 'sun_sand_sports' | 'level_shoes' | 'amazon_ae';

export type Availability = 'in_stock' | 'out_of_stock' | 'unknown';

export type CheckPreference = 'daily' | 'every_3_days' | 'weekly';

export type AlertMode = 'price_drop' | 'any_change' | 'target_price';

export type CheckStatus =
  | 'invalid_url'
  | 'ok'
  | 'price_changed'
  | 'price_not_found'
  | 'network_error'
  | 'unsupported_page'
  | 'blocked'
  | 'site_parser_failed';

export type SupportedSite = {
  key: SiteKey;
  displayName: string;
  shortName: string;
  hostnames: string[];
  status: 'supported' | 'experimental';
  notes: string;
};

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
  targetPriceMinor?: number;
  alertMode: AlertMode;
  checkPreference: CheckPreference;
  isActive: boolean;
  lastCheckedAt?: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastErrorCode?: CheckStatus;
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
};
