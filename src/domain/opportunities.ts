import { ProductWithSnapshots, TrackedProduct } from './types';

export type OpportunityReason = 'target_hit' | 'new_low' | 'recent_drop';

export type Opportunity = {
  product: TrackedProduct;
  reason: OpportunityReason;
  currentPriceMinor: number;
  savingsMinor: number;
  percent: number;
  observedAt?: string;
};

const MINIMUM_RECENT_DROP_PERCENT = 5;
const MAX_OPPORTUNITIES = 5;

/**
 * Returns the most actionable locally observed prices. An item appears once,
 * using the strongest available reason rather than repeating it for every signal.
 */
export function buildOpportunityFeed(records: ProductWithSnapshots[]): Opportunity[] {
  return records
    .map(buildOpportunity)
    .filter((opportunity): opportunity is Opportunity => opportunity !== undefined)
    .sort((left, right) => {
      const reasonDifference = opportunityRank(right.reason) - opportunityRank(left.reason);
      if (reasonDifference !== 0) {
        return reasonDifference;
      }

      const savingDifference = right.savingsMinor - left.savingsMinor;
      if (savingDifference !== 0) {
        return savingDifference;
      }

      return (right.observedAt ?? '').localeCompare(left.observedAt ?? '');
    })
    .slice(0, MAX_OPPORTUNITIES);
}

function buildOpportunity({ product, snapshots }: ProductWithSnapshots): Opportunity | undefined {
  if (
    !product.isActive ||
    product.isArchived ||
    product.lastAvailability !== 'in_stock' ||
    product.currentPriceMinor === undefined
  ) {
    return undefined;
  }

  const currentPriceMinor = product.currentPriceMinor;
  const pricedSnapshots = snapshots
    .filter((snapshot): snapshot is typeof snapshot & { priceMinor: number } => snapshot.priceMinor !== undefined)
    .sort((left, right) => left.checkedAt.localeCompare(right.checkedAt));
  const observedAt = product.lastSuccessAt ?? product.lastCheckedAt;

  if (product.targetPriceMinor !== undefined && currentPriceMinor <= product.targetPriceMinor) {
    const savingsMinor = product.targetPriceMinor - currentPriceMinor;
    return {
      product,
      reason: 'target_hit',
      currentPriceMinor,
      savingsMinor,
      percent: percentOf(savingsMinor, product.targetPriceMinor),
      observedAt
    };
  }

  const history = pricedSnapshots.map((snapshot) => snapshot.priceMinor);
  const highestPriceMinor = history.length ? Math.max(...history) : undefined;
  const lowestPriceMinor = history.length ? Math.min(...history) : undefined;

  if (
    history.length >= 3 &&
    lowestPriceMinor === currentPriceMinor &&
    highestPriceMinor !== undefined &&
    highestPriceMinor > currentPriceMinor
  ) {
    const savingsMinor = highestPriceMinor - currentPriceMinor;
    return {
      product,
      reason: 'new_low',
      currentPriceMinor,
      savingsMinor,
      percent: percentOf(savingsMinor, highestPriceMinor),
      observedAt
    };
  }

  if (product.previousPriceMinor !== undefined && product.previousPriceMinor > currentPriceMinor) {
    const savingsMinor = product.previousPriceMinor - currentPriceMinor;
    const rawPercent = (savingsMinor / product.previousPriceMinor) * 100;
    if (rawPercent >= MINIMUM_RECENT_DROP_PERCENT) {
      return {
        product,
        reason: 'recent_drop',
        currentPriceMinor,
        savingsMinor,
        percent: Math.round(rawPercent),
        observedAt
      };
    }
  }

  return undefined;
}

function opportunityRank(reason: OpportunityReason): number {
  if (reason === 'target_hit') {
    return 3;
  }

  if (reason === 'new_low') {
    return 2;
  }

  return 1;
}

function percentOf(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}
