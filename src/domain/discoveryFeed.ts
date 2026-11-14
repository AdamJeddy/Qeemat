/**
 * Watchlist copies are not discoveries.
 *
 * Grouping links a discovery group to an active watchlist product when the
 * same item is already tracked. That link is useful context, but rendering
 * every matched group in Explore would turn the feed into a copy of the
 * watchlist. A matched group earns its place only when a *different* retailer
 * genuinely beats the tracked price: a single price, in stock, in the same
 * currency and on the same pack/weight basis. When that holds, the cheapest
 * such offer is reported so the card can label the saving honestly.
 *
 * Nothing in the input is mutated, and malformed cached groups resolve to "no
 * saving" instead of throwing: the feed can always fall back to hiding the
 * possibly-duplicate group.
 */

import type { PriceBasis } from './priceBasis';
import { pricesShareBasis } from './priceBasis';
import type { DiscoveryProductGroup, SiteKey } from './types';

export type TrackedFeedSaving = {
  savingMinor: number;
  siteKey: SiteKey;
  priceMinor: number;
};

type PriceIdentity = {
  title: string;
  priceBasis?: PriceBasis;
};

/** Tracked products saved before currencies were captured are AED, like the rest of the app. */
const DEFAULT_CURRENCY = 'AED';

/**
 * The cheapest comparable offer from a retailer other than the tracked one,
 * when it is strictly cheaper than the tracked price. Returns `undefined` when
 * the group is not a watchlist copy or no genuine saving can be proven.
 */
export function trackedFeedSaving(group: DiscoveryProductGroup): TrackedFeedSaving | undefined {
  if (!isRecord(group)) {
    return undefined;
  }
  const tracked: unknown = group.trackedProduct;
  if (!isRecord(tracked)) {
    return undefined;
  }
  const trackedSiteKey = readSiteKey(tracked.siteKey);
  const trackedPriceMinor = readPrice(tracked.currentPriceMinor);
  if (!trackedSiteKey || trackedPriceMinor === undefined) {
    return undefined;
  }
  const trackedIdentity = readPriceIdentity(tracked);
  const currency = readCurrency(tracked.currency) ?? DEFAULT_CURRENCY;

  const offers: unknown = group.offers;
  if (!Array.isArray(offers)) {
    return undefined;
  }

  let cheapest: { siteKey: SiteKey; priceMinor: number } | undefined;
  for (const offer of offers) {
    const product = readOfferProduct(offer);
    if (!product) {
      continue;
    }
    const siteKey = readSiteKey(product.siteKey);
    // The tracked store is the reference price, not a competing offer.
    if (!siteKey || siteKey === trackedSiteKey) {
      continue;
    }
    const priceMinor = comparableAlternativePrice(product, currency, trackedIdentity);
    if (priceMinor === undefined) {
      continue;
    }
    if (!cheapest || priceMinor < cheapest.priceMinor) {
      cheapest = { siteKey, priceMinor };
    }
  }

  if (!cheapest || cheapest.priceMinor >= trackedPriceMinor) {
    return undefined;
  }
  return {
    savingMinor: trackedPriceMinor - cheapest.priceMinor,
    siteKey: cheapest.siteKey,
    priceMinor: cheapest.priceMinor
  };
}

/**
 * Keeps every group that is not a watchlist copy, and a watchlist copy only
 * when another retailer is cheaper. Input order is preserved and the returned
 * array holds the original group objects.
 */
export function filterTrackedFeedGroups(groups: DiscoveryProductGroup[]): DiscoveryProductGroup[] {
  if (!Array.isArray(groups)) {
    return [];
  }
  const filtered: DiscoveryProductGroup[] = [];
  for (const group of groups) {
    if (!isRecord(group)) {
      continue;
    }
    const tracked: unknown = group.trackedProduct;
    const isTracked = tracked !== undefined && tracked !== null;
    if (!isTracked || trackedFeedSaving(group) !== undefined) {
      filtered.push(group);
    }
  }
  return filtered;
}

/**
 * An alternative is usable only when it is purchasable, priced in the same
 * currency and comparable on the same pack or weight basis as the tracker.
 */
function comparableAlternativePrice(
  product: Record<string, unknown>,
  currency: string,
  trackedIdentity: PriceIdentity
): number | undefined {
  if (product.availability === 'out_of_stock') {
    return undefined;
  }
  // "From AED X" listings may start at a variant/size the tracker does not have.
  if (product.hasPriceRange === true) {
    return undefined;
  }
  const priceMinor = readPrice(product.priceMinor);
  if (priceMinor === undefined || readCurrency(product.currency) !== currency) {
    return undefined;
  }
  return pricesShareBasis(trackedIdentity, readPriceIdentity(product)) ? priceMinor : undefined;
}

function readOfferProduct(offer: unknown): Record<string, unknown> | undefined {
  if (!isRecord(offer)) {
    return undefined;
  }
  const product: unknown = offer.product;
  return isRecord(product) ? product : undefined;
}

function readPriceIdentity(value: unknown): PriceIdentity {
  if (!isRecord(value)) {
    return { title: '' };
  }
  return {
    title: typeof value.title === 'string' ? value.title : '',
    priceBasis: readPriceBasis(value.priceBasis)
  };
}

function readPriceBasis(value: unknown): PriceBasis | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  return value === 'kg' || value.startsWith('pack:') ? (value as PriceBasis) : undefined;
}

function readSiteKey(value: unknown): SiteKey | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const siteKey = value.trim();
  return siteKey ? (siteKey as SiteKey) : undefined;
}

function readCurrency(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const currency = value.trim();
  return currency ? currency : undefined;
}

/** A price is usable only when it is a real, non-negative amount in minor units. */
function readPrice(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
