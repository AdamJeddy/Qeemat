import { parseProductHtml, fetchAndParseProduct } from '../parser';
import { cleanUrl, detectSupportedSite } from '../sites';
import { DISCOVERY_COLLECTIONS } from '../discovery';
import { parseDiscoveryListing } from '../discoveryListings';
import { toVariantSelection } from '../variants';
import { carrefourPrice } from '../carrefour';

jest.mock('../webViewFetcher', () => ({ fetchPageHtmlViaWebView: jest.fn().mockResolvedValue(null) }));

const url = 'https://www.carrefouruae.com/mafuae/en/true-wireless-earbuds/apple-airpods-4-anc-tws-white/p/2202245?offer=offer_carrefour_&sellerId=0000&sid=SLOTTED';
const product = {
  productId: '2202245', productTitle: 'Apple AirPods 4 ANC White',
  intent: 'SLOTTED', offerId: 'offer_carrefour_', shopId: '0000', shopName: 'Carrefour',
  image: 'https://cdn.mafrservices.com/airpods.jpg', price: '549.00', currencyISO: 'AED',
  stockStatus: 'low', availableQuantity: 1
};
// The storefront streams JSON records through multiple Flight chunks.
const flight = (value: unknown) => {
  const data = `a:${JSON.stringify(value)}\n`;
  const half = Math.floor(data.length / 2);
  return [data.slice(0, half), data.slice(half)].map((chunk) => `<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`).join('');
};

describe('Carrefour UAE tracking', () => {
  it('requires food metadata before interpreting title units as pack sizes', () => {
    expect(carrefourPrice({ productTitle: 'Phone 5G' }, 50000).priceBasis).toBeUndefined();
    expect(carrefourPrice({ productType: 'FOOD', productTitle: 'Milk 1L' }, 500).priceBasis).toBe('pack:1x1000ml');
    expect(carrefourPrice({ productCategory: ['f11601'], productName: 'Rice 1kg' }, 1000).priceBasis).toBe('pack:1x1000g');
  });
  it('normalizes weighted groceries using the observed weight, not the marked unit price', () => {
    const apple = { ...product, productTitle: 'Pink Lady Apple', price: '5.00', isSoldByWeight: true, scalableWeights: '500.0', analytics: { oneGMSellingPrice: 0.01, unitPrice: 13 } };
    expect(parseProductHtml('carrefour_uae', url, flight(apple))).toEqual(expect.objectContaining({ priceMinor: 1000, priceBasis: 'kg', variants: [expect.objectContaining({ priceMinor: 1000 })] }));
    expect(parseProductHtml('carrefour_uae', url, flight({ ...apple, scalableWeights: undefined, analytics: {} }))?.priceMinor).toBeUndefined();
  });
  it('registers Carrefour independently of the brands it sells', () => {
    expect(detectSupportedSite(url)?.key).toBe('carrefour_uae');
    expect(cleanUrl(`${url}&utm_source=test`)).toBe(url);
  });

  it('pins the observed seller, offer and delivery type when the original link has no selection', () => {
    const parsed = parseProductHtml('carrefour_uae', url.split('?')[0], flight(product));
    expect(parsed).toEqual(expect.objectContaining({
      title: product.productTitle, priceMinor: 54900, currency: 'AED', availability: 'in_stock', sku: '2202245',
      canonicalUrl: url, variants: [expect.objectContaining({
        attributes: [{ name: 'Seller', value: 'Carrefour' }], url, priceMinor: 54900
      })]
    }));
    const selection = toVariantSelection(parsed!.variants![0]);
    expect(parseProductHtml('carrefour_uae', url, flight({ ...product, price: '499.00' }), selection))
      .toEqual(expect.objectContaining({ priceMinor: 49900, selectedVariant: selection }));
  });

  it.each([
    { ...product, offerId: 'another-offer' },
    { ...product, shopId: 'another-seller' },
    { ...product, intent: 'QMKP' },
    { ...product, productId: 'another-product' }
  ])('rejects a changed product or offer instead of recording its price', (changed) => {
    expect(parseProductHtml('carrefour_uae', url, flight(changed))).toBeUndefined();
  });

  it('does not confuse product recommendations or generic JSON-LD with the selected offer', () => {
    const html = flight([{ ...product, productId: 'recommendation', price: '9.00' }, product]) +
      '<script type="application/ld+json">{"@type":"Product","name":"Wrong default","offers":{"price":1,"availability":"https://schema.org/InStock"}}</script>';
    expect(parseProductHtml('carrefour_uae', url, html)?.priceMinor).toBe(54900);
    expect(parseProductHtml('carrefour_uae', url, '<script type="application/ld+json">{"@type":"Product","name":"Default","offers":{"price":1}}</script>')).toBeUndefined();
  });

  it('recognizes the normal stock state returned by a live marketplace offer', () => {
    expect(parseProductHtml('carrefour_uae', url, flight({ ...product, stockStatus: 'normal', availableQuantity: 22 }))?.availability).toBe('in_stock');
  });

  it('returns a successful out-of-stock result without substituting another offer price', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, url, text: async () => flight({ ...product, stockStatus: 'outOfStock', availableQuantity: 0, price: undefined }) });
    try {
      expect(await fetchAndParseProduct(url)).toEqual({ ok: true, product: expect.objectContaining({ availability: 'out_of_stock', priceMinor: undefined }) });
    } finally { globalThis.fetch = originalFetch; }
  });

  it('validates the requested seller even if the fetch response URL loses its query', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, url: url.split('?')[0], text: async () => flight({ ...product, shopId: 'other' }) });
    try { expect((await fetchAndParseProduct(url)).ok).toBe(false); }
    finally { globalThis.fetch = originalFetch; }
  });
});

