import { fetchAndParseProduct } from '../parser';
import { VariantSelection } from '../types';

const productUrl = 'https://www.namshi.com/uae-en/buy-puma-short-puma-sport-graphic-9/V11AE4F2FC01E6AB59754V/p/';
const otherProductUrl = 'https://www.namshi.com/uae-en/buy-h-m-regular-fit-polo-shirt/Z84E3A268529162948948Z/p/';
const savedSize: VariantSelection = {
  id: 'namshi:size:m',
  label: 'Size: M',
  attributes: [{ name: 'Size', value: 'M' }],
  url: productUrl
};

// Reduced from the Product JSON-LD returned by the issue #52 URL on
// 2026-10-20. Its sold-out response contains no source size controls.
function productPage(availability?: string, canonicalUrl = productUrl, controls = ''): string {
  return `
    <html>
      <head>
        <link rel="canonical" href="${canonicalUrl}" />
        <script type="application/ld+json">${JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Puma  Short Puma Sport Graphic 9 for Men | Best Price UAE',
          sku: canonicalUrl === productUrl ? 'V11AE4F2FC01E6AB59754V-11' : 'Z84E3A268529162948948Z',
          offers: {
            '@type': 'Offer',
            url: canonicalUrl,
            ...(availability ? { availability: `https://schema.org/${availability}` } : {}),
            price: '249',
            priceCurrency: 'AED'
          }
        })}</script>
      </head>
      <body>${controls}</body>
    </html>
  `;
}

function respondWith(html: string, responseUrl = productUrl): void {
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    url: responseUrl,
    text: async () => html
  })) as unknown as typeof fetch;
}

describe('Namshi saved-size availability', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('records the saved M size as out of stock when its exact product is explicitly sold out without size controls', async () => {
    respondWith(productPage('OutOfStock'));

    const result = await fetchAndParseProduct(productUrl, savedSize);

    expect(result).toEqual({
      ok: true,
      product: expect.objectContaining({
        canonicalUrl: productUrl,
        availability: 'out_of_stock',
        selectedVariant: savedSize,
        priceMinor: undefined,
        rawPriceText: undefined,
        currency: 'AED'
      })
    });
  });

  it.each(['InStock', undefined])('keeps a missing size unresolved when page availability is %s', async (availability) => {
    respondWith(productPage(availability));

    expect(await fetchAndParseProduct(productUrl, savedSize)).toEqual(expect.objectContaining({
      ok: false,
      code: 'variant_not_found'
    }));
  });

  it('does not use another canonical product being sold out as evidence about the saved size', async () => {
    respondWith(productPage('OutOfStock', otherProductUrl));

    expect(await fetchAndParseProduct(productUrl, savedSize)).toEqual(expect.objectContaining({
      ok: false,
      code: 'variant_not_found'
    }));
  });

  it('does not infer saved-size stock after a redirect to another product', async () => {
    respondWith(productPage('OutOfStock', otherProductUrl), otherProductUrl);

    expect(await fetchAndParseProduct(productUrl, savedSize)).toEqual(expect.objectContaining({
      ok: false,
      code: 'variant_not_found'
    }));
  });

  it('uses explicit stock from the saved size control when other sizes remain available', async () => {
    respondWith(productPage('InStock', productUrl, `
      <section aria-label="Select Size">
        <button data-size="M" data-variant-id="namshi:size:m" disabled>M</button>
        <button data-size="L" data-variant-id="namshi:size:l">L</button>
      </section>
    `));

    expect(await fetchAndParseProduct(productUrl, savedSize)).toEqual({
      ok: true,
      product: expect.objectContaining({
        availability: 'out_of_stock',
        selectedVariant: savedSize,
        priceMinor: undefined
      })
    });
  });
});
