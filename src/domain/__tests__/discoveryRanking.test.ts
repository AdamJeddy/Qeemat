import type { DiscoveryTasteProfile } from '../discoveryRanking';
import {
  buildDiscoveryTasteProfile,
  discoveryTasteSummary,
  hasDiscoveryTasteProfile,
  rankDiscoveryGroups,
  scoreDiscoveryGroup
} from '../discoveryRanking';
import type { DiscoveryCategory, DiscoveryOffer, DiscoveryProductGroup, SiteKey, TrackedProduct } from '../types';

const OBSERVED_AT = '2026-11-10T08:00:00.000Z';

function trackedProduct(id: number, title: string, overrides: Partial<TrackedProduct> = {}): TrackedProduct {
  return {
    id,
    url: `https://www.noon.com/uae-en/product-${id}`,
    canonicalUrl: `https://www.noon.com/uae-en/product-${id}`,
    siteKey: 'noon',
    title,
    currency: 'AED',
    alertMode: 'price_drop',
    checkPreference: 'daily',
    isActive: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides
  };
}

function offer(siteKey: SiteKey, priceMinor: number | undefined, order = 0): DiscoveryOffer {
  return {
    comparable: false,
    order,
    product: {
      id: `${siteKey}:offer-${order}`,
      siteKey,
      category: 'footwear' as DiscoveryCategory,
      brand: 'Fixture brand',
      title: 'Fixture offer',
      url: `https://example.com/${siteKey}/${order}`,
      currency: 'AED',
      availability: 'in_stock' as const,
      observedAt: OBSERVED_AT,
      ...(priceMinor === undefined ? {} : { priceMinor })
    }
  };
}

function discoveryGroup(id: string, overrides: Partial<DiscoveryProductGroup> = {}): DiscoveryProductGroup {
  return {
    id,
    title: 'Nike Air Zoom Pegasus 41 Running Shoes',
    brand: 'Nike',
    category: 'footwear',
    categories: ['footwear'],
    currency: 'AED',
    offers: [offer('noon', 20000)],
    comparableOfferCount: 1,
    observedAt: OBSERVED_AT,
    ...overrides
  };
}

const nikeRunningTracked = trackedProduct(1, 'Nike Air Zoom Pegasus 41 Running Shoes', {
  brand: 'Nike',
  category: 'footwear',
  currentPriceMinor: 20000
});

describe('buildDiscoveryTasteProfile', () => {
  it('summarizes active watchlist categories, brands, keywords and price bands', () => {
    const profile = buildDiscoveryTasteProfile([
      trackedProduct(1, 'Nike Air Zoom Pegasus 41 Running Shoes', { brand: 'Nike', category: 'footwear', currentPriceMinor: 20000 }),
      trackedProduct(2, 'Nike Air Force 1 07 Shoes', { brand: 'Nike', category: 'footwear', currentPriceMinor: 30000 }),
      trackedProduct(3, 'Adidas Ultraboost Running Shoes', { sourceMetadata: { brand: 'Adidas' }, currentPriceMinor: 15000 }),
      trackedProduct(4, 'Mystery Sneakers', { brand: 'Other brands', category: 'footwear', currentPriceMinor: 25000 }),
      trackedProduct(5, 'Sony WH-1000XM5 Headphones', { brand: 'Sony', category: 'audio', currentPriceMinor: 90000 }),
      trackedProduct(6, 'Sony WF-1000XM5 Earbuds', { brand: 'Sony', category: 'audio', currentPriceMinor: 40000, isActive: false }),
      trackedProduct(7, 'Dyson V15 Vacuum Cleaner', { brand: 'Dyson', category: 'appliances', currentPriceMinor: 250000, isArchived: true })
    ]);

    expect(profile.trackedProducts.map((product) => product.id)).toEqual([1, 2, 3, 4, 5]);
    expect(profile.categoryCounts).toEqual({ footwear: 4, audio: 1 });
    // Unknown brands such as "Other brands" never become a brand signal.
    expect(profile.brands).toEqual([
      { key: 'nike', label: 'Nike', count: 2 },
      { key: 'adidas', label: 'Adidas', count: 1 },
      { key: 'sony', label: 'Sony', count: 1 }
    ]);
    expect(profile.keywords.shoes).toBe(4);
    expect(profile.keywords.running).toBe(2);
    expect(profile.keywords.sony).toBeUndefined();
    expect(profile.priceBands).toEqual({
      footwear: { lowMinor: 11250, medianMinor: 22500, highMinor: 40500 },
      audio: { lowMinor: 45000, medianMinor: 90000, highMinor: 162000 }
    });
  });
});

