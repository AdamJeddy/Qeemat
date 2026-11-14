/**
 * Watchlist-derived relevance for grouped discovery products.
 *
 * The watchlist is the only honest personalisation signal the app has: no
 * account, no server, no cross-device history. This module summarizes the
 * active watchlist into a small taste profile (categories, brands, title
 * keywords and price bands) and scores retailer groups against it. Scores are
 * only used for local ordering; every nonzero score must come from a match that
 * is visible to the shopper, so each relevance carries a short explanation.
 */

import type { ShoppingCategory } from './discoveryCategories';
import { DISCOVERY_CATEGORY_LABELS, normalizeDiscoveryCategories } from './discoveryCategories';
import { normalizeBrandKey, relevanceKeywords } from './productTokens';
import { getSiteByKey } from './sites';
import type { DiscoveryProductGroup, DiscoveryRelevance, TrackedProduct } from './types';
import { inferWatchlistCategory } from './watchlistDiscovery';

/** 12 discoveries are the first screenful; diversity caps apply only inside it. */
const FIRST_WINDOW_SIZE = 12;
const MAX_GROUPS_PER_BRAND_IN_WINDOW = 2;
const MAX_GROUPS_PER_CATEGORY_IN_WINDOW = 6;
const MAX_KEYWORDS = 60;
const MAX_SCORE = 400;

const TRACKED_MATCH_SCORE = 220;
const BRAND_MATCH_SCORE = 120;
const BRAND_OCCURRENCE_SCORE = 10;
const BRAND_OCCURRENCE_CAP = 30;
const KEYWORD_MATCH_CAP = 90;
const WEAK_KEYWORD_MATCH_CAP = 20;
const CATEGORY_MATCH_SCORE = 40;
const CATEGORY_OCCURRENCE_SCORE = 10;
const CATEGORY_OCCURRENCE_CAP = 30;
const CATEGORY_COMPONENT_CAP = 80;
const PRICE_BAND_SCORE = 25;

const SHORT_TITLE_LENGTH = 40;
const ELLIPSIS = '…';

type PriceBand = { lowMinor: number; medianMinor: number; highMinor: number };

export type DiscoveryTasteProfile = {
  categoryCounts: Partial<Record<import('./discoveryCategories').ShoppingCategory, number>>;
  brands: { key: string; label: string; count: number }[];
  keywords: Record<string, number>;
  priceBands: Partial<Record<import('./discoveryCategories').ShoppingCategory, { lowMinor: number; medianMinor: number; highMinor: number }>>;
  trackedProducts: TrackedProduct[];
};

function isActiveWatchlistProduct(product: TrackedProduct): boolean {
  return product.isActive !== false && product.isArchived !== true;
}

function resolvedBrand(product: TrackedProduct): string | undefined {
  return product.brand ?? product.sourceMetadata?.brand;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function shortenTitle(title: string, limit = SHORT_TITLE_LENGTH): string {
  const normalized = title.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  const clipped = normalized.slice(0, limit);
  const boundary = clipped.lastIndexOf(' ');
  const base = (boundary > 0 ? clipped.slice(0, boundary) : clipped).replace(/[\s,;:./-]+$/, '');
  return `${base}${ELLIPSIS}`;
}

/** `adidas` and `adidas originals` describe the same brand family; unrelated tokens do not. */
function brandKeysMatch(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }
  const leftTokens = left.split(' ');
  const rightTokens = right.split(' ');
  const shorter = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longer = leftTokens.length <= rightTokens.length ? rightTokens : leftTokens;
  return shorter.every((token, index) => longer[index] === token);
}

function withCategoryReason(category: ShoppingCategory | undefined): string | undefined {
  return category ? `Because you track ${DISCOVERY_CATEGORY_LABELS[category]}` : undefined;
}

/**
 * Builds the only personalisation input for discovery: a compact profile of
 * what the shopper already tracks. Archived and paused trackers are ignored so
 * the feed never explains itself with products the shopper has moved on from.
 */
