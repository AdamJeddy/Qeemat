import { groupDiscoveryProducts } from '../discoveryGroups';
import type { DiscoveryProduct, SiteKey, TrackedProduct } from '../types';

const OBSERVED_AT = '2026-11-14T08:00:00.000Z';
const EARLIER = '2026-11-13T08:00:00.000Z';
const MIDDLE = '2026-11-13T20:00:00.000Z';

function product(
  id: string,
  siteKey: SiteKey,
  title: string,
  priceMinor: number | undefined,
  overrides: Partial<DiscoveryProduct> = {}
): DiscoveryProduct {
  const slug = id.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return {
    id,
    siteKey,
    title,
    priceMinor,
    brand: 'Nike',
    category: 'fashion',
    url: `https://www.${siteKey.replace(/_/g, '')}.com/products/${slug}`,
    imageUrl: `https://images.qeemat.test/${slug}.jpg`,
    currency: 'AED',
    availability: 'in_stock',
    observedAt: OBSERVED_AT,
    ...overrides
  };
}

function trackedProduct(
  overrides: Partial<TrackedProduct> & Pick<TrackedProduct, 'id' | 'title'>
): TrackedProduct {
  return {
    url: `https://www.noon.com/uae-en/tracked/${overrides.id}`,
    canonicalUrl: `https://www.noon.com/uae-en/tracked/${overrides.id}`,
    siteKey: 'noon',
    currency: 'AED',
    alertMode: 'price_drop',
    checkPreference: 'daily',
    isActive: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-11-14T00:00:00.000Z',
    ...overrides
  };
}

const PEGASUS_41 = 'Nike Air Zoom Pegasus 41 Running Shoes';
const PEGASUS_41_ID = 'group:nike:shoes:41-air-pegasus-running-shoes-zoom';

