import { cleanUrl } from './sites';
import { ParsedProduct, TrackedProduct, VariantSelection } from './types';

export type TrackingMatch = {
  /** An existing tracker for exactly the same product option (or the same page-level product). */
  exact?: TrackedProduct;
  /** Trackers for the same product page, including other options. */
  sameProduct: TrackedProduct[];
};

type ParsedIdentity = Pick<ParsedProduct, 'canonicalUrl' | 'title'> & { selectedVariant?: VariantSelection };

function normalizedProductUrl(value: string | undefined): string {
  if (!value) {
    return '';
  }

  return cleanUrl(value).replace(/\/+$/, '');
}

/**
 * Find existing trackers for the parsed product.
 *
 * - A tracker with the same variant id is always the same option, even when the
 *   retailer exposes each option through its own URL.
 * - Two trackers without a selected variant are duplicates when they point at
 *   the same normalized product URL (page-level tracking).
 * - Other trackers that share the product page are returned as `sameProduct`:
 *   the user may legitimately track several sizes/colours of one product.
 */
export function findTrackingMatches(parsed: ParsedIdentity, tracked: TrackedProduct[]): TrackingMatch {
  const productUrl = normalizedProductUrl(parsed.canonicalUrl);
  const variantId = parsed.selectedVariant?.id;

  const exact = variantId
    ? tracked.find((item) => item.variant?.id === variantId)
    : tracked.find((item) => !item.variant && normalizedProductUrl(item.canonicalUrl || item.url) === productUrl);

  const sameProduct = tracked.filter((item) => {
    if (variantId && item.variant?.id === variantId) {
      return true;
    }

    return normalizedProductUrl(item.canonicalUrl || item.url) === productUrl;
  });

  return { exact, sameProduct };
}

/** Human-readable description of a tracker or parsed option, used in duplicate prompts. */
export function trackingOptionLabel(product: { variant?: { label?: string }; selectedVariant?: VariantSelection }): string {
  return product.variant?.label ?? product.selectedVariant?.label ?? 'page-level tracking';
}
