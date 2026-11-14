import { DISCOVERY_CATEGORY_LABELS } from './discoveryCategories';
import type { ShoppingCategory } from './discoveryCategories';
import type { TrackedProduct } from './types';

type CategoryInput = Pick<TrackedProduct, 'title' | 'url' | 'canonicalUrl'> & Partial<Pick<TrackedProduct, 'category' | 'categoryExcluded' | 'sourceMetadata'>>;

/** Conservative hints for legacy trackers whose retailer did not supply a category. */
export function inferWatchlistCategory(product: CategoryInput): ShoppingCategory | undefined {
  if (product.category) { return product.category; }
  if (product.categoryExcluded) { return undefined; }
  const text = `${product.title} ${product.canonicalUrl || product.url}`.toLowerCase().replace(/[-_/]+/g, ' ');
  const rules: [ShoppingCategory, RegExp][] = [
    ['tech_accessories', /\b(?:phone|iphone|ipad|galaxy|laptop|tablet)\b.{0,35}\b(?:case|cover|protector|charger|cable)\b|\b(?:case|cover|protector|charger|cable)\b.{0,35}\b(?:phone|iphone|ipad|galaxy|laptop|tablet)\b/],
    ['footwear', /\b(?:sneakers?|trainers?|footwear|shoes?|sandals?|loafers?|boots?|slippers?)\b/],
    ['bags', /\b(?:handbags?|backpacks?|crossbody bags?|tote bags?|shoulder bags?)\b/],
    ['watches', /\b(?:smartwatch|wristwatch|wrist watch)\b/],
    ['phones', /\b(?:iphone\s*\d+|galaxy\s+[sza]\d+|pixel\s*\d+|smartphones?|mobile phones?)\b/],
    ['tablets', /\b(?:ipad|galaxy tab|tablets?)\b/],
    ['computers', /\b(?:macbook|laptops?|notebooks?|desktop computers?)\b/],
    ['audio', /\b(?:headphones?|earbuds?|earphones?|speakers?|soundbars?|airpods)\b/],
    ['televisions', /\b(?:televisions?|smart tv|oled tv|qled tv)\b/],
    ['gaming', /\b(?:playstation|xbox|nintendo switch|game console)\b/],
    ['fragrance', /\b(?:perfume|parfum|fragrance|cologne|eau de toilette|eau de parfum)\b/],
    ['makeup', /\b(?:lipstick|lip gloss|mascara|eyeliner|foundation makeup|blush|concealer)\b/],
    ['skincare', /\b(?:moisturi[sz]er|sunscreen|facial cleanser|face serum|skincare)\b/],
    ['haircare', /\b(?:shampoo|conditioner|hair mask|hair oil)\b/],
    ['clothing', /\b(?:dress(?:es)?|t shirts?|shirts?|blouses?|sweatshirts?|hoodies?|trousers?|jeans|jackets?|skirts?|sweaters?|coats?)\b/],
    ['home', /\b(?:throw pillows?|cushion covers?|home decor)\b/],
    ['bedding', /\b(?:duvet|bedsheets?|bed linen|pillowcases?)\b/],
    ['fitness', /\b(?:yoga mat|training mat|dumbbells?|kettlebells?)\b/]
  ];
  const metadata = [product.sourceMetadata?.productType, ...(product.sourceMetadata?.categoryPath ?? []).slice().reverse(), product.sourceMetadata?.displayName].filter((value): value is string => Boolean(value));
  for (const value of metadata) {
    const normalized = value.toLowerCase().trim();
    const exact = (Object.entries(DISCOVERY_CATEGORY_LABELS) as [ShoppingCategory, string][]).find(([key, label]) => normalized === key.replace(/_/g, ' ') || normalized === label.toLowerCase());
    if (exact) { return exact[0]; }
    const matched = rules.find(([, pattern]) => pattern.test(normalized.replace(/[-_/]+/g, ' ')));
    if (matched) { return matched[0]; }
  }
  return rules.find(([, pattern]) => pattern.test(text))?.[0];
}

/** Categorised active trackers shape the feed; explicit choices take precedence. */
export function watchlistCategories(products: TrackedProduct[]): ShoppingCategory[] {
  return [...new Set(products.filter((product) => product.isActive && !product.isArchived).map(inferWatchlistCategory).filter((category): category is ShoppingCategory => Boolean(category)))];
}