describe('cross-retailer product grouping', () => {
  it('clubs differently worded listings from two retailers and reports the best offer', () => {
    const groups = groupDiscoveryProducts([
      product('noon-pegasus-41', 'noon', "Nike Air Zoom Pegasus 41 Men's Running Shoes - Black", 41900, {
        imageUrl: 'https://images.qeemat.test/noon-pegasus-black.jpg',
        observedAt: EARLIER
      }),
      product('sss-pegasus-41', 'sun_sand_sports', PEGASUS_41, 37900, {
        imageUrl: 'https://images.qeemat.test/sss-pegasus.jpg'
      })
    ]);

    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.id).toBe(PEGASUS_41_ID);
    expect(group.title).toBe(PEGASUS_41);
    expect(group.imageUrl).toBe('https://images.qeemat.test/sss-pegasus.jpg');
    expect(group.brand).toBe('Nike');
    expect(group.currency).toBe('AED');
    expect(group.observedAt).toBe(OBSERVED_AT);
    expect(group.offers.map((offer) => offer.product.siteKey)).toEqual(['sun_sand_sports', 'noon']);
    expect(group.offers.map((offer) => offer.order)).toEqual([1, 0]);
    expect(group.offers.map((offer) => offer.priceDeltaMinor)).toEqual([0, 4000]);
    expect(group.bestOffer?.product.siteKey).toBe('sun_sand_sports');
    expect(group.comparableOfferCount).toBe(2);
    expect(group.priceSpreadMinor).toBe(4000);
    expect(group.previousBestPriceMinor).toBeUndefined();
  });

  it('keeps exactly one offer per retailer and prefers a usable in-stock price', () => {
    const groups = groupDiscoveryProducts([
      product('noon-pegasus-black', 'noon', `${PEGASUS_41} - Black`, 39900),
      product('noon-pegasus-white', 'noon', `${PEGASUS_41} - White`, 37900, {
        availability: 'out_of_stock'
      }),
      product('amazon-pegasus', 'amazon_ae', PEGASUS_41, 40900)
    ]);

    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.offers).toHaveLength(2);
    expect(new Set(group.offers.map((offer) => offer.product.siteKey)).size).toBe(group.offers.length);
    expect(group.offers.map((offer) => offer.product.id)).toEqual(['noon-pegasus-black', 'amazon-pegasus']);
    expect(group.bestOffer?.product.priceMinor).toBe(39900);
    expect(group.priceSpreadMinor).toBe(1000);
  });

  it('clubs the same model in different colourways', () => {
    const groups = groupDiscoveryProducts([
      product('noon-samba-white', 'noon', 'Adidas Samba OG Shoes - White', 39900, { brand: 'Adidas' }),
      product('amazon-samba-black', 'amazon_ae', 'Adidas Samba OG Shoes - Black', 36900, { brand: 'Adidas' })
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('group:adidas:shoes:og-samba-shoes');
    expect(groups[0].bestOffer?.product.siteKey).toBe('amazon_ae');
    expect(groups[0].priceSpreadMinor).toBe(3000);
  });

  it('does not club a different numeric model of the same product line', () => {
    const groups = groupDiscoveryProducts([
      product('noon-iphone-16', 'noon', 'Apple iPhone 16 Pro 128GB', 419900, {
        brand: 'Apple',
        category: 'electronics'
      }),
      product('amazon-iphone-15', 'amazon_ae', 'Apple iPhone 15 Pro 128GB', 379900, {
        brand: 'Apple',
        category: 'electronics'
      })
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.id)).toEqual([
      'group:apple:phone:128gb-16-phone-pro',
      'group:apple:phone:128gb-15-phone-pro'
    ]);
    expect(groups.map((group) => group.bestOffer)).toEqual([undefined, undefined]);
  });

  it('does not club identical titles from different brands', () => {
    const groups = groupDiscoveryProducts([
      product('noon-nitro', 'noon', 'Nike Velocity Nitro 3 Running Shoes', 39900),
      product('amazon-nitro', 'amazon_ae', 'Adidas Velocity Nitro 3 Running Shoes', 35900, { brand: 'Adidas' })
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.brand)).toEqual(['Nike', 'Adidas']);
  });

  it('does not club generic running-shoe listings without a model token', () => {
    const groups = groupDiscoveryProducts([
      product('noon-generic', 'noon', 'Nike Running Shoes', 19900),
      product('amazon-generic', 'amazon_ae', 'Nike Running Shoes for Men', 17900)
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.offers)).toHaveLength(2);
    expect(groups.every((group) => group.offers.length === 1)).toBe(true);
  });

  it('clubs repeated unknown-brand titles only when the signature is distinctive', () => {
    const groups = groupDiscoveryProducts([
      product('noon-holder', 'noon', 'Minimalist Leather Card Holder', 9900, { brand: 'Other brands' }),
      product('amazon-holder', 'amazon_ae', 'Minimalist Leather Card Holder', 11900, { brand: 'Other brands' }),
      product('noon-wallet', 'noon', 'Leather Wallet', 7900, { brand: 'Other brands' }),
      product('amazon-wallet', 'amazon_ae', 'Leather Wallet', 8900, { brand: 'Other brands' })
    ]);

    expect(groups).toHaveLength(3);
    expect(groups[0].id).toBe('group:unknown:other:card-holder-leather-minimalist');
    expect(groups[0].offers).toHaveLength(2);
    expect(groups[1].id).toBe('group:unknown:wallet:leather-wallet');
    expect(groups[1].offers).toHaveLength(1);
    expect(groups[2].offers).toHaveLength(1);
  });

  it('never uses an out-of-stock offer as the best offer', () => {
    const groups = groupDiscoveryProducts([
      product('noon-pegasus', 'noon', PEGASUS_41, 39900),
      product('amazon-pegasus', 'amazon_ae', PEGASUS_41, 42900),
      product('nike-pegasus', 'nike_uae', PEGASUS_41, 34900, { availability: 'out_of_stock' })
    ]);

    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.offers.map((offer) => offer.product.siteKey)).toEqual(['noon', 'amazon_ae', 'nike_uae']);
    expect(group.offers[2].comparable).toBe(false);
    expect(group.offers[2].priceDeltaMinor).toBeUndefined();
    expect(group.bestOffer?.product.siteKey).toBe('noon');
    expect(group.comparableOfferCount).toBe(2);
    expect(group.priceSpreadMinor).toBe(3000);
  });

  it('never uses a range-priced offer as the best offer', () => {
    const groups = groupDiscoveryProducts([
      product('noon-pegasus', 'noon', PEGASUS_41, 34900, { hasPriceRange: true }),
      product('amazon-pegasus', 'amazon_ae', PEGASUS_41, 39900),
      product('nike-pegasus', 'nike_uae', PEGASUS_41, 42900)
    ]);

    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.offers.map((offer) => offer.product.siteKey)).toEqual(['amazon_ae', 'nike_uae', 'noon']);
    expect(group.offers[2].comparable).toBe(false);
    expect(group.bestOffer?.product.siteKey).toBe('amazon_ae');
    expect(group.priceSpreadMinor).toBe(3000);
  });

  it('keeps a single-offer group honest: no best offer, no spread, stable price', () => {
    const groups = groupDiscoveryProducts([product('noon-pegasus', 'noon', PEGASUS_41, 37900)]);

    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.offers).toHaveLength(1);
    expect(group.offers[0].comparable).toBe(true);
    expect(group.offers[0].priceDeltaMinor).toBe(0);
    expect(group.bestOffer).toBeUndefined();
    expect(group.comparableOfferCount).toBe(1);
    expect(group.priceSpreadMinor).toBeUndefined();
    expect(group.previousBestPriceMinor).toBeUndefined();
  });

  it('reports a previous best price only when every comparable offer has one', () => {
    const complete = [
      product('noon-pegasus', 'noon', PEGASUS_41, 39900, { previousPriceMinor: 41900 }),
      product('amazon-pegasus', 'amazon_ae', PEGASUS_41, 37900, { previousPriceMinor: 39900 }),
      product('nike-pegasus', 'nike_uae', PEGASUS_41, 41900, { previousPriceMinor: 43900 })
    ];
    const [group] = groupDiscoveryProducts(complete);
    expect(group.previousBestPriceMinor).toBe(39900);
    expect(group.priceSpreadMinor).toBe(4000);

    const [incomplete] = groupDiscoveryProducts([
      complete[0],
      complete[1],
      product('nike-pegasus', 'nike_uae', PEGASUS_41, 41900)
    ]);
    expect(incomplete.previousBestPriceMinor).toBeUndefined();
  });

  it('deduplicates repeated copies of one retailer listing before grouping', () => {
    const groups = groupDiscoveryProducts([
      product('noon:1', 'noon', PEGASUS_41, 41900, {
        url: 'https://www.noon.com/uae-en/pegasus-41/p/ABC',
        observedAt: EARLIER,
        collectionIds: ['sale']
      }),
      product('noon:2', 'noon', PEGASUS_41, 40900, {
        url: 'https://www.noon.com/uae-en/pegasus-41/p/ABC?utm_source=feed',
        observedAt: MIDDLE,
        categories: ['fashion', 'sport']
      }),
      product('noon:1', 'noon', `${PEGASUS_41} - Sale`, 39900, {
        url: 'https://www.noon.com/uae-en/nike-pegasus-41-other-slug',
        observedAt: OBSERVED_AT,
        collectionIds: ['new'],
        imageUrl: 'https://images.qeemat.test/noon-pegasus-latest.jpg'
      })
    ]);

    expect(groups).toHaveLength(1);
    const [offer] = groups[0].offers;
    expect(groups[0].offers).toHaveLength(1);
    expect(offer.product.id).toBe('noon:1');
    expect(offer.order).toBe(0);
    expect(offer.product.priceMinor).toBe(39900);
    expect(offer.product.observedAt).toBe(OBSERVED_AT);
    expect(offer.product.categories).toEqual(['fashion', 'sport']);
    expect(offer.product.collectionIds).toEqual(['sale', 'new']);
    expect(offer.product.imageUrl).toBe('https://images.qeemat.test/noon-pegasus-latest.jpg');
  });
});

