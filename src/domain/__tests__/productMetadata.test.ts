import { extractProductMetadata } from '../productMetadata';
import { inferWatchlistCategory } from '../watchlistDiscovery';

test('extracts product JSON-LD and ordered breadcrumbs without including the product title', () => {
  const html = `<script type="application/ld+json">{"@graph":[{"@type":"Product","name":"Everyday runner","category":"Shoes","brand":{"name":"Example"},"material":"Mesh"},{"@type":"BreadcrumbList","itemListElement":[{"position":2,"name":"Shoes"},{"position":1,"name":"Women"},{"position":3,"name":"Everyday runner"}]}]}</script>`;
  const metadata = extractProductMetadata('nike_uae', html, 'Everyday runner');
  expect(metadata).toEqual({ categoryPath: ['Women', 'Shoes'], brand: 'Example', attributes: { material: 'Mesh' } });
  expect(inferWatchlistCategory({ title: 'Everyday runner', url: '', canonicalUrl: '', sourceMetadata: metadata })).toBe('footwear');
});

test('uses the scoped Shopify product payload for its exact product type', () => {
  const html = `<script id="ProductJson" type="application/json">{"title":"MH100","product_type":"Trekking trousers","vendor":"Quechua"}</script><script>{"product_type":"Shoes"}</script>`;
  expect(extractProductMetadata('decathlon_uae', html, 'MH100')).toEqual({ productType: 'Trekking trousers', brand: 'Quechua' });
});

test('does not take taxonomy from unrelated embedded recommendation data', () => {
  expect(extractProductMetadata('noon', '<script>{"recommendations":[{"category":"Footwear","product_type":"Shoes"}]}</script>', 'Phone')).toBeUndefined();
});

test('manual category and explicit opt-out take precedence over source metadata', () => {
  const product = { title: 'X', url: '', canonicalUrl: '', sourceMetadata: { categoryPath: ['Footwear'] } };
  expect(inferWatchlistCategory({ ...product, category: 'clothing' })).toBe('clothing');
  expect(inferWatchlistCategory({ ...product, categoryExcluded: true })).toBeUndefined();
});

test('attaches retailer metadata to a successfully parsed product', () => {
  const { parseProductHtml } = require('../parser');
  const url = 'https://www.nike.ae/en/example.html';
  const html = `<script type="application/ld+json">{"@type":"Product","name":"Everyday runner","category":"Shoes","brand":{"name":"Example"},"offers":{"price":"100","priceCurrency":"AED","availability":"https://schema.org/InStock"}}</script>`;
  expect(parseProductHtml('nike_uae', url, html)).toEqual(expect.objectContaining({ sourceMetadata: { categoryPath: ['Shoes'], brand: 'Example' } }));
});

test('extracts H&M product type and garment attributes from the product description', () => {
  const html = `<ul><li class="pdp-product-description__attribute--presentation_product_type"><div>Presentation Product Type</div><span>Sweatshirt</span></li><li class="pdp-product-description__attribute--sleeve_length"><div>Sleeve Length</div><span>Long sleeve</span></li></ul>`;
  expect(extractProductMetadata('hm_uae', html, 'Printed sweatshirt')).toEqual({ productType: 'Sweatshirt', attributes: { sleeve_length: 'Long sleeve' } });
});

test('reads Zara ProductGroup metadata without substituting a variant color', () => {
  const html = `<script type="application/ld+json">{"@type":"ProductGroup","name":"Dress","brand":{"name":"ZARA"},"material":"lyocell/viscose","hasVariant":[{"@type":"Product","color":"Black"}]}</script>`;
  expect(extractProductMetadata('zara_uae', html, 'Dress')).toEqual({ brand: 'ZARA', attributes: { material: 'lyocell/viscose' } });
});

test('uses a product category when breadcrumbs contain only Home and the product', () => {
  const html = `<script type="application/ld+json">[{"@type":"ProductGroup","name":"MT100","category":"Zip off trousers"},{"@type":"BreadcrumbList","itemListElement":[{"position":1,"name":"Home"},{"position":2,"name":"MT100"}]}]</script>`;
  const metadata = extractProductMetadata('decathlon_uae', html, 'MT100');
  expect(metadata?.categoryPath).toEqual(['Zip off trousers']);
  expect(inferWatchlistCategory({ title: 'MT100', url: '', canonicalUrl: '', sourceMetadata: metadata })).toBe('clothing');
});

