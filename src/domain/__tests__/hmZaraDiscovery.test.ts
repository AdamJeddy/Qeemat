import { parseDiscoveryListing } from '../discoveryListings';
import { DISCOVERY_SOURCE_MAPS } from '../discoverySources';
import { buildSearchRequests, parseSearchPage } from '../discoverySearch';
import { SUPPORTED_SITES } from '../sites';

const now = '2026-11-06T00:00:00Z';
const hmTile = `<div class="product-item card" data-id="10000171002"><a class="product-item-link" aria-label="Puma Smash 3.0 L" href="/en/buy-puma-smash"></a><div class="product-image-container"><img src="https://media.alshaya.com/product.jpg"></div><div class="product-item-info"><a class="product-item-title" title="Puma Smash 3.0 L" href="/en/buy-puma-smash"><h6>Puma Smash 3.0 L</h6></a><div class="product-item-discount-price"><p class="item-price-discounted">&#xe001;&nbsp;150.00</p><p class="item-price-original-slashed">299.00</p></div></div></div>`;
const hmHtml = `<div class="algolia-product-listing"><div class="products-container columns-4">${hmTile}</div></div>`;
const zaraArticle = `<article class="product-grid-product__container"><figure><img src="https://static.zara.net/shirt.jpg"></figure><div class="product-grid-product-info__product-header"><a class="product-grid-product-info__name link" href="https://www.zara.com/ae/en/linen-shirt-p123.html"><h3>LINEN SHIRT</h3></a><span class="price-current"><data data-currency="AED" value="199.00">199 AED</data></span></div></article>`;
const zaraHtml = `<main><h2>Results</h2><input id="search-products-form-combo-input" value="linen shirt">${zaraArticle}</main>`;

test('exposes both retailers in tracking and maps relevant discovery interests', () => {
 for (const key of ['hm_uae','zara_uae'] as const) {
  expect(SUPPORTED_SITES.find(site=>site.key===key)?.status).toBe('supported');
  const categories = DISCOVERY_SOURCE_MAPS.filter(source=>source.siteKey===key).map(source=>source.category);
  expect(categories).toEqual(expect.arrayContaining(['clothing','footwear','bags','accessories']));
 }
});
test('reads H&M discounted tiles with their own image and product URL', () => {
 const source=DISCOVERY_SOURCE_MAPS.find(x=>x.siteKey==='hm_uae')!;
 expect(parseDiscoveryListing(hmHtml,source,now)).toEqual([expect.objectContaining({id:'hm_uae:10000171002',title:'Puma Smash 3.0 L',priceMinor:15000,imageUrl:'https://media.alshaya.com/product.jpg',url:'https://ae.hm.com/en/buy-puma-smash'})]);
});
test('does not use a recommendation price for an incomplete H&M card', () => {
 const source = DISCOVERY_SOURCE_MAPS.find(x => x.siteKey === 'hm_uae')!;
 const incomplete = hmTile.replace(/<div class="product-item-discount-price">[\s\S]*?<\/div>/, '');
 const html = `<div class="algolia-product-listing">${incomplete}<div><p class="item-price">42.00</p></div></div>`;
 expect(parseDiscoveryListing(html, source, now)).toEqual([]);
});
test('reads Zara listing image, price and source URL together', () => {
 const source=DISCOVERY_SOURCE_MAPS.find(x=>x.siteKey==='zara_uae')!;
 expect(parseDiscoveryListing(zaraHtml,source,now)).toEqual([expect.objectContaining({title:'LINEN SHIRT',priceMinor:19900,imageUrl:'https://static.zara.net/shirt.jpg'})]);
});
test('matches Zara lazy-loaded images to separate product details by retailer product ID', () => {
 const source = DISCOVERY_SOURCE_MAPS.find(x => x.siteKey === 'zara_uae')!;
 const productUrl = 'https://www.zara.com/ae/en/linen-shirt-p123.html';
 const payload = { products: [{ id: 123, name: 'LINEN SHIRT', detail: { colors: [{ productId: 123, xmedia: [{ type: 'image', extraInfo: { deliveryUrl: 'https://static.zara.net/assets/shirt.jpg?ts=1' } }] }] } }] };
 const html = `<script>window.zara.viewPayload = ${JSON.stringify(payload)};</script><li class="product-grid-product _product" data-productid="123"><article class="product-grid-product__container"><figure><a class="product-grid-product__link" href="${productUrl}"><img src="https://static.zara.net/stdstatic/10/images/transparent-background.png"></a></figure></article></li><div class="product-grid-product-info__product-header"><a class="product-grid-product-info__name" href="${productUrl}"><h3>LINEN SHIRT</h3></a><span class="price-current"><data data-currency="AED" value="199.00">199 AED</data></span></div>`;
 expect(parseDiscoveryListing(html, source, now)).toEqual([expect.objectContaining({ title: 'LINEN SHIRT', imageUrl: 'https://static.zara.net/assets/shirt.jpg?ts=1&w=352', priceMinor: 19900 })]);
});
test('includes H&M and all Zara audience search requests and rejects suggestion-only pages', () => {
 const requests=buildSearchRequests('linen shirt');
 expect(requests.find(x=>x.siteKey==='hm_uae')?.url).toBe('https://ae.hm.com/en/search?q=linen%20shirt');
 const zara=requests.filter(x=>x.siteKey==='zara_uae');
 expect(zara.map(x=>x.url)).toEqual(['WOMAN','MAN','KIDS','HOME'].map(section=>`https://www.zara.com/ae/en/search?searchTerm=linen%20shirt&section=${section}`));
 expect(parseSearchPage(`<main><h2>You might be interested in</h2>${zaraArticle}</main>`,zara[0],'linen shirt',now)).toBeUndefined();
 expect(parseSearchPage(zaraHtml,zara[0],'linen shirt',now)?.products).toHaveLength(1);
});
test.each([
  ['men\'s jeans', '"men\'s jeans"'],
  ['men\'s jeans', '"men&#39;s jeans"'],
  ['"linen" shirt', '\'"linen" shirt\'']
])('accepts the complete Zara search term %s from value=%s', (query, value) => {
 const request = buildSearchRequests(query).find(x => x.siteKey === 'zara_uae')!;
 const product = zaraArticle.replace('LINEN SHIRT', query.toUpperCase());
 const body = `<input id="search-products-form-combo-input" value=${value}>${product}`;
 expect(parseSearchPage(body, request, query, now)?.products).toHaveLength(1);
});
