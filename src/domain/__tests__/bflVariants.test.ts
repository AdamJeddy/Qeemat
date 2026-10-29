import { fetchAndParseProduct, parseProductHtml } from '../parser';
import { toVariantSelection } from '../variants';
import { fetchPageHtmlViaWebView } from '../webViewFetcher';

jest.mock('../webViewFetcher', () => ({ fetchPageHtmlViaWebView: jest.fn().mockResolvedValue(null) }));
const url = 'https://www.brandsforless.com/en-ae/running-shoes/2078248/p/';
const page = (sizes: string) => `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'Running shoes', image: 'https://f.bflcdn.com/shoe.jpg', offers: { url, price: 159, priceCurrency: 'AED', availability: 'https://schema.org/InStock' } })}</script><div id="product-detail"><div class="expiry_details_content_container">EU</div><ul class="size_list position-relative">${sizes}</ul></div>`;

describe('current BFL size choices', () => {
  beforeEach(() => { (fetchPageHtmlViaWebView as jest.Mock).mockReset().mockResolvedValue(null); });
  it('does not accept preloaded metadata before BFL size controls have rendered', async () => {
    const original = globalThis.fetch;
    const shell = page('').split('<div id="product-detail">')[0] + '<div id="root"><header>Storefront</header></div>';
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, url, text: async () => shell });
    (fetchPageHtmlViaWebView as jest.Mock).mockResolvedValueOnce(page('<li class="size_item">42</li>'));
    try { expect(await fetchAndParseProduct(url)).toEqual({ ok: true, product: expect.objectContaining({ variants: expect.any(Array) }) }); }
    finally { globalThis.fetch = original; }
  });
  it('loads a rendered BFL product when HTTP only returns the storefront shell', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, url, text: async () => '<html><head><meta property="og:title" content="Running shoes"></head><body><div id="root"><header>Storefront</header></div></body></html>' });
    (fetchPageHtmlViaWebView as jest.Mock).mockResolvedValueOnce(page('<li class="size_item">42</li>'));
    try { expect(await fetchAndParseProduct(url)).toEqual({ ok: true, product: expect.objectContaining({ priceMinor: 15900, variants: expect.any(Array) }) }); }
    finally { globalThis.fetch = original; }
  });
  it('does not mistake a normal Turnstile widget for a blocked product page', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, url, text: async () => page('<li class="size_item">42</li>') + '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>' });
    try { expect(await fetchAndParseProduct(url)).toEqual({ ok: true, product: expect.objectContaining({ priceMinor: 15900, variants: expect.any(Array) }) }); }
    finally { globalThis.fetch = original; }
  });
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