export function buildDiscoveryTasteProfile(tracked: TrackedProduct[]): DiscoveryTasteProfile {
  const trackedProducts = tracked.filter(isActiveWatchlistProduct);
  const categoryCounts: Partial<Record<ShoppingCategory, number>> = {};
  const brandCounts = new Map<string, { key: string; label: string; count: number }>();
  const keywordCounts = new Map<string, number>();
  const pricesByCategory = new Map<ShoppingCategory, number[]>();

  for (const product of trackedProducts) {
    const category = inferWatchlistCategory(product);
    if (category) {
      categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    }

    const brand = resolvedBrand(product);
    const brandKey = normalizeBrandKey(brand);
    if (brandKey) {
      const existing = brandCounts.get(brandKey);
      if (existing) {
        existing.count += 1;
      } else {
        brandCounts.set(brandKey, { key: brandKey, label: (brand ?? '').trim() || brandKey, count: 1 });
      }
    }

    for (const keyword of relevanceKeywords(product.title, brand)) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
    }

    if (category && typeof product.currentPriceMinor === 'number' && Number.isFinite(product.currentPriceMinor)) {
      const prices = pricesByCategory.get(category) ?? [];
      prices.push(product.currentPriceMinor);
      pricesByCategory.set(category, prices);
    }
  }

  const keywords: Record<string, number> = Object.fromEntries(
    [...keywordCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, MAX_KEYWORDS)
  );
  const brands = [...brandCounts.values()].sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
  const priceBands: Partial<Record<ShoppingCategory, PriceBand>> = {};
  for (const [category, prices] of pricesByCategory) {
    const middle = median(prices);
    priceBands[category] = {
      lowMinor: Math.round(middle * 0.5),
      medianMinor: Math.round(middle),
      highMinor: Math.round(middle * 1.8)
    };
  }

  return { categoryCounts, brands, keywords, priceBands, trackedProducts };
}

/** True as soon as the profile can honestly support at least one explanation. */
export function hasDiscoveryTasteProfile(profile: DiscoveryTasteProfile): boolean {
  return Object.keys(profile.categoryCounts).length > 0 ||
    profile.brands.length > 0 ||
    Object.keys(profile.keywords).length > 0 ||
    Object.keys(profile.priceBands).length > 0;
}

/** The tracked product whose title shares the most matched keywords, for a specific reason. */
function keywordExplanation(profile: DiscoveryTasteProfile, matchedKeywords: string[]): string | undefined {
  const wanted = new Set(matchedKeywords);
  let best: { shared: number; title: string } | undefined;
  for (const product of profile.trackedProducts) {
    const shared = relevanceKeywords(product.title, resolvedBrand(product)).filter((keyword) => wanted.has(keyword)).length;
    if (shared > 0 && (!best || shared > best.shared)) {
      best = { shared, title: product.title };
    }
  }
  if (best) {
    return `Because you track ${shortenTitle(best.title)}`;
  }
  const fallback = [...matchedKeywords].sort((left, right) => (profile.keywords[right] ?? 0) - (profile.keywords[left] ?? 0) || left.localeCompare(right))[0];
  return fallback ? `Because you track ${fallback}` : undefined;
}

function normalizedGroupCategories(group: DiscoveryProductGroup): ShoppingCategory[] {
  return normalizeDiscoveryCategories([group.category, ...group.categories]);
}

/**
 * Scores one grouped product against the watchlist profile. The returned
 * reason is chosen from the strongest real match (tracked product, then brand,
 * then specific keywords, then price band, then broad category); a group with
 * no signal gets `{ score: 0, tier: 0 }` and no explanation.
 */
