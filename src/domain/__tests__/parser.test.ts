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

  it('parses Amazon product buy-box markup', () => {
    const html = `
      <html>
        <head>
          <link rel="canonical" href="https://www.amazon.ae/Logitech-Headphones-Cancelling-Microphone-Chromebook/dp/B005BFCNYU/" />
        </head>
        <body>
          <div id="titleSection">
            <h1 id="title">
              <span id="productTitle" class="a-size-large product-title-word-break">
                Logitech H390 Wired Headset for PC/Laptop, Stereo Headphones with Noise Cancelling Microphone, USB-A, In-Line Controls, Works with Chromebook - Black
              </span>
            </h1>
          </div>
          <div id="corePriceDisplay_desktop_feature_div">
            <div class="a-section a-spacing-none aok-align-center aok-relative apex-core-price-identifier">
              <span class="a-price aok-align-center reinventPricePriceToPayMargin priceToPay apex-pricetopay-value" data-a-size="xl" data-a-color="base">
                <span class="a-offscreen"></span>
                <span aria-hidden="true">
                  <span class="a-price-symbol">AED</span>
                  <span class="a-price-whole">79<span class="a-price-decimal">.</span></span>
                  <span class="a-price-fraction">00</span>
                </span>
              </span>
            </div>
          </div>
          <div class="image item itemNo0 selected maintain-height cursorPointer variant-MAIN">
            <div role="button" tabindex="0" id="imgTagWrapperId" class="imgTagWrapper">
              <img
                id="landingImage"
                alt="Logitech H390 Wired Headset for PC/Laptop, Stereo Headphones with Noise Cancelling Microphone, USB-A, In-Line Controls, Works with Chromebook - Black"
                src="https://m.media-amazon.com/images/I/61NuT5tXQML._AC_SY300_SX300_QL70_ML2_.jpg"
                data-old-hires="https://m.media-amazon.com/images/I/61NuT5tXQML._AC_SL1500_.jpg"
              />
            </div>
          </div>
          <div id="availability" class="a-section a-spacing-base a-spacing-top-micro">
            <span class="a-size-medium a-color-success primary-availability-message"> In Stock </span>
          </div>
        </body>
      </html>
    `;

    const parsed = parseProductHtml('amazon_ae', amazonUrl, html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'amazon_ae',
        canonicalUrl: amazonUrl,
        title:
          'Logitech H390 Wired Headset for PC/Laptop, Stereo Headphones with Noise Cancelling Microphone, USB-A, In-Line Controls, Works with Chromebook - Black',
        sku: 'B005BFCNYU',
        imageUrl: 'https://m.media-amazon.com/images/I/61NuT5tXQML._AC_SL1500_.jpg',
        priceMinor: 7900,
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

  it('reports Amazon robot-check pages as blocked', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => `
        <!doctype html>
        <html>
          <body>
            <h1>Sorry, we just need to make sure you're not a robot</h1>
            <p>Enter the characters you see below</p>
          </body>
        </html>
      `
    })) as unknown as typeof fetch;

    const result = await fetchAndParseProduct(amazonUrl);

    expect(result).toEqual({
      ok: false,
      code: 'blocked',
      message: 'The website blocked this check.'
    });
  });
});
