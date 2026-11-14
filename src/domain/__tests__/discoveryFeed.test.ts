import { filterTrackedFeedGroups, trackedFeedSaving } from '../discoveryFeed';
import type { DiscoveryOffer, DiscoveryProduct, DiscoveryProductGroup, SiteKey, TrackedProduct } from '../types';

const OBSERVED_AT = '2026-11-14T08:00:00.000Z';
const PEGASUS = 'Nike Air Zoom Pegasus 41 Running Shoes';
const PEGASUS_GROUP_ID = 'group:nike:shoes:41-air-pegasus-running-shoes-zoom';

function listing(
  siteKey: SiteKey,
  priceMinor: number | undefined,
  overrides: Partial<DiscoveryProduct> = {}
): DiscoveryProduct {
  const site = siteKey.replace(/_/g, '');
  return {
    id: `${siteKey}-pegasus-41`,
    siteKey,
    category: 'fashion',
    brand: 'Nike',
    title: PEGASUS,
    url: `https://www.${site}.com/products/pegasus-41`,
    currency: 'AED',
    availability: 'in_stock',
    observedAt: OBSERVED_AT,
    priceMinor,
    ...overrides
  };
}

function offer(
  siteKey: SiteKey,
  priceMinor: number | undefined,
  overrides: Partial<DiscoveryProduct> = {}
): DiscoveryOffer {
  return { product: listing(siteKey, priceMinor, overrides), order: 0, comparable: true };
}

function tracked(overrides: Partial<TrackedProduct> = {}): TrackedProduct {
  return {
    id: 1,
    url: 'https://www.noon.com/uae-en/nike-pegasus-41/P123',
    canonicalUrl: 'https://www.noon.com/uae-en/nike-pegasus-41/P123',
    siteKey: 'noon',
    title: PEGASUS,
    currency: 'AED',
    currentPriceMinor: 41900,
    alertMode: 'price_drop',
    checkPreference: 'daily',
    isActive: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-11-14T00:00:00.000Z',
    ...overrides
  };
}

function group(overrides: Partial<DiscoveryProductGroup> = {}): DiscoveryProductGroup {
  return {
    id: PEGASUS_GROUP_ID,
    title: PEGASUS,
    brand: 'Nike',
    category: 'fashion',
    categories: ['fashion'],
    currency: 'AED',
    offers: [offer('noon', 41900), offer('amazon_ae', 39900)],
    comparableOfferCount: 2,
    observedAt: OBSERVED_AT,
    trackedProduct: tracked(),
    ...overrides
  };
}

