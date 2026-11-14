import { parseProductHtml } from '../parser';
import { detectSupportedSite } from '../sites';

const url = 'https://www.zara.com/ae/en/strappy-maxi-dress-p02488721.html?v1=566273592';
const product = {
  '@type': 'ProductGroup', name: 'STRAPPY LONG DRESS', productGroupID: '02488721',
  hasVariant: [
    { '@type': 'Product', sku: '566273592-839-1', color: 'Black', size: 'XS', offers: { price: '449', priceCurrency: 'AED', availability: 'https://schema.org/InStock', url } },
    { '@type': 'Product', sku: '566273592-839-2', color: 'Black', size: 'S', offers: { price: '399', priceCurrency: 'AED', availability: 'https://schema.org/OutOfStock', url } }
  ]
};
const html = `<script type="application/ld+json">${JSON.stringify(product)}</script>`;

test('recognizes Zara UAE and resolves the selected source size', () => {
  expect(detectSupportedSite(url)?.key).toBe('zara_uae');
  const result = parseProductHtml('zara_uae', url, html);
  expect(result?.variants).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: '566273592-839-1', label: 'Color: Black · Size: XS', priceMinor: 44900, availability: 'in_stock' }),
    expect.objectContaining({ id: '566273592-839-2', priceMinor: 39900, availability: 'out_of_stock' })
  ]));
  const selection = { id: '566273592-839-2', label: 'Black S', attributes: [{ name: 'Color', value: 'Black' }, { name: 'Size', value: 'S' }], url };
  expect(parseProductHtml('zara_uae', url, html, selection)).toEqual(expect.objectContaining({ availability: 'out_of_stock', selectedVariant: selection }));
});

test('does not substitute another size when a saved SKU disappears', () => {
  const missing = { id: 'missing-sku', label: 'Size: M', attributes: [{ name: 'Color', value: 'Black' }, { name: 'Size', value: 'M' }] };
  expect(parseProductHtml('zara_uae', url, html, missing)?.selectedVariant).toBeUndefined();
});

test('does not invent a size price from another offer', () => {
  const noPrice = { ...product, hasVariant: [{ '@type': 'Product', sku: 'other', color: 'Black', size: 'M', offers: { priceCurrency: 'AED', availability: 'https://schema.org/InStock' } }] };
  expect(parseProductHtml('zara_uae', url, `<script type="application/ld+json">${JSON.stringify(noPrice)}</script>`)).toBeUndefined();
});

import { parseDiscoveryListing } from '../discoveryListings';
import { DISCOVERY_SOURCE_MAPS } from '../discoverySources';

test('reads Zara listing title, AED price, and retailer URL from the product header', () => {
  const source = DISCOVERY_SOURCE_MAPS.find((item) => item.id === 'zara_uae-women-dresses')!;
  const listing = `<div class="product-grid-product-info__product-header"><div class="product-grid-product-info__main-info"><a class="product-link _item product-grid-product-info__name link" data-qa-action="product-click" href="https://www.zara.com/ae/en/stretch-midi-dress-with-slit-p06050814.html"><h3>STRETCH MIDI DRESS WITH SLIT</h3></a></div><div class="product-grid-product-info__product-price price"><span class="price-current"><data data-currency="AED" value="199.00">199.00 AED</data></span></div></div>`;
  expect(parseDiscoveryListing(listing, source, '2026-11-06T00:00:00Z')).toEqual([expect.objectContaining({ title: 'STRETCH MIDI DRESS WITH SLIT', priceMinor: 19900, currency: 'AED', siteKey: 'zara_uae' })]);
});

import { fetchAndParseProduct } from '../parser';
import { fetchPageHtmlViaWebView } from '../webViewFetcher';

jest.mock('../webViewFetcher', () => ({ fetchPageHtmlViaWebView: jest.fn() }));

test('uses the Android WebView when the storefront blocks the network client', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = jest.fn().mockResolvedValue({ status: 403, ok: false }) as jest.Mock;
  (fetchPageHtmlViaWebView as jest.Mock).mockResolvedValueOnce(html);
  try {
    const result = await fetchAndParseProduct(url);
    expect(fetchPageHtmlViaWebView).toHaveBeenCalledWith(url);
    expect(result).toEqual(expect.objectContaining({ ok: true, product: expect.objectContaining({ siteKey: 'zara_uae' }) }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('tracks a Zara fragrance with a size but no colour', () => {
 const fragrance={...product,name:'GOLDEN DECADE EDP',hasVariant:[{'@type':'Product',sku:'545456605-999-99',color:'',size:'ONE SIZE ONLY',offers:{price:'139',priceCurrency:'AED',availability:'https://schema.org/InStock',url}}]};
 const parsed=parseProductHtml('zara_uae',url,`<script type="application/ld+json">${JSON.stringify(fragrance)}</script>`);
 expect(parsed?.variants).toEqual([expect.objectContaining({id:'545456605-999-99',priceMinor:13900,attributes:[{name:'Size',value:'ONE SIZE ONLY'}]})]);
});