describe('hasDiscoveryTasteProfile', () => {
  it('is false for an empty profile and true once the watchlist provides a signal', () => {
    const empty: DiscoveryTasteProfile = {
      categoryCounts: {},
      brands: [],
      keywords: {},
      priceBands: {},
      trackedProducts: []
    };

    expect(hasDiscoveryTasteProfile(empty)).toBe(false);
    // Keeping trackers for explanations is not itself a personalisation signal.
    expect(hasDiscoveryTasteProfile({ ...empty, trackedProducts: [trackedProduct(9, 'Shoes')] })).toBe(false);
    expect(hasDiscoveryTasteProfile(buildDiscoveryTasteProfile([nikeRunningTracked]))).toBe(true);
  });
});

describe('scoreDiscoveryGroup', () => {
  it('explains an exact tracked-product match with the store it is tracked at', () => {
    const profile = buildDiscoveryTasteProfile([nikeRunningTracked]);
    const relevance = scoreDiscoveryGroup(discoveryGroup('tracked', { trackedProduct: nikeRunningTracked }), profile);

    expect(relevance.tier).toBe(2);
    expect(relevance.reason).toBe('You track this at Noon');
    // Even with every signal present the score is capped instead of inflated.
    expect(relevance.score).toBe(400);
  });

  it('matches a watched brand, including a compatible brand extension', () => {
    const profile = buildDiscoveryTasteProfile([
      nikeRunningTracked,
      trackedProduct(2, 'Adidas Ultraboost Running Shoes', { brand: 'Adidas', category: 'footwear', currentPriceMinor: 60000 })
    ]);

    const direct = scoreDiscoveryGroup(
      discoveryGroup('direct', { brand: 'Nike', title: 'Nike Court Legacy Sneakers' }),
      profile
    );
    expect(direct.tier).toBe(2);
    expect(direct.reason).toBe('More from Nike');

    const extension = scoreDiscoveryGroup(
      discoveryGroup('extension', { brand: 'Adidas Originals', title: 'Adidas Originals Samba OG', offers: [offer('adidas', 50000)] }),
      profile
    );
    expect(extension.tier).toBe(2);
    expect(extension.reason).toBe('More from Adidas');
  });

  it('explains a keyword-heavy match with the most similar tracked product title', () => {
    const profile = buildDiscoveryTasteProfile([
      trackedProduct(1, 'Nike Air Zoom Pegasus 41 Running Shoes For Men Black', {
        brand: 'Nike',
        category: 'footwear',
        currentPriceMinor: 20000
      })
    ]);
    const relevance = scoreDiscoveryGroup(
      discoveryGroup('keyword', { brand: 'Kiprun', title: 'Kiprun KD900X Running Shoes', offers: [offer('decathlon_uae', 17500)] }),
      profile
    );

    expect(relevance.tier).toBe(2);
    expect(relevance.reason).toBe('Because you track Nike Air Zoom Pegasus 41 Running Shoes…');
  });

  it('keeps a category-only match at tier 1 with the category explanation', () => {
    const profile = buildDiscoveryTasteProfile([nikeRunningTracked]);
    const relevance = scoreDiscoveryGroup(
      discoveryGroup('category', { brand: 'Puma', title: 'Puma Velocity Nitro 3', offers: [offer('puma_uae', 50000)] }),
      profile
    );

    expect(relevance.tier).toBe(1);
    expect(relevance.reason).toBe('Because you track Footwear');
    expect(relevance.score).toBe(50);
  });

  it('adds a price-band bonus inside the watched category range', () => {
    const profile = buildDiscoveryTasteProfile([nikeRunningTracked]);
    const inBand = scoreDiscoveryGroup(
      discoveryGroup('in-band', { brand: 'Puma', title: 'Puma Velocity Nitro 3', offers: [offer('puma_uae', 15000)] }),
      profile
    );
    const outside = scoreDiscoveryGroup(
      discoveryGroup('outside', { brand: 'Puma', title: 'Puma Velocity Nitro 3', offers: [offer('puma_uae', 50000)] }),
      profile
    );

    expect(inBand.score - outside.score).toBe(25);
    expect(inBand.reason).toBe('In your usual price range');
    expect(outside.reason).toBe('Because you track Footwear');
  });

  it('returns no score and no reason when nothing relates to the watchlist', () => {
    const profile = buildDiscoveryTasteProfile([nikeRunningTracked]);
    const relevance = scoreDiscoveryGroup(
      discoveryGroup('phone', {
        brand: 'Samsung',
        title: 'Samsung Galaxy S25 Ultra',
        category: 'phones',
        categories: ['phones'],
        offers: [offer('amazon_ae', 400000)]
      }),
      profile
    );

    expect(relevance).toEqual({ score: 0, tier: 0 });
  });
});

