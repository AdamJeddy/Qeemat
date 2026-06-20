import { fetchAndParseProduct, parseProductHtml } from '../parser';
import { detectSupportedSite } from '../sites';

const noonUrl =
  'https://www.noon.com/uae-en/galaxy-s25-ultra-ai-dual-sim-titanium-grey-12gb-ram-256gb-5g-middle-east-version/N70140492V/p/';
const amazonUrl = 'https://www.amazon.ae/Logitech-Headphones-Cancelling-Microphone-Chromebook/dp/B005BFCNYU/';

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

  it('parses Amazon product JSON-LD', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "Logitech H390 Wired Headset",
              "sku": "B005BFCNYU",
              "image": [
                "https://m.media-amazon.com/images/I/example.jpg"
              ],
              "offers": {
                "@type": "Offer",
                "price": "699.00",
                "priceCurrency": "AED",
                "availability": "https://schema.org/InStock",
                "url": "https://www.amazon.ae/Logitech-Headphones-Cancelling-Microphone-Chromebook/dp/B005BFCNYU/"
              }
            }
          </script>
        </head>
      </html>
    `;

    const parsed = parseProductHtml('amazon_ae', amazonUrl, html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'amazon_ae',
        title: 'Logitech H390 Wired Headset',
        sku: 'B005BFCNYU',
        priceMinor: 69900,
        currency: 'AED',
        availability: 'in_stock'
      })
    );
  });
});

describe('detectSupportedSite', () => {
  it('detects Amazon.ae product URLs', () => {
    expect(detectSupportedSite(amazonUrl)?.key).toBe('amazon_ae');
    expect(detectSupportedSite('https://www.amazon.ae/gp/product/B005BFCNYU')?.key).toBe('amazon_ae');
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
