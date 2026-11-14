/**
 * Conservative cross-retailer grouping for locally discovered retailer listings.
 *
 * Retailers do not share product identifiers, so the same product can only be
 * recognised from the listing itself: the brand must be compatible, the
 * canonical product type identical, the numeric/model/pack tokens exactly
 * equal and the remaining signature strongly similar. A listing is only added
 * to an existing group when it matches EVERY member already in it (a clique),
 * so a chain of look-alike titles can never merge two different models.
 *
 * Prices are compared only when they are genuinely comparable: a single price,
 * in stock, same currency and the same pack/weight basis. A group with fewer
 * than two comparable offers never claims a "lowest" offer. Nothing in the
 * input is mutated.
 */

import type { PriceBasis } from './priceBasis';
import {
  normalizeBrandKey,
  normalizeProductTokens,
  productHardTokens,
  productSignatureTokens,
  productTypeKey,
  productVariantHardTokens
} from './productTokens';
import { cleanUrl } from './sites';
import type {
  DiscoveryCategory,
  DiscoveryOffer,
  DiscoveryProduct,
  DiscoveryProductGroup,
  TrackedProduct
} from './types';

type GroupingOptions = {
  trackedProducts?: TrackedProduct[];
};

type ListingIdentity = {
  brandKey?: string;
  /** Distinctive tokens, de-duplicated and sorted. */
  signature: string[];
  signatureSet: Set<string>;
  typeKey: string;
  /** Numeric model/pack tokens, sorted. */
  hard: string[];
  /** Capacity/pack tokens such as 128gb or 3x500ml, which must match exactly. */
  variant: string[];
  /** Pure-number model tokens such as 16 or 2. */
  numericModel: string[];
  /** Alphanumeric model codes such as 1000xm5 or h2. */
  codeModel: string[];
  /** First normalized title words, used to infer a missing brand conservatively. */
  leading: string[];
};

type Listing = {
  product: DiscoveryProduct;
  /** Original position in the source list, used for stable tie-breaks. */
  order: number;
  identity: ListingIdentity;
};

type GroupState = {
  listings: Listing[];
};

/** How the group's priced offers agree on a comparison basis. */
type ComparableBasis = {
  basis?: PriceBasis;
  /** True when priced offers disagree, in which case nothing is comparable. */
  conflict: boolean;
};

const UNKNOWN_BUCKET = '\u0000unknown';
const UNKNOWN_GROUP_BRAND = 'unknown';
const CANONICAL_TYPE_TOKEN = 'other';
/** An accessory title mentioning a brand is not that brand's product. */
const ACCESSORY_TOKENS = new Set([
  'case', 'cases', 'cover', 'covers', 'protector', 'protectors', 'charger', 'chargers', 'cable', 'cables',
  'strap', 'straps', 'band', 'bands', 'lens', 'lenses', 'sleeve', 'sleeves', 'skin', 'skins', 'tip', 'tips',
  'replacement', 'insoles', 'insole', 'laces', 'lace', 'charms', 'charm', 'cleaner', 'cleaners', 'adapters',
  'adapter', 'stand', 'stands', 'holder', 'holders', 'mount', 'mounts', 'clip', 'clips', 'spare', 'parts',
  'accessory', 'accessories', 'compatible', 'compatibility'
]);

export function groupDiscoveryProducts(
  products: DiscoveryProduct[],
  options?: GroupingOptions
): DiscoveryProductGroup[] {
  const listings = deduplicateListings(Array.isArray(products) ? products : []).map((entry) => ({
    ...entry,
    identity: buildListingIdentity(entry.product)
  }));
  if (listings.length === 0) {
    return [];
  }
  return bucketListings(listings).map((group) => buildGroup(group, options?.trackedProducts));
}

/* -------------------------------------------------------------------------- */
/* Deduplication                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Collapses repeated observations of the same retailer listing (same site and
 * cleaned URL, or same asset id) before any identity work. The newest
 * observation supplies the descriptive fields and observedAt; categories and
 * collections are merged and the lowest observed price wins when copies
 * disagree.
 */