describe('rankDiscoveryGroups', () => {
  it('orders a watchlist-related running shoe first without mutating the input', () => {
    const profile = buildDiscoveryTasteProfile([nikeRunningTracked]);
    const phone = discoveryGroup('phone', {
      brand: 'Samsung',
      title: 'Samsung Galaxy S25 Ultra',
      category: 'phones',
      categories: ['phones'],
      offers: [offer('amazon_ae', 400000)]
    });
    const running = discoveryGroup('running', {
      brand: 'Kiprun',
      title: 'Kiprun KD900X Running Shoes',
      offers: [offer('decathlon_uae', 17500)]
    });
    const generic = discoveryGroup('generic', { brand: 'Puma', title: 'Puma Velocity Nitro 3', offers: [offer('puma_uae', 50000)] });
    const groups = [phone, running, generic];

    const ranked = rankDiscoveryGroups(groups, profile);

    expect(ranked.map((group) => group.id)).toEqual(['running', 'generic', 'phone']);
    expect(ranked[0].relevance?.reason).toBe('Because you track Nike Air Zoom Pegasus 41 Running Shoes');
    expect(ranked[0]).not.toBe(groups[1]);
    expect(groups.map((group) => group.id)).toEqual(['phone', 'running', 'generic']);
    expect(groups.every((group) => group.relevance === undefined)).toBe(true);
  });

  it('caps a repeated brand at two groups inside the first window of twelve', () => {
    const profile = buildDiscoveryTasteProfile([nikeRunningTracked]);
    const nikeGroups = [1, 2, 3, 4, 5].map((index) =>
      discoveryGroup(`nike-${index}`, { brand: 'Nike', title: `Nike Air Zoom Model ${index}` })
    );
    // Unrelated groups share distinct brands/categories so only the Nike cap shapes the window.
    const categories: DiscoveryCategory[] = ['phones', 'audio', 'gaming', 'clothing', 'skincare', 'toys'];
    const otherGroups = Array.from({ length: 12 }, (_, index) =>
      discoveryGroup(`other-${index}`, {
        brand: `Brand ${index}`,
        title: `Neutral Product ${index}`,
        category: categories[index % categories.length],
        categories: [categories[index % categories.length]],
        offers: [offer('amazon_ae', 300000 + index)]
      })
    );

    const ranked = rankDiscoveryGroups([...nikeGroups, ...otherGroups], profile);

    expect(ranked).toHaveLength(17);
    expect(ranked.slice(0, 12).filter((group) => group.brand === 'Nike')).toHaveLength(2);
    expect(ranked.slice(12).filter((group) => group.brand === 'Nike')).toHaveLength(3);
  });

  it('preserves the original order with neutral relevance when the profile is empty', () => {
    const groups = [
      discoveryGroup('first'),
      discoveryGroup('second', { brand: 'Puma' }),
      discoveryGroup('third', { brand: 'Samsung', category: 'phones', categories: ['phones'] })
    ];

    const ranked = rankDiscoveryGroups(groups, buildDiscoveryTasteProfile([]));

    expect(ranked.map((group) => group.id)).toEqual(['first', 'second', 'third']);
    expect(ranked.map((group) => group.relevance)).toEqual([
      { score: 0, tier: 0 },
      { score: 0, tier: 0 },
      { score: 0, tier: 0 }
    ]);
    expect(ranked[0]).not.toBe(groups[0]);
  });
});

describe('discoveryTasteSummary', () => {
  it('returns up to two category labels ordered by how much the shopper tracks', () => {
    const profile = buildDiscoveryTasteProfile([
      trackedProduct(1, 'Nike Air Zoom Pegasus 41 Running Shoes', { brand: 'Nike', category: 'footwear', currentPriceMinor: 20000 }),
      trackedProduct(2, 'Nike Air Force 1 07 Shoes', { brand: 'Nike', category: 'footwear', currentPriceMinor: 30000 }),
      trackedProduct(3, 'Adidas Ultraboost Running Shoes', { brand: 'Adidas', category: 'footwear', currentPriceMinor: 15000 }),
      trackedProduct(4, 'H&M Linen Shirt', { brand: 'H&M', category: 'clothing', currentPriceMinor: 9000 }),
      trackedProduct(5, 'Zara Cotton Shirt', { brand: 'Zara', category: 'clothing', currentPriceMinor: 11000 }),
      trackedProduct(6, 'Sony WH-1000XM5 Headphones', { brand: 'Sony', category: 'audio', currentPriceMinor: 90000 })
    ]);

    expect(discoveryTasteSummary(profile)).toEqual(['Footwear', 'Clothing']);
    expect(discoveryTasteSummary(buildDiscoveryTasteProfile([]))).toEqual([]);
  });
});
