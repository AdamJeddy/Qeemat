import { isDueForCheck } from './dates';
import { fetchAndParseProduct } from './parser';
import { TrackedProduct } from './types';
import { recordFailedCheck, recordSuccessfulCheck, listTrackedProducts, getTrackedProduct } from '../data/database';
import { maybeNotifyForCheck } from './notifications';

export async function checkProductNow(product: TrackedProduct): Promise<void> {
  const result = await fetchAndParseProduct(product.canonicalUrl || product.url);

  if (!result.ok) {
    await recordFailedCheck(product, result.code, result.message);
    return;
  }

  const saved = await recordSuccessfulCheck(product, result.product);
  await maybeNotifyForCheck(product, result.product, saved.previousPriceMinor, saved.newPriceMinor);
}

export async function checkProductById(productId: number): Promise<void> {
  const product = await getTrackedProduct(productId);
  if (!product) {
    return;
  }

  await checkProductNow(product);
}

export async function checkDueProducts(limit = 8): Promise<void> {
  await checkActiveProducts(limit, false);
}

export async function checkAllActiveProducts(limit = 8): Promise<void> {
  await checkActiveProducts(limit, true);
}

async function checkActiveProducts(limit: number, force: boolean): Promise<void> {
  const products = await listTrackedProducts();
  const dueProducts = products
    .filter((product) => product.isActive)
    .filter((product) => force || isDueForCheck(product.lastCheckedAt, product.checkPreference))
    .slice(0, limit);

  for (const product of dueProducts) {
    await checkProductNow(product);
  }
}