describe('Carrefour UAE discovery', () => {
  const tile = {
    additionalAttributes: {
      productId: '2202245', productName: product.productTitle,
      productUrl: '/mafuae/en/true-wireless-earbuds/apple-airpods-4-anc-tws-white/p/2202245',
      productCompositeId: '2202245|offer_carrefour_|SLOTTED', offerId: 'offer_carrefour_', shopId: '0000', shopName: 'Carrefour', intent: 'SLOTTED',
      sellingPrice: 549, markedPrice: 579, currency: 'AED', imageUrl: product.image,
      stock: { value: 1, stockLevelStatus: 'lowStock' }
    }, analytics: { brandName: 'nonfood_apple' }
  };

  it('uses the same kilogram basis for weighted listing and product prices', () => {
    const source = DISCOVERY_COLLECTIONS.find((entry) => entry.siteKey === 'carrefour_uae')!;
    const banana = { ...tile, additionalAttributes: { ...tile.additionalAttributes, sellingPrice: 4.95, isSoldByWeight: true, quantityTypeKey: 'kilo', orderThreshold: { min: 0.5 } } };
    expect(parseDiscoveryListing(flight(banana), source, '2026-10-27T10:00:00Z')[0]).toEqual(expect.objectContaining({ priceMinor: 990, priceBasis: 'kg' }));
  });

  it('extracts listing tiles with their actual brand, price, seller and stock', () => {
    const source = DISCOVERY_COLLECTIONS.find((entry) => entry.siteKey === 'carrefour_uae')!;
    const other = { ...tile, additionalAttributes: { ...tile.additionalAttributes, shopId: 'seller2', offerId: 'offer2', sellingPrice: 499 } };
    const products = parseDiscoveryListing(flight({ sections: [{ componentDTO: tile }, { componentDTO: other }, { componentDTO: tile }] }), source, '2026-10-26T18:00:00Z');
    expect(products).toHaveLength(2);
    expect(products[0]).toEqual(expect.objectContaining({ brand: 'Apple', priceMinor: 54900, url, availability: 'in_stock' }));
    expect(products[1].id).not.toBe(products[0].id);
    expect(products[1].url).toContain('sellerId=seller2');
  });

  it('rejects malformed or foreign tiles and keeps unavailable products out of stock', () => {
    const source = DISCOVERY_COLLECTIONS.find((entry) => entry.siteKey === 'carrefour_uae')!;
    const unavailable = { ...tile, additionalAttributes: { ...tile.additionalAttributes, stock: { value: 0, stockLevelStatus: 'outOfStock' } } };
    const foreign = { ...tile, additionalAttributes: { ...tile.additionalAttributes, productUrl: 'https://example.com/p/2202245' } };
    const missingOffer = { ...tile, additionalAttributes: { ...tile.additionalAttributes, offerId: undefined } };
    const result = parseDiscoveryListing('<script>self.__next_f.push(broken)</script>' + flight([unavailable, foreign, missingOffer]), source, '2026-10-26T18:00:00Z');
    expect(result).toHaveLength(1);
    expect(result[0].availability).toBe('out_of_stock');
  });
});

