import { isDueForCheck } from './dates';
import { fetchAndParseProduct } from './parser';
import { PriceDirection, SnapshotSource, TrackedProduct } from './types';
import { recordFailedCheck, recordSuccessfulCheck, recordActivityEvent, listTrackedProducts, getTrackedProduct } from '../data/database';
import { maybeNotifyForCheck } from './notifications';

export async function checkProductNow(product: TrackedProduct, source: SnapshotSource): Promise<void> {
  const result = await fetchAndParseProduct(product.canonicalUrl || product.url);

  if (!result.ok) {
    await recordFailedCheck(product, result.code, source, result.message);
    return;
  }

  const saved = await recordSuccessfulCheck(product, result.product, source);
  await maybeNotifyForCheck(product, result.product, saved.previousPriceMinor, saved.newPriceMinor);

  // Record price-change activity event
  if (saved.newPriceMinor !== undefined) {
    const direction = resolvePriceDirection(saved.previousPriceMinor, saved.newPriceMinor);
    if (direction) {
      await recordActivityEvent({
        trackedProductId: product.id,
        productTitle: product.title,
        productImageUrl: product.imageUrl,
        previousPriceMinor: saved.previousPriceMinor,
        newPriceMinor: saved.newPriceMinor,
        currency: result.product.currency ?? product.currency,
        priceDirection: direction,
        source,
        checkedAt: new Date().toISOString()
      });
    }
  }
}

function resolvePriceDirection(
  previousPriceMinor: number | undefined,
  newPriceMinor: number
): PriceDirection | undefined {
  if (previousPriceMinor === undefined) {
    return 'first';
  }

  if (newPriceMinor < previousPriceMinor) {
    return 'down';
  }

  if (newPriceMinor > previousPriceMinor) {
    return 'up';
  }

  return undefined;
}

export async function checkProductById(productId: number): Promise<void> {
  const product = await getTrackedProduct(productId);
  if (!product) {
    return;
  }

  await checkProductNow(product, 'manual_single');
}

export async function checkDueProducts(limit = 8): Promise<void> {
  await checkActiveProducts(limit, false, 'background');
}

export async function checkAllActiveProducts(limit = 8): Promise<void> {
  await checkActiveProducts(limit, true, 'manual_batch');
}

export async function checkAllActiveProductsFromBackground(limit = 8): Promise<void> {
  await checkActiveProducts(limit, true, 'background');
}

async function checkActiveProducts(limit: number, force: boolean, source: SnapshotSource): Promise<void> {
  const products = await listTrackedProducts();
  const dueProducts = products
    .filter((product) => product.isActive)
    .filter((product) => force || isDueForCheck(product.lastCheckedAt, product.checkPreference))
    .slice(0, limit);

  for (const product of dueProducts) {
    await checkProductNow(product, source);
  }
}