describe('watchlist copies in the Explore feed', () => {
  it('keeps groups that are not watchlist copies untouched', () => {
    const first = group({ id: 'first', trackedProduct: undefined });
    const second = group({ id: 'second', trackedProduct: undefined });

    expect(trackedFeedSaving(first)).toBeUndefined();
    const filtered = filterTrackedFeedGroups([first, second]);
    expect(filtered).toHaveLength(2);
    expect(filtered[0]).toBe(first);
    expect(filtered[1]).toBe(second);
  });

  it('drops a tracked group when the only offer is the tracked store itself', () => {
    // The tracked store's own discovery price is below the tracked price, but a
    // watchlist copy is still not an Explore discovery.
    const trackedOnly = group({ offers: [offer('noon', 39900)], comparableOfferCount: 1 });

    expect(trackedFeedSaving(trackedOnly)).toBeUndefined();
    expect(filterTrackedFeedGroups([trackedOnly])).toEqual([]);
  });

  it('keeps a tracked group when another retailer is genuinely cheaper', () => {
    const cheaper = group({
      offers: [offer('noon', 41900), offer('amazon_ae', 39900), offer('sun_sand_sports', 37900)]
    });

    expect(trackedFeedSaving(cheaper)).toEqual({
      savingMinor: 4000,
      siteKey: 'sun_sand_sports',
      priceMinor: 37900
    });
    const filtered = filterTrackedFeedGroups([cheaper]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toBe(cheaper);
  });

  it('drops a tracked group when no other retailer beats the tracked price', () => {
    const equalPrice = group({ offers: [offer('noon', 41900), offer('amazon_ae', 41900)] });
    const higherPrice = group({ offers: [offer('noon', 41900), offer('amazon_ae', 42900)] });
    // A cheaper offer that cannot be bought does not prove a saving.
    const outOfStock = group({
      offers: [offer('noon', 41900), offer('amazon_ae', 36900, { availability: 'out_of_stock' })]
    });

    expect(trackedFeedSaving(equalPrice)).toBeUndefined();
    expect(trackedFeedSaving(higherPrice)).toBeUndefined();
    expect(trackedFeedSaving(outOfStock)).toBeUndefined();
    expect(filterTrackedFeedGroups([equalPrice, higherPrice, outOfStock])).toEqual([]);
  });

  it('rejects a cheaper offer that is only a variant price range', () => {
    const pricedRange = group({
      offers: [offer('noon', 41900), offer('amazon_ae', 33900, { hasPriceRange: true })]
    });

    expect(trackedFeedSaving(pricedRange)).toBeUndefined();
    expect(filterTrackedFeedGroups([pricedRange])).toEqual([]);
  });

  it('drops a tracked group whose tracked price is unknown', () => {
    const unknownPrice = group({ trackedProduct: tracked({ currentPriceMinor: undefined }) });

    expect(trackedFeedSaving(unknownPrice)).toBeUndefined();
    expect(filterTrackedFeedGroups([unknownPrice])).toEqual([]);
  });

  it('only accepts cheaper offers on a compatible pack or weight basis', () => {
    const milkTracked = tracked({
      title: 'Almarai Full Fat Milk 1 L',
      currentPriceMinor: 1050,
      priceBasis: 'pack:1x1000ml'
    });
    const milkGroup = (cheaperOffer: DiscoveryOffer): DiscoveryProductGroup =>
      group({
        title: 'Almarai Full Fat Milk 1 L',
        brand: 'Almarai',
        category: 'groceries',
        trackedProduct: milkTracked,
        offers: [
          offer('noon', 1050, {
            brand: 'Almarai',
            title: 'Almarai Full Fat Milk 1 L',
            category: 'groceries',
            priceBasis: 'pack:1x1000ml'
          }),
          cheaperOffer
        ]
      });

    // The competitor's missing basis is inferred from its title and matches.
    const compatible = milkGroup(
      offer('carrefour_uae', 900, {
        brand: 'Almarai',
        title: 'Almarai Full Fat Milk 1000 ml',
        category: 'groceries'
      })
    );
    expect(trackedFeedSaving(compatible)).toEqual({
      savingMinor: 150,
      siteKey: 'carrefour_uae',
      priceMinor: 900
    });

    const incompatible = milkGroup(
      offer('carrefour_uae', 550, {
        brand: 'Almarai',
        title: 'Almarai Full Fat Milk 500 ml',
        category: 'groceries'
      })
    );
    expect(trackedFeedSaving(incompatible)).toBeUndefined();
    expect(filterTrackedFeedGroups([incompatible])).toEqual([]);
  });

  it('rejects a cheaper offer in another currency and defaults a missing tracked currency to AED', () => {
    const foreignCurrency = group({
      offers: [offer('noon', 41900), offer('amazon_ae', 35900, { currency: 'USD' })]
    });
    expect(trackedFeedSaving(foreignCurrency)).toBeUndefined();

    // Legacy trackers saved without a currency are compared in AED.
    const legacyCurrency = group({
      trackedProduct: tracked({ currency: '' }),
      offers: [offer('noon', 41900), offer('amazon_ae', 39900)]
    });
    expect(trackedFeedSaving(legacyCurrency)).toEqual({
      savingMinor: 2000,
      siteKey: 'amazon_ae',
      priceMinor: 39900
    });
    expect(filterTrackedFeedGroups([foreignCurrency])).toEqual([]);
  });

  it('preserves order without mutating the input and tolerates malformed data', () => {
    const first = group({ id: 'first', trackedProduct: undefined });
    const cheaperTracked = group({ id: 'second' });
    const third = group({ id: 'third', trackedProduct: undefined });
    const groups = [first, cheaperTracked, third];
    const snapshot = JSON.stringify(groups);

    const filtered = filterTrackedFeedGroups(groups);
    expect(filtered.map((entry) => entry.id)).toEqual(['first', 'second', 'third']);
    expect(filtered[0]).toBe(first);
    expect(filtered[1]).toBe(cheaperTracked);
    expect(filtered[2]).toBe(third);
    expect(groups).toHaveLength(3);
    expect(JSON.stringify(groups)).toBe(snapshot);

    const malformedGroup = {
      ...group(),
      offers: [null, { product: null }, { product: { siteKey: 42, priceMinor: 100 } }]
    } as unknown as DiscoveryProductGroup;
    expect(trackedFeedSaving({} as DiscoveryProductGroup)).toBeUndefined();
    expect(trackedFeedSaving({ trackedProduct: {}, offers: 'nope' } as unknown as DiscoveryProductGroup)).toBeUndefined();
    expect(trackedFeedSaving(malformedGroup)).toBeUndefined();
    expect(filterTrackedFeedGroups(undefined as unknown as DiscoveryProductGroup[])).toEqual([]);
    expect(filterTrackedFeedGroups([null as unknown as DiscoveryProductGroup])).toEqual([]);
  });
});