function deduplicateListings(products: DiscoveryProduct[]): { product: DiscoveryProduct; order: number }[] {
  const candidates: { product: DiscoveryProduct; order: number }[] = [];
  for (let order = 0; order < products.length; order++) {
    const product = products[order];
    if (isUsableProduct(product)) {
      candidates.push({ product, order });
    }
  }
  if (candidates.length < 2) {
    return candidates;
  }

  // Union-find over listing copies so a repeated URL, a repeated id and a
  // duplicate published under both keys all collapse into one listing.
  const parent = candidates.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) {
      root = parent[root];
    }
    while (parent[index] !== root) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const union = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      parent[Math.max(leftRoot, rightRoot)] = Math.min(leftRoot, rightRoot);
    }
  };

  const byId = new Map<string, number>();
  const byUrl = new Map<string, number>();
  candidates.forEach(({ product }, index) => {
    const siteKey = typeof product.siteKey === 'string' ? product.siteKey : '';
    if (!siteKey) {
      return;
    }
    const id = typeof product.id === 'string' ? product.id.trim() : '';
    if (id) {
      const key = `${siteKey}\u0000${id}`;
      const existing = byId.get(key);
      if (existing === undefined) {
        byId.set(key, index);
      } else {
        union(existing, index);
      }
    }
    const url = typeof product.url === 'string' ? cleanUrl(product.url).replace(/\/+$/, '') : '';
    if (url) {
      const key = `${siteKey}\u0000${url}`;
      const existing = byUrl.get(key);
      if (existing === undefined) {
        byUrl.set(key, index);
      } else {
        union(existing, index);
      }
    }
  });

  const grouped = new Map<number, { product: DiscoveryProduct; order: number }[]>();
  candidates.forEach((candidate, index) => {
    const root = find(index);
    const members = grouped.get(root);
    if (members) {
      members.push(candidate);
    } else {
      grouped.set(root, [candidate]);
    }
  });

  const deduplicated: { product: DiscoveryProduct; order: number }[] = [];
  grouped.forEach((members) => {
    let product = members[0].product;
    for (let index = 1; index < members.length; index++) {
      product = mergeDuplicateProducts(product, members[index].product);
    }
    deduplicated.push({ product, order: members[0].order });
  });
  return deduplicated;
}

function mergeDuplicateProducts(first: DiscoveryProduct, second: DiscoveryProduct): DiscoveryProduct {
  const newest = observedTimestamp(second.observedAt) > observedTimestamp(first.observedAt) ? second : first;
  const merged: DiscoveryProduct = {
    ...newest,
    id: first.id,
    category: first.category,
    categories: uniqueCategories([...readCategories(first), ...readCategories(second)]),
    observedAt: newest.observedAt,
    hasPriceRange: first.hasPriceRange === true || second.hasPriceRange === true ? true : newest.hasPriceRange,
    imageUrl: newest.imageUrl ?? first.imageUrl ?? second.imageUrl,
    priceBasis: newest.priceBasis ?? first.priceBasis ?? second.priceBasis,
    previousPriceMinor: newest.previousPriceMinor ?? first.previousPriceMinor ?? second.previousPriceMinor,
    previousObservedAt: newest.previousObservedAt ?? first.previousObservedAt ?? second.previousObservedAt
  };
  const collectionIds = uniqueStrings([...(first.collectionIds ?? []), ...(second.collectionIds ?? [])]);
  if (collectionIds.length > 0) {
    merged.collectionIds = collectionIds;
  }
  const priceMinor = lowerDefinedNumber(first.priceMinor, second.priceMinor);
  if (priceMinor !== undefined) {
    merged.priceMinor = priceMinor;
  }
  return merged;
}