describe('tracked-product matching', () => {
  it('prefers an exact URL match over a title match', () => {
    const groups = groupDiscoveryProducts(
      [
        product('noon-pegasus', 'noon', PEGASUS_41, 37900, {
          url: 'https://www.noon.com/uae-en/pegasus-41/p/ABC?utm_source=feed'
        })
      ],
      {
        trackedProducts: [
          trackedProduct({ id: 1, title: PEGASUS_41, brand: 'Nike' }),
          trackedProduct({
            id: 2,
            title: 'Shoes I track',
            canonicalUrl: 'https://www.noon.com/uae-en/pegasus-41/p/ABC/'
          })
        ]
      }
    );

    expect(groups[0].trackedProduct?.id).toBe(2);
  });

  it('matches an active tracked product by conservative brand and signature', () => {
    const groups = groupDiscoveryProducts(
      [product('noon-pegasus', 'noon', PEGASUS_41, 37900), product('amazon-pegasus', 'amazon_ae', PEGASUS_41, 35900)],
      {
        trackedProducts: [
          trackedProduct({ id: 1, title: PEGASUS_41, brand: 'Nike', isActive: false }),
          trackedProduct({ id: 2, title: PEGASUS_41, brand: 'Other brands' }),
          trackedProduct({ id: 3, title: "Nike Air Zoom Pegasus 41 Men's Running Shoes", brand: 'Nike' })
        ]
      }
    );

    expect(groups[0].trackedProduct?.id).toBe(3);
    expect(groups[0].id).toBe(PEGASUS_41_ID);

    const [unmatched] = groupDiscoveryProducts([product('noon-pegasus', 'noon', PEGASUS_41, 37900)], {
      trackedProducts: [trackedProduct({ id: 2, title: PEGASUS_41, brand: 'Other brands' })]
    });
    expect(unmatched.trackedProduct).toBeUndefined();
  });
});