export function scoreDiscoveryGroup(group: DiscoveryProductGroup, profile: DiscoveryTasteProfile): DiscoveryRelevance {
  let score = 0;
  let tier: DiscoveryRelevance['tier'] = 0;

  // The group is already linked to a tracked product by conservative matching.
  let trackedReason: string | undefined;
  if (group.trackedProduct) {
    score += TRACKED_MATCH_SCORE;
    tier = 2;
    trackedReason = `You track this at ${getSiteByKey(group.trackedProduct.siteKey).shortName}`;
  }

  const groupBrandKey = normalizeBrandKey(group.brand);
  let brandReason: string | undefined;
  if (groupBrandKey) {
    const brandMatch = profile.brands.find((brand) => brandKeysMatch(brand.key, groupBrandKey));
    if (brandMatch) {
      score += BRAND_MATCH_SCORE + Math.min(BRAND_OCCURRENCE_CAP, brandMatch.count * BRAND_OCCURRENCE_SCORE);
      tier = 2;
      brandReason = `More from ${brandMatch.label}`;
    }
  }

  const groupKeywords = relevanceKeywords(group.title, group.brand);
  const matchedKeywords = groupKeywords.filter((keyword) => Object.prototype.hasOwnProperty.call(profile.keywords, keyword));
  let keywordReason: string | undefined;
  if (matchedKeywords.length) {
    const totalWeight = matchedKeywords.reduce((total, keyword) => total + (profile.keywords[keyword] ?? 0), 0);
    if (matchedKeywords.length >= 2 || totalWeight >= 2) {
      score += Math.min(KEYWORD_MATCH_CAP, totalWeight);
      tier = 2;
      keywordReason = keywordExplanation(profile, matchedKeywords);
    } else {
      // A single incidental word is not enough to claim a tier; it only nudges the order.
      score += Math.min(WEAK_KEYWORD_MATCH_CAP, totalWeight);
    }
  }

  const categories = normalizedGroupCategories(group);
  let categoryScore = 0;
  let bestCategory: ShoppingCategory | undefined;
  let bestCategoryCount = -1;
  for (const category of categories) {
    const count = profile.categoryCounts[category];
    if (!count) {
      continue;
    }
    categoryScore += CATEGORY_MATCH_SCORE + Math.min(CATEGORY_OCCURRENCE_CAP, count * CATEGORY_OCCURRENCE_SCORE);
    if (count > bestCategoryCount) {
      bestCategoryCount = count;
      bestCategory = category;
    }
  }
  if (categoryScore > 0) {
    score += Math.min(CATEGORY_COMPONENT_CAP, categoryScore);
    if (tier === 0) {
      tier = 1;
    }
  }

  const displayPriceMinor = group.bestOffer?.product.priceMinor ?? group.offers[0]?.product.priceMinor;
  let priceReason: string | undefined;
  if (typeof displayPriceMinor === 'number') {
    for (const category of categories) {
      const band = profile.priceBands[category];
      if (band && displayPriceMinor >= band.lowMinor && displayPriceMinor <= band.highMinor) {
        score += PRICE_BAND_SCORE;
        priceReason = 'In your usual price range';
        break;
      }
    }
  }

  // Price band is a more specific explanation than a broad category, so it wins that tie.
  const reason = trackedReason ?? brandReason ?? keywordReason ?? priceReason ?? withCategoryReason(bestCategory);
  return { score: Math.min(MAX_SCORE, score), tier, ...(reason ? { reason } : {}) };
}

function primaryCategory(group: DiscoveryProductGroup): ShoppingCategory | undefined {
  return normalizeDiscoveryCategories([group.category, ...group.categories])[0];
}

/**
 * Scores and orders discovery groups for the feed. Ordering is deterministic
 * (score, then original position) and the first screenful is diversified by
 * brand and category; deferred groups keep their sorted order after it.
 */
export function rankDiscoveryGroups(groups: DiscoveryProductGroup[], profile: DiscoveryTasteProfile): DiscoveryProductGroup[] {
  if (!hasDiscoveryTasteProfile(profile)) {
    return groups.map((group): DiscoveryProductGroup => ({ ...group, relevance: { score: 0, tier: 0 } }));
  }

  const scored: { group: DiscoveryProductGroup; relevance: DiscoveryRelevance; index: number }[] = groups.map((group, index) => {
    const relevance = scoreDiscoveryGroup(group, profile);
    return { relevance, index, group: { ...group, relevance } };
  });
  scored.sort((left, right) => right.relevance.score - left.relevance.score || left.index - right.index);

  const window: typeof scored = [];
  const deferred: typeof scored = [];
  const remaining: typeof scored = [];
  const brandCounts = new Map<string, number>();
  const categoryCounts = new Map<ShoppingCategory, number>();

  for (const entry of scored) {
    if (window.length >= FIRST_WINDOW_SIZE) {
      remaining.push(entry);
      continue;
    }
    const brandKey = normalizeBrandKey(entry.group.brand);
    const category = primaryCategory(entry.group);
    const brandFull = brandKey !== undefined && (brandCounts.get(brandKey) ?? 0) >= MAX_GROUPS_PER_BRAND_IN_WINDOW;
    const categoryFull = category !== undefined && (categoryCounts.get(category) ?? 0) >= MAX_GROUPS_PER_CATEGORY_IN_WINDOW;
    if (brandFull || categoryFull) {
      deferred.push(entry);
      continue;
    }
    window.push(entry);
    if (brandKey !== undefined) {
      brandCounts.set(brandKey, (brandCounts.get(brandKey) ?? 0) + 1);
    }
    if (category !== undefined) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }

  return [...window, ...deferred, ...remaining].map((entry) => entry.group);
}

/** Up to two category labels for the caller's "Based on your watchlist · …" line. */
export function discoveryTasteSummary(profile: DiscoveryTasteProfile): string[] {
  const categories = (Object.entries(profile.categoryCounts) as [ShoppingCategory, number | undefined][])
    .filter((entry): entry is [ShoppingCategory, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .sort((left, right) => right[1] - left[1] ||
      DISCOVERY_CATEGORY_LABELS[left[0]].localeCompare(DISCOVERY_CATEGORY_LABELS[right[0]]));
  return categories.slice(0, 2).map(([category]) => DISCOVERY_CATEGORY_LABELS[category]);
}
