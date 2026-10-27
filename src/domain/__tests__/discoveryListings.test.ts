import { DISCOVERY_COLLECTIONS, DiscoveryCollection } from '../discovery';
import { parseDiscoveryListing } from '../discoveryListings';

const observedAt = '2026-10-25T15:00:00Z';
const source = (siteKey: DiscoveryCollection['siteKey']) => DISCOVERY_COLLECTIONS.find((item) => item.siteKey === siteKey && (siteKey !== 'ounass' || item.category === 'skincare'))!;

describe('retailer listing extraction', () => {
  it('reads current BFL rendered product cards and ignores sizes and RRP in the selling price', () => {
    const html = '<a class="hover_view_content" href="/en-ae/running-shoes/2078248/p/?origin=PLP&amp;queryId=test"><div class="content_image"><img src="https://f.bflcdn.com/shoe.jpg" alt="Running shoes"></div><ul class="products_size_list"><li>42</li><li>43</li></ul><div class="item_description_wrapper"><h5 class="pdp_brand">Skechers</h5><h1 class="product_title">Running shoes</h1><div class="price_slab"><p class="item_price"><span class="price">AED 159</span></p><span class="rrp">RRP:AED 415</span></div></div></a>';
    expect(parseDiscoveryListing(html, source('brands_for_less'), observedAt)).toEqual([expect.objectContaining({ id: 'brands_for_less:2078248', title: 'Running shoes', brand: 'Skechers', priceMinor: 15900, url: 'https://www.brandsforless.com/en-ae/running-shoes/2078248/p/' })]);
  });
  it('reads Sharaf DG rendered category cards using the selling price and pinned offer', () => {
    const html = '<script type="application/ld+json">{"@type":"Product","name":"Unrelated recommendation","url":"/product/other/","offers":{"price":1}}</script><div id="hits"><div class="algolia-item"><a href="//uae.sharafdg.com/product/phone/?promo=123" class="ratio-box product-link" data-objectid="456" data-sku="SKU1" data-sku-promo="SKU1--123" data-brand="Apple" data-originalprice="5099"><img src="//images.example/phone.jpg"><h4 class="name">Apple phone 256GB</h4><div class="product-price"><div class="price"><span class="currency_symbol">D</span>&nbsp;4,498.00</div><div class="old-price">5,099.00</div></div></a></div></div>';
    expect(parseDiscoveryListing(html, source('sharaf_dg'), observedAt)).toEqual([expect.objectContaining({ title: 'Apple phone 256GB', brand: 'Apple', priceMinor: 449800, url: 'https://uae.sharafdg.com/product/phone/?promo=123' })]);
  });
  it('does not turn an empty Sharaf DG grid into unrelated recommendation results', () => {
    const html = '<div id="hits"></div><script type="application/ld+json">{"@type":"Product","name":"Recommendation","url":"/product/other/","offers":{"price":1}}</script>';
    expect(parseDiscoveryListing(html, source('sharaf_dg'), observedAt)).toEqual([]);
  });
  it('reads Amazon department product cards without requiring search-result image classes', () => {
    const html = '<div id="acsProductBlockV1-0" data-asin="B0DN6Q5MWG"><a href="/dp/B0DN6Q5MWG"><img alt="Diapers Size 4" src="https://images.example/diapers.jpg"></a><span class="a-price" data-a-size="l"><span class="a-offscreen">AED 21.93</span></span></div><div data-asin="B0DN6Q5MWH"><img alt="No price" src="https://images.example/other.jpg"></div>';
    expect(parseDiscoveryListing(html, source('amazon_ae'), observedAt)).toEqual([expect.objectContaining({ title: 'Diapers Size 4', priceMinor: 2193, imageUrl: 'https://images.example/diapers.jpg', url: 'https://www.amazon.ae/dp/B0DN6Q5MWG' })]);
  });
  it('reads a department carousel selling price without substituting its old list price', () => {
    const html = '<li class="a-carousel-card dcl-carousel-element"><div data-csa-c-item-type="asin"><a href="/book/dp/1915381061?ref=example"><img alt="" src="https://images.example/book.jpg"><span class="dcl-product-label"><span>Example book</span></span><span class="a-price dcl-product-price-new"><span class="a-offscreen">AED 112.03</span></span><span class="a-price a-text-price dcl-product-price-old"><span class="a-offscreen">AED 146.94</span></span></a></div></li>';
    expect(parseDiscoveryListing(html, source('amazon_ae'), observedAt)).toEqual([expect.objectContaining({ title: 'Example book', priceMinor: 11203 })]);
  });
  it('reads the selling price from a Salesforce tile without subtracting its discount twice', () => {
    const html = `<div class="product" data-pid="NB123"><div class="product-tile"
      data-gtm-enhanced-ecommerce-impression="{&quot;item_name&quot;:&quot;Men's 530 Shoes&quot;,&quot;item_brand&quot;:&quot;New Balance&quot;,&quot;price&quot;:379,&quot;discount&quot;:220}">
      <a href="/new-balance-530/NB123.html"><img alt="530 Shoes" src="https://images.example/530.jpg"></a>
      <span class="sales"><span class="value" content="379.00">AED 379</span></span><del>AED 599</del></div></div>`;
    expect(parseDiscoveryListing(html, source('sun_sand_sports'), observedAt)).toEqual([expect.objectContaining({
      title: "Men's 530 Shoes", brand: 'New Balance', priceMinor: 37900,
      url: 'https://en-ae.sssports.com/new-balance-530/NB123.html'
    })]);
  });

  it('reads nested collection JSON-LD, resolves relative URLs, and rejects external product URLs', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'ItemList', itemListElement: [
      { item: { '@type': 'Product', name: 'Serum', url: '/serum.html', image: '//images.example/serum.jpg', offers: { price: 125, priceCurrency: 'AED' } } },
      { item: { '@type': 'Product', name: 'External', url: 'https://example.com/p', offers: { price: 1 } } }
    ] })}</script>`;
    expect(parseDiscoveryListing(html, source('ounass'), observedAt)).toEqual([expect.objectContaining({
      title: 'Serum', category: 'skincare', priceMinor: 12500, url: 'https://www.ounass.ae/serum.html', imageUrl: 'https://images.example/serum.jpg'
    })]);
  });

  it('reads Level Shoes product-list state with the retail brand and current price', () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { products: [
      { id: 42, name: 'Sneakers', brandName: 'Nike', rawSalePrice: 600, rawOriginalPrice: 800, isInStock: true, action: { url: '/sneakers.html' }, image: { url: 'https://images.example/p.jpg' } }
    ] } } })}</script>`;
    expect(parseDiscoveryListing(html, source('level_shoes'), observedAt)[0]).toMatchObject({ brand: 'Nike', priceMinor: 60000, availability: 'in_stock' });
  });

  it('reads Namshi Flight data without executing its remote scripts', () => {
    const data = { parentSku: 'Z1', sku: 'Z1-1', uri: '/buy-nike-shoes/Z1/p/', title: 'Shoes', brand: 'Nike', normalPrice: 399, salePrice: 199, imageKeys: ['p/shoes.jpg'] };
    const html = `<script>self.__next_f.push(${JSON.stringify([1, `1:${JSON.stringify(data)}\n`])})</script>`;
    expect(parseDiscoveryListing(html, source('namshi'), observedAt)[0]).toMatchObject({ priceMinor: 19900, url: 'https://www.namshi.com/uae-en/buy-nike-shoes/Z1/p/', brand: 'Nike' });
  });

  it('reads Sephora variant price ranges from the current featured products', () => {
    const data = { id: 'P123', name: 'Fragrance', c_productSlug: '/fragrance/P123', c_brand: { name: 'Dior' }, c_variantsInfo: [
      { price: 250, images: [{ disBaseLink: 'https://images.example/perfume.jpg' }] }, { price: 375 }
    ] };
    const html = `<script>self.__next_f.push(${JSON.stringify([1, `1:${JSON.stringify(data)}\n`])})</script>`;
    expect(parseDiscoveryListing(html, source('sephora_uae'), observedAt)[0]).toMatchObject({ priceMinor: 25000, hasPriceRange: true, brand: 'Dior', category: 'makeup' });
  });

  it('uses WooCommerce minor currency units and excludes malformed or free records', () => {
    const payload = [{ id: 1, name: 'Helmet', permalink: 'https://ay-accessories.com/product/helmet/', prices: { price: '54300', currency_minor_unit: 2, currency_code: 'AED' }, is_in_stock: true },
      { id: 2, name: 'Bad', permalink: 'https://ay-accessories.com/product/bad/', prices: { price: 'bad' } }];
    expect(parseDiscoveryListing(JSON.stringify(payload), source('ay_accessories'), observedAt)).toEqual([expect.objectContaining({ priceMinor: 54300 })]);
  });

  it('retains 100 usable products from a larger feed instead of truncating it at 48', () => {
    const payload = Array.from({ length: 120 }, (_, index) => ({
      id: index + 1, name: `Helmet ${index + 1}`, permalink: `https://ay-accessories.com/product/helmet-${index + 1}/`,
      prices: { price: '54300', currency_minor_unit: 2, currency_code: 'AED' }, is_in_stock: true
    }));
    const products = parseDiscoveryListing(JSON.stringify(payload), source('ay_accessories'), observedAt);
    expect(products).toHaveLength(100);
    expect(products[99].title).toBe('Helmet 100');
  });

  it('treats a challenge page as unavailable supply rather than a successful empty refresh', () => {
    expect(parseDiscoveryListing('<html><title>Just a moment...</title>Cloudflare challenge</html>', source('brands_for_less'), observedAt)).toEqual([]);
  });

  it('reads Salomon Shopify products with Salomon product links', () => {
    const payload = { products: [{ id: 1, title: 'XT-6', vendor: 'Salomon', handle: 'xt6', variants: [{ price: '875.00', available: true }] }] };
    expect(parseDiscoveryListing(JSON.stringify(payload), source('salomon_gcc'), observedAt)[0]).toMatchObject({ siteKey: 'salomon_gcc', priceMinor: 87500, url: 'https://salomongcc.com/products/xt6' });
  });

  it('reads rendered Noon tiles on Android after the page consumes its inline state', () => {
    const html = `<div class="box" data-qa="plp-product-box"><a href="/uae-en/earbuds/N123V/p/">
      <div data-qa="productImagePLP_Earbuds"><img src="https://images.example/earbuds.jpg"></div>
      <h2 data-qa="plp-product-box-name" title="Apple Earbuds">Apple Earbuds</h2>
      <div data-qa="plp-product-box-price"><strong>759.00</strong><del>949</del></div></a></div>`;
    expect(parseDiscoveryListing(html, source('noon'), observedAt)[0]).toMatchObject({ brand: 'Apple', title: 'Earbuds', priceMinor: 75900, url: 'https://www.noon.com/uae-en/earbuds/N123V/p/' });
  });
});