function isUsableProduct(product: DiscoveryProduct): boolean {
  return Boolean(product) &&
    typeof product === 'object' &&
    typeof product.title === 'string' &&
    typeof product.siteKey === 'string';
}

/* -------------------------------------------------------------------------- */
/* Identity and conservative matching                                         */
/* -------------------------------------------------------------------------- */

function buildIdentity(title: string, brand?: string): ListingIdentity {
  const brandKey = normalizeBrandKey(brand);
  const signature = productSignatureTokens(title, brand);
  const ordered = normalizeProductTokens(title);
  // "2 Years" / "5.3 Bluetooth" are specification copy, not model numbers.
  const ignoredSpecs = new Set<string>();
  for (let index = 0; index < ordered.length - 1; index++) {
    if (/^\d+(?:\.\d+)?$/.test(ordered[index]) && /^years?$/.test(ordered[index + 1])) {
      ignoredSpecs.add(ordered[index]);
    }
  }
  const hard = productHardTokens(signature)
    .filter((token) => !ignoredSpecs.has(token) && !/^\d+\.\d+$/.test(token));
  const variant = productVariantHardTokens(signature).filter((token) => !ignoredSpecs.has(token));
  const variantSet = new Set(variant);
  return {
    brandKey,
    signature,
    signatureSet: new Set(signature),
    typeKey: productTypeKey(signature),
    hard,
    variant,
    numericModel: hard.filter((token) => /^\d+$/.test(token) && !variantSet.has(token)),
    codeModel: hard.filter((token) => /[a-z]/.test(token) && !variantSet.has(token)),
    leading: ordered.slice(0, 3)
  };
}

function buildListingIdentity(product: DiscoveryProduct): ListingIdentity {
  const brand = typeof product.brand === 'string' ? product.brand : undefined;
  const title = typeof product.title === 'string' ? product.title : '';
  return buildIdentity(title, brand);
}

/**
 * Candidates are bucketed by primary brand token so that a prefixed brand
 * (`adidas` / `adidas originals`) can still be compared. An unknown brand is
 * also indexed under the title words that lead it, so a retailer search card
 * that omits the brand can still meet the brand-named listing; the full
 * compatibility rules below stay authoritative.
 */
function bucketListings(listings: Listing[]): GroupState[] {
  const groups: GroupState[] = [];
  const buckets = new Map<string, GroupState[]>();
  for (const listing of listings) {
    const keys = candidateBucketKeys(listing.identity);
    const seen = new Set<GroupState>();
    const candidates: GroupState[] = [];
    for (const key of keys) {
      for (const group of buckets.get(key) ?? []) {
        if (!seen.has(group)) {
          seen.add(group);
          candidates.push(group);
        }
      }
    }
    const target = candidates.find((candidate) =>
      candidate.listings.every((member) => identitiesMatch(member.identity, listing.identity))
    );
    if (target) {
      target.listings.push(listing);
      for (const key of keys) {
        const bucket = buckets.get(key) ?? [];
        if (!bucket.includes(target)) { bucket.push(target); buckets.set(key, bucket); }
      }
    } else {
      const group: GroupState = { listings: [listing] };
      groups.push(group);
      for (const key of keys) {
        const bucket = buckets.get(key) ?? [];
        bucket.push(group);
        buckets.set(key, bucket);
      }
    }
  }
  return groups;
}

function candidateBucketKeys(identity: ListingIdentity): string[] {
  if (identity.brandKey) {
    return [identity.brandKey.split(' ')[0]];
  }
  // Unknown brand: also try the leading title words as potential brand tokens.
  return [...new Set([UNKNOWN_BUCKET, ...identity.leading.slice(0, 2)])];
}

/**
 * The single conservative match rule shared by grouping and watchlist
 * matching: compatible brand, compatible model/pack identity, enough shared
 * signature tokens and strong similarity. A title with no product-type word
 * (for example a marketing-style "AirPods Pro 2nd Generation" heading) can
 * match a typed listing when brand, model number and at least three tokens
 * agree. A retailer-appended model code ("WH1000XM5B165935990") still matches
 * the shorter model token when one contains the other.
 */
