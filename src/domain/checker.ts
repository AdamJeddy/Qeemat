import { isDueForCheck } from './dates';
import { fetchAndParseProduct } from './parser';
import { PriceDirection, SnapshotSource, TrackedProduct } from './types';
import { recordFailedCheck, recordSuccessfulCheck, recordActivityEvent, listTrackedProducts, getTrackedProduct } from '../data/database';
import { maybeNotifyForCheck } from './notifications';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns the minimum delay (ms) between individual product checks
 * for a given bulk-check source. Background checks use a longer
 * stagger to avoid rate limits; manual batch checks use a shorter
 * stagger to stay responsive.
 */
function staggerDelayMs(source: SnapshotSource): number {
  if (source === 'background') {
    return 15000; // 15s between background checks
  }

  return 1500; // 1.5s between manual-batch checks
}

export async function checkProductNow(product: TrackedProduct, source: SnapshotSource): Promise<void> {
  if (product.lastAvailability === 'out_of_stock') {
    return;
  }

  const result = await fetchAndParseProduct(product.canonicalUrl || product.url, product.variant);

  if (!result.ok) {
    await recordFailedCheck(product, result.code, source, result.message);
    return;
  }

  const parsed = result.product;
  const saved = await recordSuccessfulCheck(product, parsed, source);

  // Detect availability transition (e.g. in_stock → out_of_stock)
  const previousAvailability = product.lastAvailability;
  const newAvailability = parsed.availability;

  await maybeNotifyForCheck(product, parsed, saved.previousPriceMinor, saved.newPriceMinor, previousAvailability);

  // Record activity events
  if (newAvailability === 'out_of_stock') {
    // OOS transition event
    await recordActivityEvent({
      trackedProductId: product.id,
      productTitle: product.title,
      productImageUrl: product.imageUrl,
      previousPriceMinor: saved.previousPriceMinor,
      newPriceMinor: saved.newPriceMinor ?? 0,
      currency: parsed.currency ?? product.currency,
      priceDirection: 'first',
      availability: 'out_of_stock',
      source,
      checkedAt: new Date().toISOString()
    });
  } else if (saved.newPriceMinor !== undefined) {
    // Price-change activity event (only when not OOS)
    const direction = resolvePriceDirection(saved.previousPriceMinor, saved.newPriceMinor);
    if (direction) {
      await recordActivityEvent({
        trackedProductId: product.id,
        productTitle: product.title,
        productImageUrl: product.imageUrl,
        previousPriceMinor: saved.previousPriceMinor,
        newPriceMinor: saved.newPriceMinor,
        currency: parsed.currency ?? product.currency,
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
    .filter((product) => force || isDueForCheck(product.lastCheckedAt, product.checkPreference, product.siteKey))
    .slice(0, limit);

  const staggerMs = staggerDelayMs(source);

  for (let i = 0; i < dueProducts.length; i++) {
    if (i > 0) {
      await delay(staggerMs);
    }

    await checkProductNow(dueProducts[i], source);
  }
}
