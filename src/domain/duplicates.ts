import { cleanUrl } from './sites';
import { ParsedProduct, TrackedProduct, VariantSelection } from './types';

export type TrackingMatch = {
  /** An existing tracker for exactly the same product option (or the same page-level product). */
  exact?: TrackedProduct;
  /** Trackers for the same product page, including other options. */
  sameProduct: TrackedProduct[];
};

type ParsedIdentity = Pick<ParsedProduct, 'canonicalUrl' | 'title' | 'siteKey'> & { selectedVariant?: VariantSelection };

function normalizedProductUrl(value: string | undefined): string {
  if (!value) {
    return '';
  }

  return cleanUrl(value).replace(/\/+$/, '');
}

/**
 * Find existing trackers for the parsed product.
 *
 * Variant ids are only unique inside one product (some retailers use size
 * values or option identifiers as the id), so a variant match also requires the
 * same retailer and the same normalized product URL. That keeps two different
 * products that happen to share an option id from being treated as duplicates,
 * while a different option of the same product is reported through
 * `sameProduct` so the user can add it as a separate tracker.
 */
export function findTrackingMatches(parsed: ParsedIdentity, tracked: TrackedProduct[]): TrackingMatch {
  const productUrl = normalizedProductUrl(parsed.canonicalUrl);
  const variantId = parsed.selectedVariant?.id;

  const sameProduct = tracked.filter(
    (item) =>
      item.siteKey === parsed.siteKey &&
      normalizedProductUrl(item.canonicalUrl || item.url) === productUrl
  );

  const exact = variantId
    ? sameProduct.find((item) => item.variant?.id === variantId)
    : sameProduct.find((item) => !item.variant);

  return { exact, sameProduct };
}

/** Human-readable description of a tracker or parsed option, used in duplicate prompts. */
export function trackingOptionLabel(product: { variant?: { label?: string }; selectedVariant?: VariantSelection }): string {
  return product.variant?.label ?? product.selectedVariant?.label ?? 'page-level tracking';
}