function identitiesMatch(left: ListingIdentity, right: ListingIdentity): boolean {
  if (!brandKeysCompatible(left.brandKey, right.brandKey) && !inferredBrandCompatible(left, right)) {
    return false;
  }
  // Unknown brands carry no identity of their own, so only identical
  // signatures can be treated as the same listing.
  if (left.brandKey === undefined && right.brandKey === undefined && !sameTokens(left.signature, right.signature)) {
    return false;
  }
  const oneSideUntyped = left.typeKey === CANONICAL_TYPE_TOKEN || right.typeKey === CANONICAL_TYPE_TOKEN;
  if (!oneSideUntyped && left.typeKey !== right.typeKey) {
    return false;
  }
  const bothUntyped = left.typeKey === CANONICAL_TYPE_TOKEN && right.typeKey === CANONICAL_TYPE_TOKEN;
  // Different capacities or pack sizes are different products.
  if (!sameTokens(left.variant, right.variant)) {
    return false;
  }
  const modelMatch = strongestModelMatch(left, right);
  if (!modelMatch.matched) {
    return false;
  }
  const shared = sharedTokenCount(left, right);
  const minimumSize = Math.min(left.signature.length, right.signature.length);
  const unionSize = left.signature.length + right.signature.length - shared;
  if (minimumSize === 0) {
    return false;
  }
  if (modelMatch.strong) {
    // A long model code embedded in one title (retailer SKU suffix) plus the
    // same brand is already distinctive; require the product words to overlap.
    return shared >= 2 && sharesNonTypeToken(left, right);
  }
  if (bothUntyped) {
    // Neither title names a product type, so brand + model + title overlap
    // carry the match. Marketing copy makes the overlap noisier, hence the
    // slightly lower ratio threshold than the typed path.
    return shared >= 3 && sharesNonTypeToken(left, right) &&
      (shared / minimumSize >= 0.6 || shared / unionSize >= 0.5);
  }
  const minimumShared = left.numericModel.length + left.codeModel.length > 0 ? 2 : 3;
  if (shared < minimumShared) {
    return false;
  }
  if (oneSideUntyped) {
    // The typed side names the product; the untyped side is marketing copy.
    // Require the model number and its neighbours to agree instead of a high
    // whole-title overlap, which marketing words would always defeat.
    const hasSharedModelToken = [...left.numericModel, ...left.codeModel]
      .some((token) => right.signatureSet.has(token));
    return shared >= 3 && hasSharedModelToken && sharesNonTypeToken(left, right);
  }
  if (shared >= 4 && sharesNonTypeToken(left, right)) {
    // Same brand, same product type and the same model numbers are strong
    // evidence even when one retailer's marketing title is much longer.
    return true;
  }
  if (shared / minimumSize < 0.8 && shared / unionSize < 0.7) {
    return false;
  }
  // A type token alone is not enough evidence of the same product.
  return shared >= 4 || sharesNonTypeToken(left, right);
}

/**
 * Model compatibility: pure-number model tokens must be identical (2 ≠ 3,
 * 16 ≠ 15), capacity tokens are checked separately. Alphanumeric codes match
 * exactly or by containment, which tolerates a retailer-appended SKU suffix.
 * Extra code/specification tokens in one title do not block the match.
 */
