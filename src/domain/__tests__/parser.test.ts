import { fetchAndParseProduct, parseProductHtml } from '../parser';
import { parsePriceToMinor } from '../price';
import { detectSupportedSite } from '../sites';

const noonUrl =
  'https://www.noon.com/uae-en/galaxy-s25-ultra-ai-dual-sim-titanium-grey-12gb-ram-256gb-5g-middle-east-version/N70140492V/p/';
const aymUrl = 'https://ay-accessories.com/product/nolan-n120-1-classico-nobile-n-com-modular-helmet/';
const ounassUrl = 'https://www.ounass.ae/shop-givenchy-beauty-gentleman-givenchy-eau-de-parfum-boisee-200ml-for-men-1216083751_242.html';
const amazonUrl = 'https://www.amazon.ae/Logitech-Headphones-Cancelling-Microphone-Chromebook/dp/B005BFCNYU/';
const amazonUsUrl = 'https://www.amazon.com/Logitech-Headphones-Cancelling-Microphone-Chromebook/dp/B005BFCNYU/';
const amazonDeUrl = 'https://www.amazon.de/Logitech-Headphones-Cancelling-Microphone-Chromebook/dp/B005BFCNYU/';

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

  it('falls back to Amazon dynamic-image markup when old-hires is missing', () => {
    const html = `
      <html>
        <head>
          <link rel="canonical" href="https://www.amazon.ae/Logitech-Headphones-Cancelling-Microphone-Chromebook/dp/B005BFCNYU/" />
        </head>
        <body>
          <div id="titleSection">
            <h1 id="title">
              <span id="productTitle">Logitech H390 Wired Headset</span>
            </h1>
          </div>
          <div id="corePriceDisplay_desktop_feature_div">
            <span class="a-price aok-align-center reinventPricePriceToPayMargin priceToPay apex-pricetopay-value">
              <span aria-hidden="true">
                <span class="a-price-symbol">AED</span>
                <span class="a-price-whole">79<span class="a-price-decimal">.</span></span>
                <span class="a-price-fraction">00</span>
              </span>
            </span>
          </div>
          <img
            id="landingImage"
            src="https://m.media-amazon.com/images/I/61NuT5tXQML._AC_SY300_SX300_QL70_ML2_.jpg"
            data-a-dynamic-image="{&quot;https://m.media-amazon.com/images/I/61NuT5tXQML._AC_SY355_.jpg&quot;:[355,355],&quot;https://m.media-amazon.com/images/I/61NuT5tXQML._AC_SX679_.jpg&quot;:[679,679]}"
          />
          <div id="availability">
            <span class="a-size-medium a-color-success primary-availability-message"> In Stock </span>
          </div>
        </body>
      </html>
    `;

    const parsed = parseProductHtml('amazon_ae', amazonUrl, html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'amazon_ae',
        imageUrl: 'https://m.media-amazon.com/images/I/61NuT5tXQML._AC_SX679_.jpg',
        priceMinor: 7900,
        currency: 'AED',
        availability: 'in_stock'
      })
    );
  });

  it('parses Amazon.com prices in USD', () => {
    const html = `
      <html>
        <head>
          <link rel="canonical" href="https://www.amazon.com/Logitech-Headphones-Cancelling-Microphone-Chromebook/dp/B005BFCNYU/" />
        </head>
        <body>
          <div id="titleSection">
            <h1 id="title">
              <span id="productTitle">Logitech H390 Wired Headset</span>
            </h1>
          </div>
          <div id="corePriceDisplay_desktop_feature_div">
            <span class="a-price aok-align-center reinventPricePriceToPayMargin priceToPay apex-pricetopay-value">
              <span class="a-offscreen">$79.99</span>
            </span>
          </div>
          <img
            id="landingImage"
            src="https://m.media-amazon.com/images/I/61NuT5tXQML._AC_SY300_SX300_QL70_ML2_.jpg"
            data-old-hires="https://m.media-amazon.com/images/I/61NuT5tXQML._AC_SL1500_.jpg"
          />
          <div id="availability">
            <span class="a-size-medium a-color-success primary-availability-message"> In Stock </span>
          </div>
        </body>
      </html>
    `;

    const parsed = parseProductHtml('amazon_ae', amazonUsUrl, html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'amazon_ae',
        canonicalUrl: amazonUsUrl,
        imageUrl: 'https://m.media-amazon.com/images/I/61NuT5tXQML._AC_SL1500_.jpg',
        priceMinor: 7999,
        currency: 'USD',
        availability: 'in_stock'
      })
    );
  });

  it('parses Amazon.de prices in EUR with decimal commas', () => {
    const html = `
      <html>
        <head>
          <link rel="canonical" href="https://www.amazon.de/Logitech-Headphones-Cancelling-Microphone-Chromebook/dp/B005BFCNYU/" />
        </head>
        <body>
          <div id="titleSection">
            <h1 id="title">
              <span id="productTitle">Logitech H390 Wired Headset</span>
            </h1>
          </div>
          <div id="corePriceDisplay_desktop_feature_div">
            <span class="a-price aok-align-center reinventPricePriceToPayMargin priceToPay apex-pricetopay-value">
              <span class="a-offscreen">EUR 79,99</span>
            </span>
          </div>
          <img
            id="landingImage"
            src="https://m.media-amazon.com/images/I/61NuT5tXQML._AC_SY300_SX300_QL70_ML2_.jpg"
            data-old-hires="https://m.media-amazon.com/images/I/61NuT5tXQML._AC_SL1500_.jpg"
          />
          <div id="availability">
            <span class="a-size-medium a-color-success primary-availability-message"> In Stock </span>
          </div>
        </body>
      </html>
    `;

    const parsed = parseProductHtml('amazon_ae', amazonDeUrl, html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'amazon_ae',
        canonicalUrl: amazonDeUrl,
        priceMinor: 7999,
        currency: 'EUR',
        availability: 'in_stock'
      })
    );
  });

  it('parses Ounass inline PDP payloads', () => {
    const html = `
      <html>
        <head>
          <title>Buy Givenchy Beauty Gentleman Givenchy Eau De Parfum Boisee, 200ml For Men Online | Ounass UAE</title>
          <meta property="og:title" content="Buy Givenchy Beauty Gentleman Givenchy Eau De Parfum Boisee, 200ml For Men Online | Ounass UAE" />
        </head>
        <body>
          <script>
            window.__OUNASS_DATA__ = {
              "routeType":"new-pdp",
              "pdp":{
                "styleColorId":"1216083751_242",
                "slug":"shop-givenchy-beauty-gentleman-givenchy-eau-de-parfum-boisee-200ml-for-men-1216083751_242",
                "visibleSku":"216083752",
                "name":"Gentleman Givenchy Eau De Parfum Boisee, 200ml",
                "designerCategoryEnglishName":"Givenchy Beauty",
                "price":846,
                "priceInAED":846,
                "outOfStock":false,
                "images":[
                  {
                    "thumbnail":"//ounass-ae.atgcdn.ae/small_light(dw=81,ch=158,cc=fafafa,of=webp)/pub/media/catalog/product/2/1/216083751_nocolor_in.jpg?ts=1688569795.9337",
                    "oneX":"//ounass-ae.atgcdn.ae/small_light(p=zoom,of=webp,q=65)/pub/media/catalog/product/2/1/216083751_nocolor_in.jpg?ts=1688569795.9337",
                    "twoX":"//ounass-ae.atgcdn.ae/small_light(of=webp,q=90)/pub/media/catalog/product/2/1/216083751_nocolor_in.jpg?ts=1688569795.9337"
                  }
                ],
                "sizes":[
                  {
                    "sku":"216083752",
                    "sizeCode":"NO SIZE",
                    "price":846,
                    "priceInAED":846,
                    "stock":6,
                    "disabled":false
                  }
                ]
              }
            };
          </script>
        </body>
      </html>
    `;

    const parsed = parseProductHtml('ounass', ounassUrl, html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'ounass',
        canonicalUrl: ounassUrl,
        title: 'Givenchy Beauty Gentleman Givenchy Eau De Parfum Boisee, 200ml',
        sku: '216083752',
        imageUrl:
          'https://ounass-ae.atgcdn.ae/small_light(of=webp,q=90)/pub/media/catalog/product/2/1/216083751_nocolor_in.jpg?ts=1688569795.9337',
        priceMinor: 84600,
        currency: 'AED',
        availability: 'in_stock'
      })
    );
  });

  it('ignores blank Amazon offscreen spans and falls back to the actual total price', () => {
    const html = `
      <html>
        <head>
          <link rel="canonical" href="https://www.amazon.com/Canon-Digital-18-55mm-3-5-5-6-Renewed/dp/B0BHJHHJ1T" />
        </head>
        <body>
          <div id="titleSection">
            <h1 id="title">
              <span id="productTitle">Canon EOS Rebel T1i 15.1 MP CMOS Digital SLR Camera with 18-55mm Lens (Renewed)</span>
            </h1>
          </div>
          <div class="a-spacing-top-mini apex-core-price-identifier">
            <span class="a-price a-text-normal aok-align-center reinventPriceAccordionT2 apex-pricetopay-value" data-a-size="l" data-a-color="base">
              <span class="a-offscreen"> </span>
              <span aria-hidden="true">
                <span class="a-price-symbol">AED</span>
                <span class="a-price-whole">1,058<span class="a-price-decimal">.</span></span>
                <span class="a-price-fraction">85</span>
              </span>
            </span>
          </div>
          <div id="tp_price_update_feature_ww">
            <span id="tp_price_block_total_price_ww" class="a-price" data-a-size="m" data-a-color="base">
              <span class="a-offscreen">AED1,058.85</span>
              <span aria-hidden="true">
                <span class="a-price-whole">1,058<span class="a-price-decimal">.</span></span>
                <span class="a-price-fraction">85</span>
              </span>
            </span>
          </div>
          <img
            id="landingImage"
            src="https://m.media-amazon.com/images/I/916qWQ0iIBL._AC_SY300_.jpg"
            data-a-dynamic-image="{&quot;https://m.media-amazon.com/images/I/916qWQ0iIBL._AC_SY355_.jpg&quot;:[355,355],&quot;https://m.media-amazon.com/images/I/916qWQ0iIBL._AC_SX679_.jpg&quot;:[679,679]}"
          />
          <div id="availability">
            <span class="a-size-medium a-color-success primary-availability-message"> In Stock </span>
          </div>
        </body>
      </html>
    `;

    const parsed = parseProductHtml('amazon_ae', 'https://www.amazon.com/dp/B0BHJHHJ1T', html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'amazon_ae',
        canonicalUrl: 'https://www.amazon.com/Canon-Digital-18-55mm-3-5-5-6-Renewed/dp/B0BHJHHJ1T',
        priceMinor: 105885,
        currency: 'AED',
        availability: 'in_stock'
      })
    );
  });

  it('parses AYM WooCommerce variable product markup', () => {
    const html = `
      <html>
        <head>
          <link rel="canonical" href="https://ay-accessories.com/product/nolan-n120-1-classico-nobile-n-com-modular-helmet/" />
          <meta property="og:image" content="https://ay-accessories.com/wp-content/uploads/2025/12/N120-1313.jpg" />
        </head>
        <body>
          <div class="single-product-page entry-content product type-product instock product-type-variable">
            <h1 class="product_title entry-title wd-entities-title">Nolan N120-1 Classico Nobile N-Com Modular Helmet</h1>
            <div class="wd-single-price">
              <p class="price">
                <span class="woocommerce-Price-amount amount" aria-hidden="true">
                  <bdi>1,519&nbsp;<span class="woocommerce-Price-currencySymbol">&#x62f;.&#x625;</span></bdi>
                </span>
                <span aria-hidden="true">&ndash;</span>
                <span class="woocommerce-Price-amount amount" aria-hidden="true">
                  <bdi>1,559&nbsp;<span class="woocommerce-Price-currencySymbol">&#x62f;.&#x625;</span></bdi>
                </span>
                <span class="screen-reader-text">Price range: 1,519&#x62f;.&#x625; through 1,559&#x62f;.&#x625;</span>
              </p>
            </div>
            <form
              class="variations_form cart"
              data-product_variations="[{&quot;availability_html&quot;:&quot;&lt;p class=\\&quot;stock in-stock wd-style-default\\&quot;&gt;In stock&lt;/p&gt;&quot;,&quot;display_price&quot;:1519,&quot;image&quot;:{&quot;full_src&quot;:&quot;https://ay-accessories.com/wp-content/uploads/2025/12/N120-1313.jpg&quot;},&quot;is_in_stock&quot;:true,&quot;sku&quot;:&quot;N120-1[313]L&quot;}]"
            ></form>
          </div>
        </body>
      </html>
    `;

    const parsed = parseProductHtml('ay_accessories', aymUrl, html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'ay_accessories',
        canonicalUrl: aymUrl,
        title: 'Nolan N120-1 Classico Nobile N-Com Modular Helmet',
        sku: 'N120-1[313]L',
        imageUrl: 'https://ay-accessories.com/wp-content/uploads/2025/12/N120-1313.jpg',
        priceMinor: 151900,
        currency: 'AED',
        availability: 'in_stock'
      })
    );
  });

  it('parses the main AYM product price instead of earlier related-product prices', () => {
    const html = `
      <html>
        <head>
          <link rel="canonical" href="https://ay-accessories.com/product/axxis-ff122-hawk-sv-evo-sick-joke/" />
          <meta property="og:image" content="https://ay-accessories.com/wp-content/uploads/2024/09/Untitled-design-8.png" />
        </head>
        <body>
          <span class="price">
            <del aria-hidden="true"><span class="woocommerce-Price-amount amount"><bdi>359&nbsp;<span class="woocommerce-Price-currencySymbol">&#x62f;.&#x625;</span></bdi></span></del>
            <span class="screen-reader-text">Original price was: 359&nbsp;&#x62f;.&#x625;.</span>
            <ins aria-hidden="true"><span class="woocommerce-Price-amount amount"><bdi>269&nbsp;<span class="woocommerce-Price-currencySymbol">&#x62f;.&#x625;</span></bdi></span></ins>
            <span class="screen-reader-text">Current price is: 269&nbsp;&#x62f;.&#x625;.</span>
          </span>
          <h1 class="product_title entry-title wd-entities-title">AXXIS - FF122 HAWK SV EVO SICK JOKE</h1>
          <div class="vc_row wpb_row vc_inner vc_row-fluid">
            <div class="wpb_column vc_column_container vc_col-sm-12 wd-enabled-flex">
              <div class="vc_column-inner">
                <div class="wpb_wrapper">
                  <div class="wd-single-price wd-wpb text-left">
                    <p class="price">
                      <del aria-hidden="true"><span class="woocommerce-Price-amount amount"><bdi>549&nbsp;<span class="woocommerce-Price-currencySymbol">&#x62f;.&#x625;</span></bdi></span></del>
                      <span class="screen-reader-text">Original price was: 549&nbsp;&#x62f;.&#x625;.</span>
                      <ins aria-hidden="true"><span class="woocommerce-Price-amount amount"><bdi>412&nbsp;<span class="woocommerce-Price-currencySymbol">&#x62f;.&#x625;</span></bdi></span></ins>
                      <span class="screen-reader-text">Current price is: 412&nbsp;&#x62f;.&#x625;.</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const parsed = parseProductHtml('ay_accessories', 'https://ay-accessories.com/product/axxis-ff122-hawk-sv-evo-sick-joke/', html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'ay_accessories',
        title: 'AXXIS - FF122 HAWK SV EVO SICK JOKE',
        imageUrl: 'https://ay-accessories.com/wp-content/uploads/2024/09/Untitled-design-8.png',
        priceMinor: 41200,
        currency: 'AED'
      })
    );
  });

  it('uses JSON-LD priceSpecification instead of unrelated twitter metadata', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="AXXIS - FF122 HAWK SV EVO SICK JOKE - Al Yousuf Accessories" />
          <meta property="og:image" content="https://ay-accessories.com/wp-content/uploads/2024/09/Untitled-design-8.png" />
          <meta name="twitter:data1" content="1 minute" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org/",
              "@graph": [
                {
                  "@type": "Product",
                  "name": "AXXIS - FF122 HAWK SV EVO SICK JOKE",
                  "image": "https://ay-accessories.com/wp-content/uploads/2024/09/Untitled-design-8.png",
                  "sku": 29044,
                  "offers": [
                    {
                      "@type": "Offer",
                      "priceSpecification": [
                        {
                          "@type": "UnitPriceSpecification",
                          "price": "412",
                          "priceCurrency": "AED"
                        }
                      ],
                      "availability": "https://schema.org/InStock",
                      "url": "https://ay-accessories.com/product/axxis-ff122-hawk-sv-evo-sick-joke/"
                    }
                  ]
                }
              ]
            }
          </script>
        </head>
      </html>
    `;

    const parsed = parseProductHtml('ay_accessories', 'https://ay-accessories.com/product/axxis-ff122-hawk-sv-evo-sick-joke/', html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'ay_accessories',
        title: 'AXXIS - FF122 HAWK SV EVO SICK JOKE',
        imageUrl: 'https://ay-accessories.com/wp-content/uploads/2024/09/Untitled-design-8.png',
        priceMinor: 41200,
        currency: 'AED',
        availability: 'in_stock'
      })
    );
  });
});

