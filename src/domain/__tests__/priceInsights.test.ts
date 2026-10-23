import { calculatePriceInsights } from '../priceInsights';

describe('calculatePriceInsights', () => {
  it('derives local price history signals in chronological order', () => {
    const insights = calculatePriceInsights([
      { id: 3, trackedProductId: 1, priceMinor: 8000, availability: 'in_stock', status: 'price_changed', source: 'manual_single', checkedAt: '2026-10-03T00:00:00.000Z' },
      { id: 2, trackedProductId: 1, priceMinor: 10000, availability: 'in_stock', status: 'price_changed', source: 'manual_single', checkedAt: '2026-10-02T00:00:00.000Z' },
      { id: 1, trackedProductId: 1, priceMinor: 12000, availability: 'in_stock', status: 'ok', source: 'manual_single', checkedAt: '2026-10-01T00:00:00.000Z' }
    ]);

    expect(insights).toEqual({
      observations: 3,
      firstPriceMinor: 12000,
      latestPriceMinor: 8000,
      lowestPriceMinor: 8000,
      highestPriceMinor: 12000,
      averagePriceMinor: 10000,
      changeSinceFirstMinor: -4000,
      dropFromHighestMinor: 4000,
      dropFromHighestPercent: 33
    });
  });

  it('returns empty insights when no snapshot has a usable price', () => {
    expect(calculatePriceInsights([
      { id: 1, trackedProductId: 1, availability: 'out_of_stock', status: 'ok', source: 'background', checkedAt: '2026-10-01T00:00:00.000Z' }
    ])).toEqual({ observations: 0 });
  });
});