function strongestModelMatch(left: ListingIdentity, right: ListingIdentity): { matched: boolean; strong: boolean } {
  if (!left.numericModel.length && !right.numericModel.length && !left.codeModel.length && !right.codeModel.length) {
    return { matched: true, strong: false };
  }
  if (left.numericModel.length || right.numericModel.length) {
    if (!sameTokens(left.numericModel, right.numericModel)) {
      return { matched: false, strong: false };
    }
  }
  let exactCode = false;
  let strong = false;
  for (const leftToken of left.codeModel) {
    for (const rightToken of right.codeModel) {
      if (leftToken === rightToken) {
        exactCode = true;
        continue;
      }
      const longer = leftToken.length >= rightToken.length ? leftToken : rightToken;
      const shorter = leftToken.length >= rightToken.length ? rightToken : leftToken;
      if (shorter.length >= 5 && /\d/.test(shorter) && longer.includes(shorter)) {
        strong = true;
      }
    }
  }
  if (left.numericModel.length) {
    return { matched: true, strong };
  }
  if (!left.codeModel.length || !right.codeModel.length) {
    return { matched: false, strong: false };
  }
  return { matched: exactCode || strong, strong };
}

function brandKeysCompatible(left?: string, right?: string): boolean {
  if (left === undefined || right === undefined) {
    return left === undefined && right === undefined;
  }
  return left === right || left.startsWith(`${right} `) || right.startsWith(`${left} `);
}

/**
 * Some retailer search cards omit the brand field even though the title starts
 * with it ("Apple AirPods Pro 3..."). Only infer the brand when it leads the
 * title; "Case for Apple AirPods" must not become an Apple product.
 */
function inferredBrandCompatible(left: ListingIdentity, right: ListingIdentity): boolean {
  if (left.brandKey && !right.brandKey && !hasAccessoryToken(right)) {
    return brandNameLeadsTitle(left.brandKey, right.leading);
  }
  if (right.brandKey && !left.brandKey && !hasAccessoryToken(left)) {
    return brandNameLeadsTitle(right.brandKey, left.leading);
  }
  return false;
}

function hasAccessoryToken(identity: ListingIdentity): boolean {
  for (const token of identity.signatureSet) {
    if (ACCESSORY_TOKENS.has(token)) { return true; }
  }
  return false;
}

function brandNameLeadsTitle(brandKey: string, leading: string[]): boolean {
  const tokens = brandKey.split(' ').filter((token) => token.length >= 3);
  return tokens.length > 0 && tokens.every((token) => leading.includes(token));
}

function sameTokens(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((token, index) => token === right[index]);
}

function sharedTokenCount(left: ListingIdentity, right: ListingIdentity): number {
  let shared = 0;
  for (const token of left.signatureSet) {
    if (right.signatureSet.has(token)) {
      shared += 1;
    }
  }
  return shared;
}

function sharesNonTypeToken(left: ListingIdentity, right: ListingIdentity): boolean {
  return left.signature.some((token) => right.signatureSet.has(token) && !isCanonicalTypeToken(token));
}

function isCanonicalTypeToken(token: string): boolean {
  return productTypeKey([token]) !== CANONICAL_TYPE_TOKEN;
}

/* -------------------------------------------------------------------------- */
/* Group construction                                                         */
/* -------------------------------------------------------------------------- */

