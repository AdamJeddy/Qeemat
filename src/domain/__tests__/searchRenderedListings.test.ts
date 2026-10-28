import { parseRenderedSearch } from '../searchRenderedListings';

const observedAt = '2026-10-28T09:00:00Z';
describe('rendered retailer search', () => {
  it('keeps Amazon organic search cards separate from ads and unrelated recommendations', () => {
    const card = (asin: string, title: string, extraClass = '') => `<div data-asin="${asin}" data-component-type="s-search-result" class="s-result-item ${extraClass}"><h2>${title}</h2><span class="a-price"><span class="a-offscreen">AED 999.00</span></span></div>`;
    const body = card('B012345678', 'Organic phone') + card('B012345679', 'Paid phone', 'AdHolder') + '<div data-asin="B012345670"><h2>Recommendation phone</h2><span class="a-price"><span class="a-offscreen">AED 1.00</span></span></div>';
    expect(parseRenderedSearch(body, 'amazon_ae', observedAt)).toEqual([expect.objectContaining({ title: 'Organic phone', priceMinor: 99900, url: 'https://www.amazon.ae/dp/B012345678' })]);
  });
  it('reads Centrepoint search hits rather than unrelated cached recommendations', () => {
    const state = { algoliaProductReducer: { data: { hits: [{ pid: '1', title: 'Crème shoes', brand: 'Kappa', sale_price: 119, price: 199, url: '/buy-shoes/p/1', thumb_image: 'https://images.example/shoe.jpg' }] } }, recommendations: [{ title: 'Other item', price: 1 }] };
    const body = `<script id="__NEXT_DATA__">${JSON.stringify({ props: { initialState: require('buffer').Buffer.from(JSON.stringify(state)).toString('base64') } })}</script>`;
    expect(parseRenderedSearch(body, 'centrepoint_uae', observedAt)).toEqual([expect.objectContaining({ title: 'Crème shoes', priceMinor: 11900, url: 'https://www.centrepointstores.com/ae/en/buy-shoes/p/1' })]);
  });
  it('uses visible Sephora AED selling prices instead of dollar analytics or struck prices', () => {
    const html = '<div data-cnstrc-item-id="P100" data-cnstrc-item-name="L\'Eau Eau De Parfum" data-cnstrc-item-price="$100"><img alt="Fragrance" src="https://images.example/fragrance.jpg"><p class="line-through">AED 500.00</p><p class="font-bold uppercase">AED&nbsp;350.00</p><a href="/ae-en/p/example/P100?productVariantId=1"></a></div>';
    expect(parseRenderedSearch(html, 'sephora_uae', observedAt)).toEqual([expect.objectContaining({ title: "L'Eau Eau De Parfum", priceMinor: 35000 })]);
  });
  it('keeps Decathlon From prices and removes search analytics from the product URL', () => {
    const html = '<product-item><a href="/products/shoes?_pos=1"><img src="//images.example/shoe.jpg"></a><h2 class="product-item-meta-top">Kiprun</h2><h2 class="product-title">Running shoes</h2><span class="price price--highlight"><span>Sale price</span>From Dhs. 195.00</span><span class="price price--compare">Dhs. 300.00</span></product-item>';
    expect(parseRenderedSearch(html, 'decathlon_uae', observedAt)).toEqual([expect.objectContaining({ title: 'Running shoes', brand: 'Kiprun', priceMinor: 19500, hasPriceRange: true, url: 'https://decathlon.ae/products/shoes' })]);
  });
  it('uses Salomon sale prices and source product type without treating savings as the price', () => {
    const html = '<li class="product"><a class="card-title" href="/products/speedcross?_pos=1" data-product-title="SPEEDCROSS 3"></a><p>Trail Running Shoes</p><span class="price-item price-item--regular">AED 695.00</span><span class="price-item price-item--sale">AED 486.00</span><span>30% OFF</span></li>';
    expect(parseRenderedSearch(html, 'salomon_gcc', observedAt)).toEqual([expect.objectContaining({ title: 'SPEEDCROSS 3', priceMinor: 48600, searchCategory: 'Trail Running Shoes' })]);
  });
});
