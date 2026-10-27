import { parseProductHtml } from '../parser';
import { toVariantSelection } from '../variants';

jest.mock('../webViewFetcher', () => ({ fetchPageHtmlViaWebView: jest.fn().mockResolvedValue(null) }));
const url = 'https://www.brandsforless.com/en-ae/running-shoes/2078248/p/';
const page = (sizes: string) => `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'Running shoes', image: 'https://f.bflcdn.com/shoe.jpg', offers: { url, price: 159, priceCurrency: 'AED', availability: 'https://schema.org/InStock' } })}</script><div id="product-detail"><div class="expiry_details_content_container">EU</div><ul class="size_list position-relative">${sizes}</ul></div>`;

describe('current BFL size choices', () => {
  it('requires a source-proven size and keeps its identity when the list is reordered', () => {
    const first = parseProductHtml('brands_for_less', url, page('<li class="size_item d-inline-block">42</li><li class="size_item d-inline-block">42.5<p class="size_quantity">3 left</p></li>'))!;
    expect(first.variants).toHaveLength(2);
    const chosen = first.variants![1];
    expect(chosen).toEqual(expect.objectContaining({ attributes: [{ name: 'Size (EU)', value: '42.5' }], priceMinor: 15900, availability: 'in_stock' }));
    const selection = toVariantSelection(chosen);
    expect(parseProductHtml('brands_for_less', url, page('<li class="size_item">42.5</li><li class="size_item">42</li>'), selection)).toEqual(expect.objectContaining({ selectedVariant: selection, priceMinor: 15900 }));
    expect(parseProductHtml('brands_for_less', url, page('<li class="size_item">42</li>'), selection)?.selectedVariant).toBeUndefined();
  });
  it('does not guess a page-level choice when a size selector has unrecognized markup', () => {
    expect(parseProductHtml('brands_for_less', url, page('<li class="size_item"><strong>Unknown option</strong></li>'))).toBeUndefined();
  });
});