describe('detectSupportedSite', () => {
  it('detects AYM Accessories product URLs', () => {
    expect(detectSupportedSite(aymUrl)?.key).toBe('ay_accessories');
  });

  it('detects Ounass product URLs', () => {
    expect(detectSupportedSite(ounassUrl)?.key).toBe('ounass');
  });

  it('detects Amazon.ae product URLs', () => {
    expect(detectSupportedSite(amazonUrl)?.key).toBe('amazon_ae');
    expect(detectSupportedSite('https://www.amazon.ae/gp/product/B005BFCNYU')?.key).toBe('amazon_ae');
  });

  it('detects Amazon.com and Amazon.de product URLs', () => {
    expect(detectSupportedSite(amazonUsUrl)?.key).toBe('amazon_ae');
    expect(detectSupportedSite(amazonDeUrl)?.key).toBe('amazon_ae');
    expect(detectSupportedSite('https://www.amazon.co.uk/gp/product/B005BFCNYU')?.key).toBe('amazon_ae');
  });
});

describe('parsePriceToMinor', () => {
  it('handles US and EU formatted price strings', () => {
    expect(parsePriceToMinor('$79.99')).toBe(7999);
    expect(parsePriceToMinor('EUR 79,99')).toBe(7999);
    expect(parsePriceToMinor('1,019.00')).toBe(101900);
    expect(parsePriceToMinor('1.019,00')).toBe(101900);
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
