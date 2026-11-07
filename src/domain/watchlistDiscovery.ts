import type { ShoppingCategory } from './discoveryCategories';
import type { TrackedProduct } from './types';

/** Only active, non-archived trackers with an explicit category shape the feed. */
export function watchlistCategories(products: TrackedProduct[]): ShoppingCategory[] {
  return [...new Set(products.filter((product) => product.isActive && !product.isArchived && product.category).map((product) => product.category!))];
}
