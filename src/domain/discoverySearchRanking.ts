/**
 * Multi-source-aware ordering for grouped product search results.
 *
 * Search shows one grouped item per product, so an item that several UAE
 * retailers actually carry is usually more useful than a single-retailer
 * listing. Availability must not, however, let a weaker textual match leapfrog
 * a stronger one: groups are first bucketed by how well the title matches the
 * query phrase (exact/prefix, contains it, or neither) and only then nudged
 * inside their bucket by a bounded amount derived from the number of distinct
 * retailers and comparable offers. The boost is capped so a strong multi-store
 * result can climb, but only by roughly one screenful and never across a
 * match-grade boundary. Ordering is deterministic (stable by
 * incoming position, which is the existing match rank) and the input array and
 * its groups are never mutated.
 */

import { normalizeProductTokens } from './productTokens';
import type { DiscoveryOffer, DiscoveryProductGroup } from './types';

/** Positions gained per extra retailer beyond the first. */
const BOOST_PER_EXTRA_RETAILER = 12;
/** Two comparable prices confirm the multi-store item is genuinely shoppable. */
const COMPARABLE_OFFER_BONUS = 6;
/** A result may climb at most this many positions; roughly one screenful. */
const MAX_BOOST = 24;

/** 2 = title equals or starts with the query phrase; 1 = contains it; 0 = neither. */
const GRADE_PREFIX = 2;
const GRADE_CONTAINS = 1;
const GRADE_NONE = 0;

/**
 * Compatible accessories (cases, tips, insoles) can match the same words as
 * the product itself. Their extra retailer availability must not push them
 * above the actual item, so the multi-store boost is skipped for them unless
 * the shopper explicitly searched for the accessory.
 */
const ACCESSORY_TOKENS = new Set([
  'case', 'cases', 'cover', 'covers', 'protector', 'protectors', 'charger', 'chargers', 'cable', 'cables',
  'strap', 'straps', 'band', 'bands', 'lens', 'lenses', 'sleeve', 'sleeves', 'skin', 'skins', 'tip', 'tips',
  'replacement', 'insoles', 'insole', 'laces', 'lace', 'charms', 'charm', 'cleaner', 'cleaners', 'adapter',
  'adapters', 'stand', 'stands', 'holder', 'holders', 'mount', 'mounts', 'clip', 'clips', 'spare', 'parts',
  'accessory', 'accessories', 'compatible', 'compatibility'
]);

type RankedGroup = {
  group: DiscoveryProductGroup;
  /** Original position in the incoming match order, used as the final tie-break. */
  index: number;
  grade: number;
  /** Compatibility accessory for a product query; sorted after the products. */
  isAccessory: boolean;
  /** `index - boundedBoost`; lower sorts first inside a grade. */
  adjustedPosition: number;
};

/**
 * Re-orders grouped search results, given the already-matched groups in match
 * order, so multi-retailer products move up within their textual match grade.
 * A blank query (or no groups) keeps the incoming order unchanged.
 */
export function rankSearchGroups(groups: DiscoveryProductGroup[], query: string): DiscoveryProductGroup[] {
  const input = Array.isArray(groups) ? groups : [];
  const phrase = normalizeProductTokens(query);
  if (phrase.length === 0 || input.length === 0) {
    return input.slice();
  }

  const queryTokens = phrase;
  const queryMentionsAccessory = queryTokens.some((token) => ACCESSORY_TOKENS.has(token));
  const ranked: RankedGroup[] = input.map((group, index) => {
    const offers = Array.isArray(group.offers) ? group.offers : [];
    const titleTokens = normalizeProductTokens(group.title);
    const titleIsAccessory = !queryMentionsAccessory && titleTokens.some((token) => ACCESSORY_TOKENS.has(token));
    const retailerCount = distinctRetailerCount(offers);
    const comparableCount = countComparableOffers(offers);
    const boundedBoost = titleIsAccessory
      ? 0
      : Math.min(
        MAX_BOOST,
        Math.max(0, retailerCount - 1) * BOOST_PER_EXTRA_RETAILER + (comparableCount >= 2 ? COMPARABLE_OFFER_BONUS : 0)
      );
    return {
      group,
      index,
      grade: matchGrade(titleTokens, phrase),
      isAccessory: titleIsAccessory,
      adjustedPosition: index - boundedBoost
    };
  });

  ranked.sort(
    (left, right) =>
      Number(left.isAccessory) - Number(right.isAccessory) ||
      right.grade - left.grade ||
      left.adjustedPosition - right.adjustedPosition ||
      left.index - right.index
  );
  return ranked.map((entry) => entry.group);
}

/**
 * Grades a normalized title against the normalized query phrase. Whole tokens
 * are compared, so `iphone 16` is not a textual hit inside `iphone 160` and
 * model numbers keep their boundaries.
 */
function matchGrade(titleTokens: string[], phrase: string[]): number {
  if (titleTokens.length === 0 || phrase.length === 0) {
    return GRADE_NONE;
  }
  if (startsWithPhrase(titleTokens, phrase)) {
    return GRADE_PREFIX;
  }
  return containsPhrase(titleTokens, phrase) ? GRADE_CONTAINS : GRADE_NONE;
}

function startsWithPhrase(tokens: string[], phrase: string[]): boolean {
  if (tokens.length < phrase.length) {
    return false;
  }
  return phrase.every((token, index) => tokens[index] === token);
}

/** True when the phrase appears as one contiguous run of whole tokens. */
function containsPhrase(tokens: string[], phrase: string[]): boolean {
  const lastStart = tokens.length - phrase.length;
  for (let start = 0; start <= lastStart; start++) {
    if (phrase.every((token, offset) => tokens[start + offset] === token)) {
      return true;
    }
  }
  return false;
}

function distinctRetailerCount(offers: DiscoveryOffer[]): number {
  const siteKeys = new Set<string>();
  for (const offer of offers) {
    siteKeys.add(offer.product.siteKey);
  }
  return siteKeys.size;
}

function countComparableOffers(offers: DiscoveryOffer[]): number {
  let count = 0;
  for (const offer of offers) {
    if (offer.comparable) {
      count += 1;
    }
  }
  return count;
}