describe('group identity and ordering', () => {
  it('keeps a stable id, deterministic order and leaves the input untouched', () => {
    const products = [
      product('noon-pegasus', 'noon', PEGASUS_41, 39900),
      product('noon-samba', 'noon', 'Adidas Samba OG Shoes - White', 36900, { brand: 'Adidas' }),
      product('amazon-pegasus', 'amazon_ae', PEGASUS_41, 37900)
    ];
    const snapshot = JSON.stringify(products);

    const first = groupDiscoveryProducts(products);
    const second = groupDiscoveryProducts(products);

    expect(first).toEqual(second);
    expect(JSON.stringify(products)).toBe(snapshot);
    expect(first.map((group) => group.id)).toEqual([PEGASUS_41_ID, 'group:adidas:shoes:og-samba-shoes']);
    expect(first[0].offers.map((offer) => offer.product.siteKey)).toEqual(['amazon_ae', 'noon']);
    expect(first[0].offers.map((offer) => offer.order)).toEqual([2, 0]);

    const repriced = groupDiscoveryProducts([{ ...products[0], priceMinor: 34900 }, products[1], products[2]]);
    expect(repriced[0].id).toBe(first[0].id);
  });

  it('refuses to compare prices that do not share a pack or weight basis', () => {
    const groups = groupDiscoveryProducts([
      product('noon-milk', 'noon', 'Almarai Full Fat Milk 1 L', 1050, { brand: 'Almarai', priceBasis: 'kg' }),
      product('amazon-milk', 'amazon_ae', 'Almarai Full Fat Milk 1 L', 990, { brand: 'Almarai' })
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].offers).toHaveLength(2);
    expect(groups[0].offers.every((offer) => !offer.comparable)).toBe(true);
    expect(groups[0].comparableOfferCount).toBe(0);
    expect(groups[0].bestOffer).toBeUndefined();
  });

  it('keeps the same group id when the retailer refresh order changes', () => {
    const pegasus = product('noon-pegasus', 'noon', PEGASUS_41, 39900);
    const breathable = product('amazon-pegasus', 'amazon_ae', `${PEGASUS_41} Breathable`, 37900);

    const forward = groupDiscoveryProducts([pegasus, breathable]);
    const reversed = groupDiscoveryProducts([breathable, pegasus]);

    expect(forward).toHaveLength(1);
    expect(reversed).toHaveLength(1);
    expect(reversed[0].id).toBe(forward[0].id);
  });

  it('returns an empty list and tolerates malformed listings', () => {
    expect(groupDiscoveryProducts([])).toEqual([]);
    expect(
      groupDiscoveryProducts([
        null as unknown as DiscoveryProduct,
        { title: 'Missing site key' } as unknown as DiscoveryProduct
      ])
    ).toEqual([]);
  });

  it('falls back to the retailer listing identity when an unknown brand has no signature', () => {
    const groups = groupDiscoveryProducts([
      product('noon:17', 'noon', 'Black', undefined, { brand: 'Other brands' })
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('group:unknown:noon:noon:17');
    expect(groups[0].offers).toHaveLength(1);
    expect(groups[0].bestOffer).toBeUndefined();
  });
});