function buildGroup(state: GroupState, trackedProducts?: TrackedProduct[]): DiscoveryProductGroup {
  const listings = [...state.listings].sort((left, right) => left.order - right.order);
  const representative = representativeListing(listings);
  const basis = comparableBasis(listings);
  const offers = selectOffers(listings, basis);
  offers.sort(compareOffers);

  const firstOffer = offers.reduce((earliest, offer) => (offer.order < earliest.order ? offer : earliest), offers[0]);
  const comparableOffers = offers.filter((offer) => offer.comparable);
  const bestOffer = comparableOffers.length >= 2 ? lowestComparableOffer(comparableOffers) : undefined;
  if (comparableOffers.length === 0) {
    for (const offer of offers) {
      offer.priceDeltaMinor = undefined;
    }
  } else {
    const lowestComparablePrice = Math.min(...comparableOffers.map((offer) => offer.product.priceMinor ?? Number.POSITIVE_INFINITY));
    for (const offer of offers) {
      offer.priceDeltaMinor = offer.comparable && typeof offer.product.priceMinor === 'number'
        ? offer.product.priceMinor - lowestComparablePrice
        : undefined;
    }
  }

  let priceSpreadMinor: number | undefined;
  if (bestOffer && typeof bestOffer.product.priceMinor === 'number') {
    const highestComparablePrice = comparableOffers.reduce(
      (highest, offer) => Math.max(highest, offer.product.priceMinor ?? highest),
      bestOffer.product.priceMinor
    );
    priceSpreadMinor = highestComparablePrice - bestOffer.product.priceMinor;
  }

  let previousBestPriceMinor: number | undefined;
  if (bestOffer) {
    const previousPrices = comparableOffers.map((offer) => offer.product.previousPriceMinor);
    if (previousPrices.every((price): price is number => typeof price === 'number' && Number.isFinite(price))) {
      previousBestPriceMinor = Math.min(...previousPrices);
    }
  }

  const offersInInputOrder = [...offers].sort((left, right) => left.order - right.order);
  const titleSource = bestOffer ?? firstOffer;
  const trackedProduct = trackedProducts ? matchTrackedProduct(offers, trackedProducts) : undefined;
  return {
    id: buildGroupId(representative),
    title: titleSource.product.title,
    brand: firstOffer.product.brand,
    category: firstOffer.product.category,
    categories: uniqueCategories(offersInInputOrder.flatMap((offer) => readCategories(offer.product))),
    imageUrl: titleSource.product.imageUrl,
    currency: firstOffer.product.currency,
    offers,
    ...(bestOffer ? { bestOffer } : {}),
    comparableOfferCount: comparableOffers.length,
    ...(priceSpreadMinor !== undefined ? { priceSpreadMinor } : {}),
    ...(previousBestPriceMinor !== undefined ? { previousBestPriceMinor } : {}),
    observedAt: latestObservedAt(offers),
    ...(trackedProduct ? { trackedProduct } : {})
  };
}

/**
 * One offer per retailer. The retailer's listing with a comparable price is
 * preferred, then the in-stock listing, then the lowest price, then the first
 * observed listing (stable).
 */
function selectOffers(listings: Listing[], basis: ComparableBasis): DiscoveryOffer[] {
  const preliminaryCurrency = listings[0].product.currency;
  const byRetailer = new Map<string, Listing[]>();
  for (const listing of listings) {
    const siteKey = typeof listing.product.siteKey === 'string' ? listing.product.siteKey : '';
    const existing = byRetailer.get(siteKey);
    if (existing) {
      existing.push(listing);
    } else {
      byRetailer.set(siteKey, [listing]);
    }
  }

  const selected: Listing[] = [];
  for (const retailerListings of byRetailer.values()) {
    retailerListings.sort((left, right) => compareRetailerListings(left, right, basis, preliminaryCurrency));
    selected.push(retailerListings[0]);
  }
  selected.sort((left, right) => left.order - right.order);

  // The group currency always comes from the first offer in input order.
  const currency = selected[0].product.currency;
  return selected.map((listing) => ({
    product: listing.product,
    order: listing.order,
    comparable: isComparableOffer(listing.product, currency, basis)
  }));
}

function compareRetailerListings(
  left: Listing,
  right: Listing,
  basis: ComparableBasis,
  currency: string
): number {
  const comparableDifference =
    Number(isComparableOffer(right.product, currency, basis)) - Number(isComparableOffer(left.product, currency, basis));
  if (comparableDifference !== 0) {
    return comparableDifference;
  }
  const availabilityDifference =
    availabilityOrder(left.product.availability) - availabilityOrder(right.product.availability);
  if (availabilityDifference !== 0) {
    return availabilityDifference;
  }
  const priceDifference = priceOrder(left.product.priceMinor) - priceOrder(right.product.priceMinor);
  if (priceDifference !== 0) {
    return priceDifference;
  }
  return left.order - right.order;
}

