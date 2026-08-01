import { fetchAndParseProduct, parseProductHtml } from '../parser';
import { parsePriceToMinor } from '../price';
import { cleanUrl, detectSharedUrl, detectSupportedSite } from '../sites';
import { SiteKey } from '../types';

const noonUrl =
  'https://www.noon.com/uae-en/galaxy-s25-ultra-ai-dual-sim-titanium-grey-12gb-ram-256gb-5g-middle-east-version/N70140492V/p/';
const aymUrl = 'https://ay-accessories.com/product/nolan-n120-1-classico-nobile-n-com-modular-helmet/';
const ounassUrl = 'https://www.ounass.ae/shop-givenchy-beauty-gentleman-givenchy-eau-de-parfum-boisee-200ml-for-men-1216083751_242.html';
const amazonUrl = 'https://www.amazon.ae/Logitech-Headphones-Cancelling-Microphone-Chromebook/dp/B005BFCNYU/';
const amazonUsUrl = 'https://www.amazon.com/Logitech-Headphones-Cancelling-Microphone-Chromebook/dp/B005BFCNYU/';
const amazonDeUrl = 'https://www.amazon.de/Logitech-Headphones-Cancelling-Microphone-Chromebook/dp/B005BFCNYU/';
const adidasUrl = 'https://www.adidas.ae/en/adicolor-classics-3-stripes-hoodie/IX7573.html';
const pumaUrl = 'https://ae.puma.com/ae/en/pd/h-street-premium-sneakers-unisex/403777.html?color=02';
const decathlonUrl = 'https://decathlon.ae/products/men-s-modular-and-durable-mountain-trekking-trousers-mt100';
const sephoraUrl = 'https://www.sephora.me/ae-en/p/dior-addict-glass-lipstick-ultra-shine-and-hydrating-lip-gloss-stick/P1000214119?productVariantId=811716';
const facesUrl = 'https://www.faces.ae/en/p/dior-addict-glass-ultra-shine-and-hydrating-stick-pm009117909944.html';
const bflUrl = 'https://www.brandsforless.com/en-ae/women-paisley-print-tiered-dress-multicolor/1966137/p/';

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

  it('uses the non-Prime Buy Box price when a Prime-exclusive discount is also present', () => {
    const html = `
      <html>
        <head><link rel="canonical" href="https://www.amazon.ae/dp/B0PRIME123" /></head>
        <body>
          <span id="productTitle">Prime discount example</span>
          <div id="corePriceDisplay_desktop_feature_div">
            <span id="tp_price_block_total_price_ww" class="a-price">
              <span class="a-offscreen">AED 199.00</span>
            </span>
            <div class="primeExclusivePrice">
              <span class="a-price priceToPay">
                <span class="a-offscreen">AED 149.00</span>
              </span>
              <span>Prime Exclusive Deal</span>
            </div>
          </div>
          <div id="availability"><span class="primary-availability-message">In Stock</span></div>
        </body>
      </html>
    `;

    expect(parseProductHtml('amazon_ae', 'https://www.amazon.ae/dp/B0PRIME123', html)).toEqual(
      expect.objectContaining({ priceMinor: 19900, rawPriceText: 'AED 199.00' })
    );
  });

  it('uses a base priceToPay price when a Prime-exclusive price is in the same Buy Box', () => {
    const html = `
      <html>
        <head><link rel="canonical" href="https://www.amazon.ae/dp/B0PRIME456" /></head>
        <body>
          <span id="productTitle">Prime offer alongside base price</span>
          <div id="corePriceDisplay_desktop_feature_div">
            <span class="a-price priceToPay"><span class="a-offscreen">AED 199.00</span></span>
            <div class="primeExclusivePrice">
              <span class="a-price priceToPay"><span class="a-offscreen">AED 149.00</span></span>
              <span>Prime Exclusive Deal</span>
            </div>
          </div>
          <div id="availability"><span class="primary-availability-message">In Stock</span></div>
        </body>
      </html>
    `;

    expect(parseProductHtml('amazon_ae', 'https://www.amazon.ae/dp/B0PRIME456', html)).toEqual(
      expect.objectContaining({ priceMinor: 19900, rawPriceText: 'AED 199.00' })
    );
  });

  it('uses the current Buy Box sale price instead of the crossed-out list price', () => {
    const html = `
      <html>
        <head><link rel="canonical" href="https://www.amazon.ae/dp/B0SALE1234" /></head>
        <body>
          <span id="productTitle">Sale price example</span>
          <div id="corePriceDisplay_desktop_feature_div">
            <span class="a-price a-text-price"><span class="a-offscreen">AED 299.00</span></span>
            <span class="a-price priceToPay"><span class="a-offscreen">AED 249.00</span></span>
          </div>
          <div id="availability"><span class="primary-availability-message">In Stock</span></div>
        </body>
      </html>
    `;

    expect(parseProductHtml('amazon_ae', 'https://www.amazon.ae/dp/B0SALE1234', html)).toEqual(
      expect.objectContaining({ priceMinor: 24900, rawPriceText: 'AED 249.00' })
    );
  });

  it('does not use an alternate-seller price when the Buy Box has no price', () => {
    const html = `
      <html>
        <head>
          <link rel="canonical" href="https://www.amazon.ae/dp/B0SELLER12" />
          <meta property="product:price:amount" content="125.00" />
        </head>
        <body>
          <span id="productTitle">Alternate seller example</span>
          <div id="availability"><span class="primary-availability-message">In Stock</span></div>
          <section id="all-offers-display-scroller">
            <span class="a-price priceToPay"><span class="a-offscreen">AED 125.00</span></span>
            <span>Available from another seller</span>
          </section>
        </body>
      </html>
    `;

    expect(parseProductHtml('amazon_ae', 'https://www.amazon.ae/dp/B0SELLER12', html)).toEqual(
      expect.objectContaining({ priceMinor: undefined, rawPriceText: undefined })
    );
  });

  it('does not treat a recommended product price as the price of an out-of-stock Amazon item', () => {
    const html = `
      <html>
        <head>
          <link rel="canonical" href="https://www.amazon.ae/dp/B0CYSLPBLM" />
          <meta property="og:title" content="Unavailable Amazon product" />
        </head>
        <body>
          <span id="productTitle">Unavailable Amazon product</span>
          <div id="availability">
            <span class="a-size-medium a-color-price">Currently unavailable.</span>
          </div>
          <section id="recommended-products">
            <span class="a-price priceToPay"><span class="a-offscreen">AED 108.99</span></span>
          </section>
        </body>
      </html>
    `;

    const parsed = parseProductHtml('amazon_ae', 'https://www.amazon.ae/dp/B0CYSLPBLM', html);

    expect(parsed).toEqual(
      expect.objectContaining({
        availability: 'out_of_stock',
        priceMinor: undefined,
        rawPriceText: undefined
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

  it('uses the selected AYM variation instead of another available size', () => {
    const html = `
      <html><body>
        <h1 class="product_title">Helmet</h1>
        <form data-product_variations="[{&quot;variation_id&quot;:11,&quot;attributes&quot;:{&quot;attribute_pa_size&quot;:&quot;M&quot;},&quot;display_price&quot;:500,&quot;is_in_stock&quot;:true,&quot;sku&quot;:&quot;HELMET-M&quot;},{&quot;variation_id&quot;:12,&quot;attributes&quot;:{&quot;attribute_pa_size&quot;:&quot;L&quot;},&quot;display_price&quot;:550,&quot;is_in_stock&quot;:true,&quot;sku&quot;:&quot;HELMET-L&quot;}]"></form>
      </body></html>
    `;

    const parsed = parseProductHtml('ay_accessories', aymUrl, html, {
      id: '12',
      label: 'Size: L',
      attributes: [{ name: 'Size', value: 'L' }]
    });

    expect(parsed).toEqual(
      expect.objectContaining({
        priceMinor: 55000,
        sku: 'HELMET-L',
        availability: 'in_stock',
        selectedVariant: { id: '12', label: 'Size: L', attributes: [{ name: 'Size', value: 'L' }] }
      })
    );
  });

  it('resolves a no-price out-of-stock AYM variation', () => {
    const html = `
      <html><body>
        <h1 class="product_title">Helmet</h1>
        <form data-product_variations="[{&quot;variation_id&quot;:13,&quot;attributes&quot;:{&quot;attribute_pa_size&quot;:&quot;L&quot;},&quot;is_in_stock&quot;:false,&quot;sku&quot;:&quot;HELMET-L&quot;}]"></form>
      </body></html>
    `;

    const parsed = parseProductHtml('ay_accessories', aymUrl, html, {
      id: '13',
      label: 'Size: L',
      attributes: [{ name: 'Size', value: 'L' }]
    });

    expect(parsed).toEqual(
      expect.objectContaining({
        priceMinor: undefined,
        availability: 'out_of_stock',
        selectedVariant: { id: '13', label: 'Size: L', attributes: [{ name: 'Size', value: 'L' }] }
      })
    );
  });

  it('resolves an unavailable Ounass size as out of stock', () => {
    const html = `
      <html><body><script>window.__OUNASS_DATA__={"pdp":{"name":"Dress","priceInAED":300,"outOfStock":false,"sizes":[{"sku":"DRESS-S","sizeCode":"S","priceInAED":300,"stock":2,"disabled":false},{"sku":"DRESS-M","sizeCode":"M","priceInAED":320,"stock":0,"disabled":true}]}};</script></body></html>
    `;

    const parsed = parseProductHtml('ounass', ounassUrl, html, {
      id: 'DRESS-M',
      label: 'Size: M',
      attributes: [{ name: 'Size', value: 'M' }]
    });

    expect(parsed).toEqual(
      expect.objectContaining({
        priceMinor: undefined,
        availability: 'out_of_stock',
        selectedVariant: { id: 'DRESS-M', label: 'Size: M', attributes: [{ name: 'Size', value: 'M' }] }
      })
    );
  });

  it('resolves a no-price out-of-stock Ounass size', () => {
    const html = `
      <html><body><script>window.__OUNASS_DATA__={"pdp":{"name":"Dress","priceInAED":300,"outOfStock":false,"sizes":[{"sku":"DRESS-M","sizeCode":"M","stock":0,"disabled":true}]}};</script></body></html>
    `;

    const parsed = parseProductHtml('ounass', ounassUrl, html, {
      id: 'DRESS-M',
      label: 'Size: M',
      attributes: [{ name: 'Size', value: 'M' }]
    });

    expect(parsed).toEqual(
      expect.objectContaining({
        priceMinor: undefined,
        availability: 'out_of_stock',
        selectedVariant: { id: 'DRESS-M', label: 'Size: M', attributes: [{ name: 'Size', value: 'M' }] }
      })
    );
  });

  it('resolves the selected Level Shoes size instead of the page price', () => {
    const html = `
      <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"productDetails":{"name":"Sneaker","rawSalePrice":470,"sku":"PARENT","sizeOptions":[{"sku":"SHOE-42","label":"EU 42","rawSalePrice":470,"isInStock":true},{"sku":"SHOE-43","label":"EU 43","rawSalePrice":490,"isInStock":true}]}}}}</script>
    `;

    const parsed = parseProductHtml('level_shoes', 'https://www.levelshoes.com/example.html', html, {
      id: 'SHOE-43',
      label: 'Size: EU 43',
      attributes: [{ name: 'Size', value: 'EU 43' }]
    });

    expect(parsed).toEqual(
      expect.objectContaining({
        priceMinor: 49000,
        sku: 'SHOE-43',
        selectedVariant: { id: 'SHOE-43', label: 'Size: EU 43', attributes: [{ name: 'Size', value: 'EU 43' }] }
      })
    );
  });

  it('offers the available sizes from the reported Level Shoes product payload', () => {
    const html = `
      <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"productDetails":{"id":1166245,"name":"GEL-KINETIC FLUENT sneakers","rawSalePrice":810,"sku":"0D7VYB"},"__APOLLO_STATE__":{"ProductDetails:1166245":{"detail":{"sizeOptions":[{"sku":"095927913494","label":"37","rawSalePrice":810,"isInStock":false},{"sku":"095927913502","label":"42","rawSalePrice":810,"isInStock":true},{"sku":"095927914522","label":"48","rawSalePrice":810,"isInStock":true}]}}}}}}</script>
    `;

    const parsed = parseProductHtml(
      'level_shoes',
      'https://www.levelshoes.com/asics-gel-kinetic-fluent-sneakers-beige-fabric-low-tops-0d7vyb.html',
      html
    );

    expect(parsed?.variants).toEqual([
      expect.objectContaining({ id: '095927913494', label: 'Size: 37', priceMinor: 81000, availability: 'out_of_stock' }),
      expect.objectContaining({ id: '095927913502', label: 'Size: 42', priceMinor: 81000, availability: 'in_stock' }),
      expect.objectContaining({ id: '095927914522', label: 'Size: 48', priceMinor: 81000, availability: 'in_stock' })
    ]);
  });

  it('offers Nike sizes only when the original page provides a variant ID, price, and stock state', () => {
    const html = `
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Nike Club Pants","sku":"NKIB8369-010","offers":{"@type":"Offer","price":"149","priceCurrency":"AED","availability":"https://schema.org/InStock"}}</script>
      <button class="color-attribute" aria-label="Select Color Black" data-attr-value="101" data-attr-display-value="Black" data-pid="NKIB8369-010"></button>
      <button class="size-attribute" aria-label="Select Size XS" data-attr-value="NIKE_APPAREL_MENS_XS" data-attr-display-value="XS" data-pid="197863943381" disabled></button>
      <button class="size-attribute" aria-label="Select Size M" data-attr-value="NIKE_APPAREL_MENS_M" data-attr-display-value="M" data-pid="197863920580"></button>
      <button class="size-attribute" aria-label="Select Size L" data-attr-value="NIKE_APPAREL_MENS_L" data-attr-display-value="L" data-pid="197863918495"></button>
    `;

    const parsed = parseProductHtml('nike_uae', 'https://www.nike.ae/en/example/NKIB8369-010.html', html);

    expect(parsed?.variants).toEqual([
      expect.objectContaining({ id: '197863943381', label: 'Size: XS', priceMinor: 14900, availability: 'out_of_stock' }),
      expect.objectContaining({ id: '197863920580', label: 'Size: M', priceMinor: 14900, availability: 'in_stock' }),
      expect.objectContaining({ id: '197863918495', label: 'Size: L', priceMinor: 14900, availability: 'in_stock' })
    ]);
  });

  it('uses the saved Nike source variant ID instead of another available size', () => {
    const html = `
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Nike Club Pants","offers":{"@type":"Offer","price":"149","priceCurrency":"AED","availability":"https://schema.org/InStock"}}</script>
      <button class="size-attribute" aria-label="Select Size M" data-attr-value="NIKE_APPAREL_MENS_M" data-attr-display-value="M" data-pid="197863920580"></button>
      <button class="size-attribute" aria-label="Select Size L" data-attr-value="NIKE_APPAREL_MENS_L" data-attr-display-value="L" data-pid="197863918495"></button>
    `;

    const parsed = parseProductHtml('nike_uae', 'https://www.nike.ae/en/example/NKIB8369-010.html', html, {
      id: '197863918495',
      label: 'Size: L',
      attributes: [{ name: 'Size', value: 'L' }]
    });

    expect(parsed).toEqual(
      expect.objectContaining({
        sku: '197863918495',
        priceMinor: 14900,
        selectedVariant: { id: '197863918495', label: 'Size: L', attributes: [{ name: 'Size', value: 'L' }] }
      })
    );
  });

  it('offers Sun & Sand Sports sizes from its static source option values', () => {
    const html = `
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Swimming Shorts","sku":"SD8-00236417360","offers":{"@type":"Offer","price":"129","priceCurrency":"AED","availability":"https://schema.org/InStock"}}</script>
      <button class="size-attribute" aria-label="Select Size S" data-attr-value="SPDO_APPAREL_MENS_S" data-attr-display-value="S"></button>
      <button class="size-attribute" aria-label="Select Size M" data-attr-value="SPDO_APPAREL_MENS_M" data-attr-display-value="M"></button>
      <button class="size-attribute m-disabled" aria-label="Select Size L" data-attr-value="SPDO_APPAREL_MENS_L" data-attr-display-value="L" disabled></button>
    `;

    const parsed = parseProductHtml('sun_sand_sports', 'https://en-ae.sssports.com/example/SD8-00236417360.html', html);

    expect(parsed?.variants).toEqual([
      expect.objectContaining({ id: 'SPDO_APPAREL_MENS_S', label: 'Size: S', priceMinor: 12900, availability: 'in_stock' }),
      expect.objectContaining({ id: 'SPDO_APPAREL_MENS_M', label: 'Size: M', priceMinor: 12900, availability: 'in_stock' }),
      expect.objectContaining({ id: 'SPDO_APPAREL_MENS_L', label: 'Size: L', priceMinor: 12900, availability: 'out_of_stock' })
    ]);
  });

  it('offers Adidas sizes from static option IDs and marks disabled sizes out of stock', () => {
    const html = `
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Adizero EVO SL Shoes","sku":"KI6901","offers":{"@type":"Offer","price":"699","priceCurrency":"AED","availability":"https://schema.org/InStock"}}</script>
      <div class="size-radio disabled"><input type="hidden" class="radio-input_attID" value="KI6901_580"><label><input type="radio" disabled><span class="size-value">39 1/3</span></label></div>
      <div class="size-radio"><input type="hidden" class="radio-input_attID" value="KI6901_590"><label><input type="radio"><span class="size-value">40</span></label></div>
      <div class="size-radio"><input type="hidden" class="radio-input_attID" value="KI6901_600"><label><input type="radio"><span class="size-value">40 2/3</span></label></div>
    `;

    const parsed = parseProductHtml('adidas', 'https://www.adidas.ae/en/adizero-evo-sl-shoes/KI6901.html', html);

    expect(parsed?.variants).toEqual([
      expect.objectContaining({ id: 'KI6901_580', label: 'Size: 39 1/3', priceMinor: 69900, availability: 'out_of_stock' }),
      expect.objectContaining({ id: 'KI6901_590', label: 'Size: 40', priceMinor: 69900, availability: 'in_stock' }),
      expect.objectContaining({ id: 'KI6901_600', label: 'Size: 40 2/3', priceMinor: 69900, availability: 'in_stock' })
    ]);
  });

  it('offers PUMA sizes from initial-page option IDs and stock labels', () => {
    const html = `
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"H-Street Premium Sneakers Unisex","sku":"403777_02","image":["https://images.puma.com/403777-02.png"],"offers":{"@type":"Offer","price":"299","priceCurrency":"AED","availability":"https://schema.org/InStock","url":"https://ae.puma.com/ae/en/pd/h-street-premium-sneakers-unisex/403777.html"}}</script>
      <a data-testid="sf-sizetile" aria-label="Size EU 42" value="0240" href="/ae/en/pd/h-street-premium-sneakers-unisex/403777.html?color=02&amp;size=0240"><p>EU 42</p></a>
      <a data-testid="sf-sizetile" aria-label="Size EU 42.5 out of stock" value="0250" href="/ae/en/pd/h-street-premium-sneakers-unisex/403777.html?color=02&amp;size=0250"><p>EU 42.5</p></a>
      <a data-testid="sf-sizetile" aria-label="Size EU 43" value="0260" href="/ae/en/pd/h-street-premium-sneakers-unisex/403777.html?color=02&amp;size=0260"><p>EU 43</p></a>
    `;

    const parsed = parseProductHtml('puma_uae', pumaUrl, html);

    expect(parsed).toEqual(expect.objectContaining({
      siteKey: 'puma_uae',
      canonicalUrl: pumaUrl,
      title: 'H-Street Premium Sneakers Unisex',
      sku: '403777_02',
      priceMinor: 29900,
      currency: 'AED',
      availability: 'in_stock'
    }));
    expect(parsed?.variants).toEqual([
      expect.objectContaining({ id: '0240', label: 'Size: EU 42', priceMinor: 29900, availability: 'in_stock' }),
      expect.objectContaining({ id: '0250', label: 'Size: EU 42.5', priceMinor: 29900, availability: 'out_of_stock' }),
      expect.objectContaining({ id: '0260', label: 'Size: EU 43', priceMinor: 29900, availability: 'in_stock' })
    ]);
  });

  it('resolves the exact saved PUMA size from its source option ID', () => {
    const html = `
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"H-Street Premium Sneakers Unisex","sku":"403777_02","offers":{"@type":"Offer","price":"299","priceCurrency":"AED","availability":"https://schema.org/InStock"}}</script>
      <a data-testid="sf-sizetile" aria-label="Size EU 42" value="0240"><p>EU 42</p></a>
      <a data-testid="sf-sizetile" aria-label="Size EU 43" value="0260"><p>EU 43</p></a>
    `;

    const parsed = parseProductHtml('puma_uae', pumaUrl, html, {
      id: '0260',
      label: 'Size: EU 43',
      attributes: [{ name: 'Size', value: 'EU 43' }]
    });

    expect(parsed).toEqual(expect.objectContaining({
      sku: '0260',
      selectedVariant: {
        id: '0260',
        label: 'Size: EU 43',
        attributes: [{ name: 'Size', value: 'EU 43' }]
      }
    }));
  });

  it('uses Decathlon ProductJson variants for the chosen exact store option', () => {
    const html = `
      <script id="ProductJson" type="application/json">{
        "id": 8741542887614,
        "title": "Men’s Modular and Durable Mountain Trekking Trousers MT100",
        "featured_image": "//decathlon.ae/cdn/shop/files/trousers.jpg",
        "options": ["Model Code", "Size", "Color"],
        "variants": [
          {"id": 46478949187774, "option1": "8666242", "option2": "UK31\\u0022 / FR 40 (L33)", "option3": "carbon grey", "sku": "4393052", "available": true, "price": 16500, "featured_image": {"src": "//decathlon.ae/cdn/shop/files/trousers.jpg"}},
          {"id": 46478949253310, "option1": "8666242", "option2": "UK34\\u0022 / FR 44 (L34)", "option3": "carbon grey", "sku": "4402417", "available": false, "price": 16500}
        ]
      }</script>
    `;

    const parsed = parseProductHtml('decathlon_uae', decathlonUrl, html);

    expect(parsed).toEqual(expect.objectContaining({
      siteKey: 'decathlon_uae',
      canonicalUrl: decathlonUrl,
      title: 'Men’s Modular and Durable Mountain Trekking Trousers MT100',
      priceMinor: 16500,
      currency: 'AED',
      availability: 'in_stock',
      sku: '4393052'
    }));
    expect(parsed?.variants).toEqual([
      expect.objectContaining({
        id: '46478949187774',
        label: expect.stringContaining('Size: UK31" / FR 40 (L33)'),
        priceMinor: 16500,
        availability: 'in_stock'
      }),
      expect.objectContaining({ id: '46478949253310', availability: 'out_of_stock' })
    ]);

    const selected = parseProductHtml('decathlon_uae', decathlonUrl, html, {
      id: '46478949253310',
      label: 'Model Code: 8666242 Â· Size: UK34" / FR 44 (L34) Â· Color: carbon grey',
      attributes: [
        { name: 'Model Code', value: '8666242' },
        { name: 'Size', value: 'UK34" / FR 44 (L34)' },
        { name: 'Color', value: 'carbon grey' }
      ]
    });

    expect(selected).toEqual(expect.objectContaining({
      priceMinor: undefined,
      availability: 'out_of_stock',
      sku: '4402417',
      selectedVariant: expect.objectContaining({ id: '46478949253310' })
    }));

    const incompleteRecordHtml = html.replace('"available": false, "price": 16500', '"price": 16500');
    expect(parseProductHtml('decathlon_uae', decathlonUrl, incompleteRecordHtml)?.variants).toBeUndefined();
  });

  it('keeps Noon page-level when the initial response has labels but no stable source option ID', () => {
    const html = `
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Anzarun Lite","sku":"N44137847V","offers":{"@type":"Offer","price":"97","priceCurrency":"AED","availability":"https://schema.org/InStock"}}</script>
      <a class="optionButton disabled oos">38 EU</a><a class="optionButton active">36 EU</a>
    `;

    expect(parseProductHtml('noon', noonUrl, html)?.variants).toBeUndefined();
  });

  it('keeps sources without complete static option records on page-level tracking', () => {
    const html = `
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Example product","sku":"SKU-1","offers":{"@type":"Offer","price":"100","priceCurrency":"AED","availability":"https://schema.org/InStock"}}</script>
    `;
    const pageLevelSources: SiteKey[] = ['noon', 'nike_uae', 'sun_sand_sports', 'amazon_ae', 'adidas', 'puma_uae', 'decathlon_uae', 'sephora_uae', 'faces_uae', 'brands_for_less'];

    for (const siteKey of pageLevelSources) {
      expect(parseProductHtml(siteKey, 'https://example.com/product', html)?.variants).toBeUndefined();
    }
  });

  it('parses Sephora UAE product JSON-LD and retains shade products at page level', () => {
    const html = `
      <link rel="canonical" href="https://www.sephora.me/ae-en/p/dior-addict-glass-lipstick-ultra-shine-and-hydrating-lip-gloss-stick/P1000214119" />
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Dior Addict Glass Lipstick","sku":"811716","image":"https://img-product.sephora.me/811716.jpeg","offers":{"@type":"Offer","price":"215","priceCurrency":"AED","availability":"InStock"}}</script>
      <script>window.product={"c_variantsInfo":[{"product_id":"811716","c_variation_attribute_name":"194 Sparkly Dice","c_price":215}]};</script>
    `;

    expect(parseProductHtml('sephora_uae', sephoraUrl, html)).toEqual(expect.objectContaining({
      siteKey: 'sephora_uae',
      title: 'Dior Addict Glass Lipstick',
      sku: '811716',
      priceMinor: 21500,
      currency: 'AED',
      availability: 'in_stock'
    }));
  });

  it('parses Faces UAE product JSON-LD and retains shade products at page level', () => {
    const html = `
      <link rel="canonical" href="${facesUrl}" />
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Dior Addict Glass Ultra-Shine and Hydrating Stick","sku":"009117909944","image":"https://www.faces.ae/images/009117909944.jpg","color":{"name":"194 Sparkly Dice"},"offers":{"@type":"Offer","price":"215.00","priceCurrency":"AED","availability":"http://schema.org/InStock"}}</script>
      <button data-attr="color" data-attr-value="194_sparkly_dice" data-pid="009117909944">194 Sparkly Dice</button>
    `;

    expect(parseProductHtml('faces_uae', facesUrl, html)).toEqual(expect.objectContaining({
      siteKey: 'faces_uae',
      title: 'Dior Addict Glass Ultra-Shine and Hydrating Stick',
      sku: '009117909944',
      priceMinor: 21500,
      currency: 'AED',
      availability: 'in_stock'
    }));
  });

  it('parses Adidas.ae JSON-LD product data', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="adidas Adicolor Classics 3-Stripes Hoodie - Black | adidas UAE" />
          <meta property="og:image" content="https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/abc123def456_9366/Adicolor_Classics_3-Stripes_Hoodie_Black_IX7573_01_laydown.jpg" />
          <link rel="canonical" href="https://www.adidas.ae/en/adicolor-classics-3-stripes-hoodie/IX7573.html" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "Adicolor Classics 3-Stripes Hoodie",
              "sku": "IX7573",
              "image": "https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/abc123def456_9366/Adicolor_Classics_3-Stripes_Hoodie_Black_IX7573_01_laydown.jpg",
              "offers": {
                "@type": "Offer",
                "price": "299.00",
                "priceCurrency": "AED",
                "availability": "https://schema.org/InStock",
                "url": "https://www.adidas.ae/en/adicolor-classics-3-stripes-hoodie/IX7573.html"
              }
            }
          </script>
        </head>
      </html>
    `;

    const parsed = parseProductHtml('adidas', adidasUrl, html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'adidas',
        canonicalUrl: adidasUrl,
        title: 'Adicolor Classics 3-Stripes Hoodie',
        sku: 'IX7573',
        imageUrl: 'https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/abc123def456_9366/Adicolor_Classics_3-Stripes_Hoodie_Black_IX7573_01_laydown.jpg',
        priceMinor: 29900,
        currency: 'AED',
        availability: 'in_stock'
      })
    );
  });

  it('falls back to adidas-specific parser when structured data availability is unknown', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Adicolor Classics 3-Stripes Hoodie - Black" />
          <meta property="og:image" content="https://assets.adidas.com/images/abc123.jpg" />
          <link rel="canonical" href="https://www.adidas.ae/en/adicolor-classics-3-stripes-hoodie/IX7573.html" />
        </head>
        <body>
          <h1 class="product-name">Adicolor Classics 3-Stripes Hoodie</h1>
          <div class="sales-price">AED 299.00</div>
          <div data-pid="IX7573" data-available="true">
            <button class="add-to-bag">Add to Bag</button>
          </div>
        </body>
      </html>
    `;

    const parsed = parseProductHtml('adidas', adidasUrl, html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'adidas',
        title: 'Adicolor Classics 3-Stripes Hoodie',
        sku: 'IX7573',
        priceMinor: 29900,
        currency: 'AED',
        availability: 'in_stock'
      })
    );
  });

  it('keeps a structured Adidas price while using the page out-of-stock signal', () => {
    const html = `
      <html>
        <head>
          <link rel="canonical" href="https://www.adidas.ae/en/adizero-evo-sl-shoes/KI6901.html" />
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"Product","name":"Adizero EVO SL Shoes","sku":"KI6901","offers":{"@type":"Offer","price":"699.00","priceCurrency":"AED"}}
          </script>
        </head>
        <body><div class="out-of-stock">Sold out</div></body>
      </html>
    `;

    const parsed = parseProductHtml('adidas', adidasUrl, html);

    expect(parsed).toEqual(
      expect.objectContaining({
        title: 'Adizero EVO SL Shoes',
        priceMinor: 69900,
        currency: 'AED',
        availability: 'out_of_stock'
      })
    );
  });

  it('parses an adidas OOS product from JSON-LD', () => {
    const html = `
      <html>
        <head>
          <link rel="canonical" href="https://www.adidas.ae/en/ultraboost-1-0-shoes/IH1234.html" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "Ultraboost 1.0 Shoes",
              "sku": "IH1234",
              "offers": {
                "@type": "Offer",
                "price": "699.00",
                "priceCurrency": "AED",
                "availability": "https://schema.org/OutOfStock"
              }
            }
          </script>
        </head>
      </html>
    `;

    const parsed = parseProductHtml('adidas', 'https://www.adidas.ae/en/ultraboost-1-0-shoes/IH1234.html', html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'adidas',
        title: 'Ultraboost 1.0 Shoes',
        availability: 'out_of_stock'
      })
    );
  });

  it('parses BFL product from __NEXT_DATA__ SSR payload', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Women Paisley Print Tiered Dress, Multicolor | Brands For Less" />
          <meta property="og:image" content="https://f.bflcdn.com/t_pl/f_auto,q_auto/products/26/3/3607171932634_1.JPG" />
          <link rel="canonical" href="https://www.brandsforless.com/en-ae/women-paisley-print-tiered-dress-multicolor/1966137/p/" />
        </head>
        <body>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "product": {
                    "id": "1966137",
                    "name": "Women Paisley Print Tiered Dress, Multicolor",
                    "price": "397",
                    "priceInAED": "397",
                    "inStock": true,
                    "images": [{"url": "https://f.bflcdn.com/t_pl/f_auto,q_auto/products/26/3/3607171932634_1.JPG"}]
                  }
                }
              }
            }
          </script>
        </body>
      </html>
    `;

    const parsed = parseProductHtml('brands_for_less', bflUrl, html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'brands_for_less',
        title: 'Women Paisley Print Tiered Dress, Multicolor',
        sku: '1966137',
        imageUrl: 'https://f.bflcdn.com/t_pl/f_auto,q_auto/products/26/3/3607171932634_1.JPG',
        priceMinor: 39700,
        currency: 'AED',
        availability: 'in_stock'
      })
    );
  });

  it('falls back to meta tags when BFL __NEXT_DATA__ is missing', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Women Velvet Mini Dress, Black | Brands For Less" />
          <meta property="og:image" content="https://f.bflcdn.com/products/26/3/3607171841233_1.JPG" />
          <meta property="product:price:amount" content="224" />
          <meta property="product:price:currency" content="AED" />
          <link rel="canonical" href="https://www.brandsforless.com/en-ae/women-velvet-mini-dress-black/1967170/p/" />
        </head>
        <body>
          <h1 class="product_title">Women Velvet Mini Dress, Black</h1>
          <button>Add to Bag</button>
        </body>
      </html>
    `;

    const parsed = parseProductHtml('brands_for_less', 'https://www.brandsforless.com/en-ae/women-velvet-mini-dress-black/1967170/p/', html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'brands_for_less',
        title: 'Women Velvet Mini Dress, Black',
        priceMinor: 22400,
        currency: 'AED',
        availability: 'in_stock'
      })
    );
  });

  it('detects BFL out-of-stock products', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Women Knitted Bodycon Dress, Olive" />
          <link rel="canonical" href="https://www.brandsforless.com/en-ae/women-knitted-bodycon-dress-olive/1967052/p/" />
          <meta property="product:price:amount" content="292" />
        </head>
        <body>
          <h1>Women Knitted Bodycon Dress, Olive</h1>
          <p class="stock out-of-stock">Sold out</p>
        </body>
      </html>
    `;

    const parsed = parseProductHtml('brands_for_less', 'https://www.brandsforless.com/en-ae/women-knitted-bodycon-dress-olive/1967052/p/', html);

    expect(parsed).toEqual(
      expect.objectContaining({
        siteKey: 'brands_for_less',
        title: 'Women Knitted Bodycon Dress, Olive',
        availability: 'out_of_stock'
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

  it('detects Adidas.ae product URLs', () => {
    expect(detectSupportedSite(adidasUrl)?.key).toBe('adidas');
    expect(detectSupportedSite('https://adidas.ae/en/ultraboost-1-0-shoes/IH1234.html')?.key).toBe('adidas');
    expect(detectSupportedSite('https://www.adidas.ae/en/product.html')?.key).toBe('adidas');
  });

  it('detects PUMA UAE product URLs', () => {
    expect(detectSupportedSite(pumaUrl)?.key).toBe('puma_uae');
    expect(detectSupportedSite('https://ae.puma.com/en/pd/example/123456.html')?.key).toBe('puma_uae');
  });

  it('detects Decathlon UAE product URLs', () => {
    expect(detectSupportedSite(decathlonUrl)?.key).toBe('decathlon_uae');
    expect(detectSupportedSite('https://www.decathlon.ae/products/example')?.key).toBe('decathlon_uae');
  });

  it('detects Sephora UAE and Faces UAE product URLs', () => {
    expect(detectSupportedSite(sephoraUrl)?.key).toBe('sephora_uae');
    expect(detectSupportedSite('https://sephora.me/ae-en/p/example/P10001')?.key).toBe('sephora_uae');
    expect(detectSupportedSite(facesUrl)?.key).toBe('faces_uae');
    expect(detectSupportedSite('https://faces.ae/en/p/example-pm000000000001.html')?.key).toBe('faces_uae');
  });

  it('detects Brands For Less product URLs', () => {
    expect(detectSupportedSite(bflUrl)?.key).toBe('brands_for_less');
    expect(detectSupportedSite('https://brandsforless.com/en-ae/women-shoes/12345/p/')?.key).toBe('brands_for_less');
    expect(detectSupportedSite('https://www.brandsforless.com/en-ae/product/')?.key).toBe('brands_for_less');
  });
});

describe('detectSharedUrl', () => {
  it('extracts a URL from browser share text that includes a product title', () => {
    expect(
      detectSharedUrl('Galaxy S25 Ultra on Noon https://www.noon.com/uae-en/galaxy-s25-ultra/N70140492V/p/')
    ).toBe('https://www.noon.com/uae-en/galaxy-s25-ultra/N70140492V/p/');
  });

  it('returns no URL when the shared text has no web link', () => {
    expect(detectSharedUrl('Galaxy S25 Ultra')).toBeUndefined();
  });
});

describe('cleanUrl', () => {
  it('reduces Amazon product links to a stable direct ASIN URL', () => {
    expect(
      cleanUrl('https://www.amazon.ae/Some-Long-Product-Name/dp/B005BFCNYU?ref_=share&tag=example')
    ).toBe('https://www.amazon.ae/dp/B005BFCNYU');
    expect(
      cleanUrl('https://www.amazon.co.uk/gp/product/B005BFCNYU/ref=something?th=1')
    ).toBe('https://www.amazon.co.uk/dp/B005BFCNYU');
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

  it('uses the native Android request profile for Decathlon UAE', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => `
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Germany 26 Home Replica Jersey","offers":{"@type":"Offer","price":"299","priceCurrency":"AED","availability":"https://schema.org/InStock"}}</script>
      `
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchAndParseProduct('https://decathlon.ae/collections/adidas/products/germany-26-home-replica-jersey-white?variant=46671030255806');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {}
      })
    );
  });

  it('retries the exact Sephora URL once after a transient block', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => `
          <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Dior Addict Glass Lipstick","sku":"811716","image":"https://img-product.sephora.me/811716.jpeg","offers":{"@type":"Offer","price":"215","priceCurrency":"AED","availability":"InStock"}}</script>
        `
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchAndParseProduct(sephoraUrl);

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      sephoraUrl,
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(result).toEqual({
      ok: true,
      product: expect.objectContaining({
        siteKey: 'sephora_uae',
        canonicalUrl: sephoraUrl,
        title: 'Dior Addict Glass Lipstick',
        imageUrl: 'https://img-product.sephora.me/811716.jpeg',
        priceMinor: 21500,
        currency: 'AED',
        availability: 'in_stock',
        sku: '811716'
      })
    });
  });

  it('returns selectable sizes for the reported Level Shoes URL', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => `
        <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"productDetails":{"id":1166245,"name":"GEL-KINETIC FLUENT sneakers","rawSalePrice":810,"sku":"0D7VYB"},"__APOLLO_STATE__":{"ProductDetails:1166245":{"detail":{"sizeOptions":[{"sku":"095927913494","label":"37","rawSalePrice":810,"isInStock":false},{"sku":"095927913502","label":"42","rawSalePrice":810,"isInStock":true},{"sku":"095927914522","label":"48","rawSalePrice":810,"isInStock":true}]}}}}}}</script>
      `
    })) as unknown as typeof fetch;

    const result = await fetchAndParseProduct(
      'https://www.levelshoes.com/asics-gel-kinetic-fluent-sneakers-beige-fabric-low-tops-0d7vyb.html'
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        product: expect.objectContaining({
          variants: expect.arrayContaining([
            expect.objectContaining({ id: '095927913502', label: 'Size: 42', availability: 'in_stock' }),
            expect.objectContaining({ id: '095927914522', label: 'Size: 48', availability: 'in_stock' })
          ])
        })
      })
    );
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

  it('reports when a saved variant no longer appears in the fetched page', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => `
        <html><body>
          <h1 class="product_title">Helmet</h1>
          <form data-product_variations="[{&quot;variation_id&quot;:11,&quot;attributes&quot;:{&quot;attribute_pa_size&quot;:&quot;M&quot;},&quot;display_price&quot;:500,&quot;is_in_stock&quot;:true,&quot;sku&quot;:&quot;HELMET-M&quot;}]"></form>
        </body></html>
      `
    })) as unknown as typeof fetch;

    const result = await fetchAndParseProduct(aymUrl, {
      id: '12',
      label: 'Size: L',
      attributes: [{ name: 'Size', value: 'L' }]
    });

    expect(result).toEqual({
      ok: false,
      code: 'variant_not_found',
      message: 'The selected product option is no longer available on this page.'
    });
  });
});
