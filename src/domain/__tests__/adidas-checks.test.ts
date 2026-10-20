import { fetchAndParseProduct } from '../parser';
import { fetchPageHtmlViaWebView } from '../webViewFetcher';

jest.mock('../webViewFetcher', () => ({
  fetchPageHtmlViaWebView: jest.fn()
}));

const productUrl = 'https://www.adidas.ae/en/adizero-adios-pro-4-shoes/JR1267.html';

// Reduced from the JR1267 product page captured for issue #53.
const productHtml = `
  <html><head>
    <link rel="canonical" href="${productUrl}" />
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "Product",
        "@id": "${productUrl}",
        "sku": "JR1267",
        "brand": "adidas",
        "name": "Adizero Adios Pro 4 Shoes",
        "image": ["https://assets.adidas.com/images/w_940,f_auto,q_auto/12e3b55f35874b1f90cbd69c2f2f07b5_9366/JR1267_HM1.jpg"],
        "offers": {
          "@type": "Offer",
          "priceCurrency": "AED",
          "price": 719.4,
          "availability": "InStock",
          "url": "${productUrl}"
        }
      }
    </script>
  </head></html>
`;

// The actual Adidas Akamai document uses this metadata instead of the
// "Access Denied / Reference #" wording used by other Akamai block pages.
const adidasBlockedHtml = `
  <!DOCTYPE html><html lang="en"><head><title>adidas</title>
    <script>
      window.utag_data = {
        "country": "AE",
        "page_name": "CPR 403 ERROR",
        "page_owner": "AKAMAI",
        "page_type": "ERROR"
      };
    </script>
    <link href="https://www.adidas.com/5280/WAFfailoverassets/style.css" rel="stylesheet" />
  </head><body>
    <h1>Unfortunately we are unable to give you access to our site at this time.</h1>
    <p>A security issue was automatically identified, when you tried to access the website.</p>
    <small>HTTP 403 - Forbidden</small>
  </body></html>
`;

describe('Adidas product checks (#53)', () => {
  const originalFetch = globalThis.fetch;
  const webViewFetchMock = jest.mocked(fetchPageHtmlViaWebView);

  beforeEach(() => {
    webViewFetchMock.mockReset();
    webViewFetchMock.mockResolvedValue(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('reads the reported JR1267 current product price from a successful product document', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: productUrl,
      text: async () => productHtml
    });

    const result = await fetchAndParseProduct(productUrl);

    expect(result).toEqual({
      ok: true,
      product: expect.objectContaining({
        title: 'Adizero Adios Pro 4 Shoes',
        sku: 'JR1267',
        canonicalUrl: productUrl,
        priceMinor: 71940,
        currency: 'AED',
        availability: 'in_stock'
      })
    });
  });

  it.each([adidasBlockedHtml, adidasBlockedHtml.replace(/\s*:\s*/g, ':')])('reports the Adidas Akamai error document as blocked with HTTP 200 (%#)', async (html) => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: productUrl,
      text: async () => html
    });

    expect(await fetchAndParseProduct(productUrl)).toEqual(
      expect.objectContaining({ ok: false, code: 'blocked' })
    );
  });

  it('follows the official share link redirect to the canonical product document', async () => {
    const shareUrl = 'https://adidas.onelink.me/ihha?pid=AppSharePDP&af_dp=adidas%3A%2F%2Fproduct%2FJR1267&af_web_dp=https%3A%2F%2Fwww.adidas.ae%2F-%2FJR1267.html';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: `${productUrl}?af_dp=adidas%3A%2F%2Fproduct%2FJR1267`,
      text: async () => productHtml
    });
    globalThis.fetch = fetchMock;

    expect(await fetchAndParseProduct(shareUrl)).toEqual({
      ok: true,
      product: expect.objectContaining({ canonicalUrl: productUrl, sku: 'JR1267', priceMinor: 71940 })
    });
    expect(fetchMock).toHaveBeenCalledWith(shareUrl, expect.any(Object));
  });

  it('accepts a valid product with Akamai ancillary scripts and product-page metadata', async () => {
    const html = productHtml.replace('</head>', `
      <script>window.utag_data = {"page_owner":"LITE","page_type":"PDP"};</script>
      <script src="https://example.akamaihd.net/boomerang.js"></script>
      </head>
    `);
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: productUrl,
      text: async () => html
    });

    expect(await fetchAndParseProduct(productUrl)).toEqual({
      ok: true,
      product: expect.objectContaining({ sku: 'JR1267', priceMinor: 71940, availability: 'in_stock' })
    });
  });

  it.each([
    ['Adidas Akamai error', adidasBlockedHtml],
    ['Akamai access denied', '<html><h1>Access Denied</h1><p>Reference #18.123456</p></html>']
  ])('reports %s documents from the WebView fallback as blocked', async (_description, html) => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    webViewFetchMock.mockResolvedValue(html);

    expect(await fetchAndParseProduct(productUrl)).toEqual(
      expect.objectContaining({ ok: false, code: 'blocked' })
    );
  });

  it('recovers a blocked native request when the WebView returns the real product document', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    webViewFetchMock.mockResolvedValue(productHtml);

    expect(await fetchAndParseProduct(productUrl)).toEqual({
      ok: true,
      product: expect.objectContaining({ sku: 'JR1267', priceMinor: 71940, currency: 'AED' })
    });
  });
});
