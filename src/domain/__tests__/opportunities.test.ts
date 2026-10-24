import { buildOpportunityFeed } from '../opportunities';
import { PriceSnapshot, ProductWithSnapshots, TrackedProduct } from '../types';

function product(overrides: Partial<TrackedProduct> = {}): TrackedProduct {
  return {
    id: 1,
    url: 'https://example.com/product',
    canonicalUrl: 'https://example.com/product',
    siteKey: 'adidas',
    title: 'Running shoes',
    currency: 'AED',
    currentPriceMinor: 10000,
    alertMode: 'price_drop',
    checkPreference: 'daily',
    isActive: true,
    lastAvailability: 'in_stock',
    lastCheckedAt: '2026-10-03T09:00:00.000Z',
    lastSuccessAt: '2026-10-03T09:00:00.000Z',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-03T09:00:00.000Z',
    ...overrides
  };
}

function snapshot(id: number, priceMinor: number, checkedAt: string): PriceSnapshot {
  return {
    id,
    trackedProductId: id,
    priceMinor,
    currency: 'AED',
    availability: 'in_stock',
    status: 'price_changed',
    source: 'background',
    checkedAt
  };
}

function record(item: TrackedProduct, snapshots: PriceSnapshot[]): ProductWithSnapshots {
  return { product: item, snapshots };
}

describe('buildOpportunityFeed', () => {
  it('ranks target hits ahead of proven lows and meaningful recent drops', () => {
    const opportunities = buildOpportunityFeed([
      record(product({ id: 1, currentPriceMinor: 8500, targetPriceMinor: 9000 }), [
        snapshot(1, 10000, '2026-10-01T09:00:00.000Z'),
        snapshot(2, 9200, '2026-10-02T09:00:00.000Z'),
        snapshot(3, 8500, '2026-10-03T09:00:00.000Z')
      ]),
      record(product({ id: 2, currentPriceMinor: 8000, previousPriceMinor: 9000 }), [
        snapshot(4, 10000, '2026-10-01T09:00:00.000Z'),
        snapshot(5, 9000, '2026-10-02T09:00:00.000Z'),
        snapshot(6, 8000, '2026-10-03T09:00:00.000Z')
      ]),
      record(product({ id: 3, currentPriceMinor: 9000, previousPriceMinor: 10000 }), [
        snapshot(7, 10000, '2026-10-02T09:00:00.000Z'),
        snapshot(8, 9000, '2026-10-03T09:00:00.000Z')
      ])
    ]);

    expect(opportunities.map((opportunity) => opportunity.reason)).toEqual([
      'target_hit',
      'new_low',
      'recent_drop'
    ]);
    expect(opportunities[0]).toMatchObject({ savingsMinor: 500, percent: 6 });
    expect(opportunities[1]).toMatchObject({ savingsMinor: 2000, percent: 20 });
    expect(opportunities[2]).toMatchObject({ savingsMinor: 1000, percent: 10 });
  });

  it('excludes paused, unavailable, and drops below the unrounded threshold', () => {
    const opportunities = buildOpportunityFeed([
      record(product({ id: 1, isActive: false, previousPriceMinor: 12000 }), [snapshot(1, 12000, '2026-10-01T09:00:00.000Z'), snapshot(2, 10000, '2026-10-03T09:00:00.000Z')]),
      record(product({ id: 2, lastAvailability: 'out_of_stock', previousPriceMinor: 12000 }), [snapshot(3, 12000, '2026-10-01T09:00:00.000Z'), snapshot(4, 10000, '2026-10-03T09:00:00.000Z')]),
      record(product({ id: 3, currentPriceMinor: 9900, previousPriceMinor: 10000 }), [snapshot(5, 10000, '2026-10-02T09:00:00.000Z'), snapshot(6, 9900, '2026-10-03T09:00:00.000Z')]),
      record(product({ id: 4, currentPriceMinor: 9540, previousPriceMinor: 10000 }), [snapshot(7, 10000, '2026-10-02T09:00:00.000Z'), snapshot(8, 9540, '2026-10-03T09:00:00.000Z')])
    ]);

    expect(opportunities).toEqual([]);
  });
});