test('reads WooCommerce product breadcrumbs without splitting a category containing a slash', () => {
  const html = `<nav class="woocommerce-breadcrumb"><a href="/">Home</a> / <a href="/on-road/">ON ROAD</a> / <a href="/helmets/">Helmets</a> / <a href="/modular/">Modular/Flip-up</a> / N120-1</nav>`;
  expect(extractProductMetadata('ay_accessories', html, 'N120-1')).toEqual({ categoryPath: ['ON ROAD', 'Helmets', 'Modular/Flip-up'] });
});

test('does not associate a recommended product schema with the tracked product', () => {
  const html = `<script type="application/ld+json">[{"@type":"Product","name":"Unrelated shoe","category":"Shoes"},{"@type":"Product","name":"Galaxy phone","category":"Mobile Phones"}]</script>`;
  expect(extractProductMetadata('noon', html, 'Galaxy phone')).toEqual({ categoryPath: ['Mobile Phones'] });
  expect(extractProductMetadata('noon', html, 'Unrelated tablet')).toBeUndefined();
});

test('matches product schema names in non-Latin scripts', () => {
  const html = `<script type="application/ld+json">{"@type":"Product","name":"ワイヤレス ヘッドホン","category":"Headphones"}</script>`;
  expect(extractProductMetadata('amazon_ae', html, 'ワイヤレス ヘッドホン')).toEqual({ categoryPath: ['Headphones'] });
});

const retailerKeys = ['noon', 'carrefour_uae', 'nike_uae', 'sun_sand_sports', 'level_shoes', 'ay_accessories', 'ounass', 'amazon_ae', 'adidas', 'puma_uae', 'decathlon_uae', 'salomon_gcc', 'sephora_uae', 'faces_uae', 'centrepoint_uae', 'namshi', 'the_deal', 'sharaf_dg', 'brands_for_less', 'hm_uae', 'zara_uae'] as const;
test('covers every supported retailer in the shared metadata extractor', () => {
  const { SUPPORTED_SITES } = require('../sites');
  expect(retailerKeys.slice().sort()).toEqual(SUPPORTED_SITES.map((site: { key: string }) => site.key).sort());
  for (const siteKey of retailerKeys) {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"Sample shoe","category":"Shoes"}</script>`;
    expect(extractProductMetadata(siteKey, html, 'Sample shoe')).toEqual({ categoryPath: ['Shoes'] });
  }
});

test('uses an enriched matching product-page heading as a category hint, not a claimed product type', () => {
  const html = `<h1>Nike Club Men&#39;s Oversized Fleece Trousers</h1><script type="application/ld+json">{"@type":"Product","name":"Nike Club","brand":{"name":"Nike"}}</script>`;
  const metadata = extractProductMetadata('nike_uae', html, 'Nike Club');
  expect(metadata).toEqual({ displayName: "Nike Club Men's Oversized Fleece Trousers", brand: 'Nike' });
  expect(inferWatchlistCategory({ title: 'Nike Club', url: '', canonicalUrl: '', sourceMetadata: metadata })).toBe('clothing');
  expect(extractProductMetadata('nike_uae', '<h1>Recommended shoes</h1>', 'Nike Club')).toBeUndefined();
});

test('does not match a short generic recommendation inside a product title', () => {
  const html = `<script type="application/ld+json">{"@type":"Product","name":"Hat","category":"Accessories"}</script>`;
  expect(extractProductMetadata('noon', html, 'Hatchback toy car')).toBeUndefined();
});

test('drops a page color that conflicts with the selected product variant', () => {
  const { metadataForVariant } = require('../productMetadata');
  const metadata = { brand: 'Example', attributes: { color: 'Black', material: 'Cotton' } };
  expect(metadataForVariant(metadata, { id: 'blue', label: 'Blue', attributes: [{ name: 'Color', value: 'Blue' }] }))
    .toEqual({ brand: 'Example', attributes: { material: 'Cotton' } });
  expect(metadataForVariant(metadata, { id: 'size', label: 'M', attributes: [{ name: 'Size', value: 'M' }] })).toEqual(metadata);
});