function compareOffers(left: DiscoveryOffer, right: DiscoveryOffer): number {
  if (left.comparable !== right.comparable) {
    return left.comparable ? -1 : 1;
  }
  const availabilityDifference =
    availabilityOrder(left.product.availability) - availabilityOrder(right.product.availability);
  if (availabilityDifference !== 0) {
    return availabilityDifference;
  }
  const priceDifference = priceOrder(left.product.priceMinor) - priceOrder(right.product.priceMinor);
  if (priceDifference !== 0) {
    return priceDifference;
  }
  return left.order - right.order;
}

function lowestComparableOffer(offers: DiscoveryOffer[]): DiscoveryOffer {
  return offers.reduce((lowest, offer) => {
    const priceDifference = priceOrder(offer.product.priceMinor) - priceOrder(lowest.product.priceMinor);
    if (priceDifference !== 0) {
      return priceDifference < 0 ? offer : lowest;
    }
    const availabilityDifference =
      availabilityOrder(offer.product.availability) - availabilityOrder(lowest.product.availability);
    if (availabilityDifference !== 0) {
      return availabilityDifference < 0 ? offer : lowest;
    }
    return offer.order < lowest.order ? offer : lowest;
  });
}

function comparableBasis(listings: Listing[]): ComparableBasis {
  const bases = new Set<PriceBasis | undefined>();
  for (const listing of listings) {
    const price = listing.product.priceMinor;
    if (typeof price !== 'number' || !Number.isFinite(price)) {
      continue;
    }
    bases.add(listing.product.priceBasis);
  }
  if (bases.size > 1) {
    return { conflict: true };
  }
  return { basis: bases.values().next().value, conflict: false };
}

/** A price can be compared only when it is a single, purchasable, same-basis price. */
function isComparableOffer(product: DiscoveryProduct, currency: string, basis: ComparableBasis): boolean {
  if (basis.conflict) {
    return false;
  }
  const price = product.priceMinor;
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    return false;
  }
  if (product.hasPriceRange === true || product.availability === 'out_of_stock') {
    return false;
  }
  if (product.currency !== currency) {
    return false;
  }
  return product.priceBasis === basis.basis;
}

/**
 * The member used to derive the group id. Choosing it canonically (rather than
 * by source order) keeps the id stable when retailers are refreshed in a
 * different order.
 */
function representativeListing(listings: Listing[]): Listing {
  return listings.reduce((best, listing) =>
    representativeKey(listing) < representativeKey(best) ? listing : best
  );
}

function representativeKey(listing: Listing): string {
  const { brandKey, signature, typeKey } = listing.identity;
  const siteKey = typeof listing.product.siteKey === 'string' ? listing.product.siteKey : '';
  const id = typeof listing.product.id === 'string' ? listing.product.id : '';
  return `${brandKey ?? ''}\u0000${typeKey}\u0000${signature.join('-')}\u0000${siteKey}\u0000${id}`;
}

function buildGroupId(listing: Listing): string {  const { brandKey, signature, typeKey } = listing.identity;
  if (signature.length === 0) {
    // Without a signature the listing's own stable identity is the only stable
    // group key. Unknown-brand listings use the documented fallback shape;
    // known brands fall back to the same shape with the brand kept.
    const fallback = listingIdentityFallback(listing);
    if (brandKey === undefined) {
      return `group:${UNKNOWN_GROUP_BRAND}:${listing.product.siteKey}:${fallback}`;
    }
    return `group:${brandKey}:${typeKey}:${listing.product.siteKey}:${fallback}`;
  }
  return `group:${brandKey ?? UNKNOWN_GROUP_BRAND}:${typeKey}:${signature.join('-')}`;
}

function listingIdentityFallback(listing: Listing): string {
  const id = typeof listing.product.id === 'string' ? listing.product.id.trim() : '';
  if (id) {
    return id;
  }
  return typeof listing.product.url === 'string' ? listing.product.url : '';
}

