import { fetchAndParseProduct, parseProductHtml } from '../parser';

const noonUrl =
  'https://www.noon.com/uae-en/galaxy-s25-ultra-ai-dual-sim-titanium-grey-12gb-ram-256gb-5g-middle-east-version/N70140492V/p/';

describe('parseProductHtml', () => {
  it('parses Noon product JSON-LD with multiple offers', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "Galaxy S25 Ultra AI Dual SIM Titanium Grey 12GB RAM 256GB 5G - Middle East Version",
              "sku": "N70140492V",
              "image": [
                "https://f.nooncdn.com/p/pzsku/example.jpg?width=1200"
              ],
              "offers": [
                {
                  "@type": "Offer",
                  "price": "2999.00",
                  "priceCurrency": "AED",
                  "availability": "https://schema.org/InStock",
                  "url": "https://www.noon.com/uae-en/galaxy-s25-ultra-ai-dual-sim-titanium-grey-12gb-ram-256gb-5g-middle-east-version/N70140492V/p/"
                },
                {
                  "@type": "Offer",
                  "price": "3049.00",
                  "priceCurrency": "AED",
                  "availability": "https://schema.org/InStock"
                }
              ]
            }
          </script>
        </head>
      </html>
    `;

    const parsed = parseProductHtml('noon', noonUrl, html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'noon',
        title: 'Galaxy S25 Ultra AI Dual SIM Titanium Grey 12GB RAM 256GB 5G - Middle East Version',
        sku: 'N70140492V',
        priceMinor: 299900,
        currency: 'AED',
        availability: 'in_stock'
      })
    );
  });
});

describe('fetchAndParseProduct', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('reports browser challenge pages as blocked even when the response is 200', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => `
        <!doctype html>
        <html>
          <body>
            <div id="sec-if-cpt-container"></div>
            <p>Powered and protected by Akamai</p>
          </body>
        </html>
      `
    })) as unknown as typeof fetch;

    const result = await fetchAndParseProduct(noonUrl);

    expect(result).toEqual({
      ok: false,
      code: 'blocked',
      message: 'The website blocked this check.'
    });
  });
});
