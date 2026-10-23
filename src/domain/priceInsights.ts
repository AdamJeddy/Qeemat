import { PriceSnapshot } from './types';

export type PriceInsights = {
  observations: number;
  firstPriceMinor?: number;
  latestPriceMinor?: number;
  lowestPriceMinor?: number;
  highestPriceMinor?: number;
  averagePriceMinor?: number;
  changeSinceFirstMinor?: number;
  dropFromHighestMinor?: number;
  dropFromHighestPercent?: number;
};

export function calculatePriceInsights(snapshots: PriceSnapshot[]): PriceInsights {
  const pricedSnapshots = snapshots
    .filter((snapshot): snapshot is PriceSnapshot & { priceMinor: number } => snapshot.priceMinor !== undefined)
    .sort((left, right) => left.checkedAt.localeCompare(right.checkedAt));

  if (pricedSnapshots.length === 0) {
    return { observations: 0 };
  }

  const prices = pricedSnapshots.map((snapshot) => snapshot.priceMinor);
  const firstPriceMinor = prices[0];
  const latestPriceMinor = prices[prices.length - 1];
  const lowestPriceMinor = Math.min(...prices);
  const highestPriceMinor = Math.max(...prices);
  const averagePriceMinor = Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length);
  const dropFromHighestMinor = Math.max(0, highestPriceMinor - latestPriceMinor);

  return {
    observations: prices.length,
    firstPriceMinor,
    latestPriceMinor,
    lowestPriceMinor,
    highestPriceMinor,
    averagePriceMinor,
    changeSinceFirstMinor: latestPriceMinor - firstPriceMinor,
    dropFromHighestMinor,
    dropFromHighestPercent: highestPriceMinor > 0 ? Math.round((dropFromHighestMinor / highestPriceMinor) * 100) : undefined
  };
}