function latestObservedAt(offers: DiscoveryOffer[]): string {
  let latest = '';
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const offer of offers) {
    const value = typeof offer.product.observedAt === 'string' ? offer.product.observedAt : '';
    const time = observedTimestamp(value);
    if (time > latestTime) {
      latest = value;
      latestTime = time;
    }
  }
  return latest;
}

/* -------------------------------------------------------------------------- */
/* Watchlist matching                                                         */
/* -------------------------------------------------------------------------- */

function matchTrackedProduct(
  offers: DiscoveryOffer[],
  trackedProducts: TrackedProduct[]
): TrackedProduct | undefined {
  const active = trackedProducts.filter((product) => product && product.isActive !== false && product.isArchived !== true);
  if (active.length === 0) {
    return undefined;
  }

  const offerUrlKeys = new Set<string>();
  for (const offer of offers) {
    const key = trackedUrlKey(offer.product.url);
    if (key) {
      offerUrlKeys.add(key);
    }
  }
  if (offerUrlKeys.size > 0) {
    const urlMatch = active.find((tracked) => {
      const key = trackedUrlKey(tracked.canonicalUrl || tracked.url);
      return Boolean(key) && offerUrlKeys.has(key);
    });
    if (urlMatch) {
      return urlMatch;
    }
  }

  const offerIdentities = offers
    .map((offer) => ({ order: offer.order, identity: buildListingIdentity(offer.product) }))
    .sort((left, right) => left.order - right.order);
  for (const tracked of active) {
    const brand = typeof tracked.brand === 'string' ? tracked.brand : undefined;
    const brandKey = normalizeBrandKey(brand);
    // "Other brands" carries no brand identity, so it can never be a proof of
    // a match on its own.
    if (!brandKey) {
      continue;
    }
    const title = typeof tracked.title === 'string' ? tracked.title : '';
    const identity = buildIdentity(title, brand);
    const match = offerIdentities.find((offer) =>
      offer.identity.brandKey === brandKey &&
      offer.identity.typeKey === identity.typeKey &&
      identitiesMatch(identity, offer.identity)
    );
    if (match) {
      return tracked;
    }
  }
  return undefined;
}

function trackedUrlKey(value: string | undefined): string {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }
  return cleanUrl(value).replace(/\/+$/, '');
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

function observedTimestamp(value: string | undefined): number {
  const timestamp = Date.parse(value ?? '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function priceOrder(price: number | undefined): number {
  return typeof price === 'number' && Number.isFinite(price) ? price : Number.POSITIVE_INFINITY;
}

function availabilityOrder(availability: DiscoveryProduct['availability']): number {
  if (availability === 'in_stock') {
    return 0;
  }
  if (availability === 'out_of_stock') {
    return 2;
  }
  return 1;
}

function lowerDefinedNumber(left?: number, right?: number): number | undefined {
  const leftValid = typeof left === 'number' && Number.isFinite(left);
  const rightValid = typeof right === 'number' && Number.isFinite(right);
  if (leftValid && rightValid) {
    return Math.min(left, right);
  }
  if (leftValid) {
    return left;
  }
  return rightValid ? right : undefined;
}

function readCategories(product: DiscoveryProduct): DiscoveryCategory[] {
  const categories: DiscoveryCategory[] = [];
  if (typeof product.category === 'string') {
    categories.push(product.category);
  }
  if (Array.isArray(product.categories)) {
    categories.push(...product.categories);
  }
  return categories.filter((category): category is DiscoveryCategory => typeof category === 'string');
}

function uniqueCategories(categories: DiscoveryCategory[]): DiscoveryCategory[] {
  const seen = new Set<DiscoveryCategory>();
  const unique: DiscoveryCategory[] = [];
  for (const category of categories) {
    if (typeof category === 'string' && !seen.has(category)) {
      seen.add(category);
      unique.push(category);
    }
  }
  return unique;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (typeof value === 'string' && !seen.has(value)) {
      seen.add(value);
      unique.push(value);
    }
  }
  return unique;
}
