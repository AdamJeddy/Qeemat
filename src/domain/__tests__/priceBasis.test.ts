import { inferPackBasis, pricesShareBasis, withDiscoveryPriceBasis, verifyDiscoveryTrackingBasis } from '../priceBasis';
import { DiscoveryProduct, ParsedProduct } from '../types';
import { formatPrice } from '../price';

describe('grocery pricing basis', () => {
  it('distinguishes pack sizes and counts while accepting equivalent unit spelling', () => {
    expect(inferPackBasis('Rice 1 kg')).toBe(inferPackBasis('Rice 1000g'));
    expect(inferPackBasis('Milk 2 x 500 ml')).not.toBe(inferPackBasis('Milk 500 ml'));
    expect(pricesShareBasis({ title: 'Rice 1kg', priceBasis: 'pack:1x1000g' }, { title: 'Rice 500g' })).toBe(false);
    expect(pricesShareBasis({ title: 'Milk 1L' }, { title: 'Milk 1000ml' })).toBe(true);
    expect(inferPackBasis('Milk 500ml pack of 2')).toBe(inferPackBasis('Milk 2 x 500 ml'));
    expect(inferPackBasis('Diapers 9-14kg Size 4 Box 222 Count')).toBe('pack:222pcs');
    expect(pricesShareBasis({ title: 'Diapers 222 count', priceBasis: 'pack:222pcs' }, { title: 'Diapers 111 count' })).toBe(false);
  });
  it('does not infer a weight comparison from ordinary technology or clothing titles', () => {
    expect(pricesShareBasis({ title: 'Samsung phone 5G' }, { title: 'Samsung phone' })).toBe(true);
    expect(pricesShareBasis({ title: 'Suit jacket 42L' }, { title: 'Suit jacket long size 42' })).toBe(true);
  });
  it('only adds title-based pack metadata in declared grocery collections and verifies the product page before tracking', () => {
    const base: DiscoveryProduct = { id: 'milk', category: 'beverages', siteKey: 'noon', brand: 'Milk brand', title: 'Milk 1L', url: 'https://www.noon.com/milk/p/', priceMinor: 500, currency: 'AED', availability: 'in_stock', observedAt: '2026-10-27T10:00:00Z' };
    const listing = withDiscoveryPriceBasis(base);
    expect(listing.priceBasis).toBe('pack:1x1000ml');
    expect(withDiscoveryPriceBasis({ ...base, category: 'phones', title: 'Phone 5G' }).priceBasis).toBeUndefined();
    const parsed: ParsedProduct = { siteKey: 'noon', title: 'Milk 1000ml', canonicalUrl: base.url, availability: 'in_stock', priceMinor: 500, currency: 'AED' };
    expect(verifyDiscoveryTrackingBasis(listing, parsed)?.priceBasis).toBe('pack:1x1000ml');
    expect(verifyDiscoveryTrackingBasis(listing, { ...parsed, title: 'Milk without a declared size' })).toBeUndefined();
  });
  it('does not compare an old default-weight price against a normalized kilogram price', () => {
    expect(pricesShareBasis({ title: 'Banana' }, { title: 'Banana', priceBasis: 'kg' })).toBe(false);
    expect(formatPrice(990, 'AED', 'kg')).toBe('AED 9.90 /kg');
  });
});
