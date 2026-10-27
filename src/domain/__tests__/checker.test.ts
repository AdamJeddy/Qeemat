import { checkProductNow } from '../checker';
import { fetchAndParseProduct } from '../parser';
import { TrackedProduct } from '../types';
import { recordActivityEvent, recordFailedCheck, recordSuccessfulCheck } from '../../data/database';
import { maybeNotifyForCheck } from '../notifications';

jest.mock('../parser', () => ({
  fetchAndParseProduct: jest.fn()
}));

jest.mock('../../data/database', () => ({
  getTrackedProduct: jest.fn(),
  listTrackedProducts: jest.fn(),
  recordActivityEvent: jest.fn(),
  recordFailedCheck: jest.fn(),
  recordSuccessfulCheck: jest.fn()
}));

jest.mock('../notifications', () => ({
  maybeNotifyForCheck: jest.fn()
}));

const outOfStockProduct: TrackedProduct = {
  id: 1,
  url: 'https://www.noon.com/uae-en/example/p/',
  canonicalUrl: 'https://www.noon.com/uae-en/example/p/',
  siteKey: 'noon',
  title: 'Example product',
  currency: 'AED',
  currentPriceMinor: 10000,
  alertMode: 'price_drop',
  checkPreference: 'daily',
  isActive: true,
  lastAvailability: 'out_of_stock',
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z'
};

describe('checkProductNow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves history and suppresses alerts when the pack size changes', async () => {
    (recordSuccessfulCheck as jest.Mock).mockResolvedValue({ status: 'price_changed', previousPriceMinor: 10000, newPriceMinor: 500 });
    (fetchAndParseProduct as jest.Mock).mockResolvedValue({ ok: true, product: { title: 'Rice 500g', priceMinor: 500, currency: 'AED', availability: 'in_stock' } });
    await checkProductNow({ ...outOfStockProduct, title: 'Rice 1kg' }, 'manual_single');
    expect(recordSuccessfulCheck).not.toHaveBeenCalled();
    expect(maybeNotifyForCheck).not.toHaveBeenCalled();
    expect(recordActivityEvent).not.toHaveBeenCalled();
    expect(recordFailedCheck).toHaveBeenCalledWith(expect.anything(), 'unsupported_page', 'manual_single', expect.stringContaining('pack size or pricing unit'));
  });
  it('keeps The Deal exact-variant checks working when the endpoint uses an internal catalogue title', async () => {
    const product: TrackedProduct = { ...outOfStockProduct, siteKey: 'the_deal', title: 'Body lotion 100ml', variant: { id: 'v1', label: '100ml', attributes: [{ name: 'Size', value: '100ml' }] } };
    (fetchAndParseProduct as jest.Mock).mockResolvedValue({ ok: true, product: { title: 'Internal catalogue title', priceMinor: 9000, currency: 'AED', availability: 'in_stock' } });
    (recordSuccessfulCheck as jest.Mock).mockResolvedValue({ status: 'price_changed', previousPriceMinor: 10000, newPriceMinor: 9000 });
    await checkProductNow(product, 'manual_single');
    expect(recordFailedCheck).not.toHaveBeenCalled();
    expect(recordSuccessfulCheck).toHaveBeenCalledWith(product, expect.objectContaining({ title: 'Body lotion 100ml' }), 'manual_single');
  });

  it('rechecks a product already confirmed out of stock so it can detect a restock', async () => {
    (fetchAndParseProduct as jest.Mock).mockResolvedValue({
      ok: true,
      product: {
        siteKey: 'noon',
        canonicalUrl: outOfStockProduct.canonicalUrl,
        title: outOfStockProduct.title,
        priceMinor: 9000,
        currency: 'AED',
        availability: 'in_stock'
      }
    });
    (recordSuccessfulCheck as jest.Mock).mockResolvedValue({
      status: 'price_changed',
      previousPriceMinor: 10000,
      newPriceMinor: 9000
    });

    await checkProductNow(outOfStockProduct, 'manual_single');

    expect(fetchAndParseProduct).toHaveBeenCalledWith(outOfStockProduct.canonicalUrl, undefined);
  });

  it('does not record a repeated out-of-stock activity when the availability has not changed', async () => {
    (fetchAndParseProduct as jest.Mock).mockResolvedValue({
      ok: true,
      product: {
        siteKey: 'noon',
        canonicalUrl: outOfStockProduct.canonicalUrl,
        title: outOfStockProduct.title,
        currency: 'AED',
        availability: 'out_of_stock'
      }
    });
    (recordSuccessfulCheck as jest.Mock).mockResolvedValue({
      status: 'ok',
      previousPriceMinor: 10000,
      newPriceMinor: undefined
    });

    await checkProductNow(outOfStockProduct, 'manual_single');

    expect(recordActivityEvent).not.toHaveBeenCalled();
  });

  it('does not record a restock activity event when availability is unknown', async () => {
    (fetchAndParseProduct as jest.Mock).mockResolvedValue({
      ok: true,
      product: {
        siteKey: 'noon',
        canonicalUrl: outOfStockProduct.canonicalUrl,
        title: outOfStockProduct.title,
        priceMinor: 9000,
        currency: 'AED',
        availability: 'unknown'
      }
    });
    (recordSuccessfulCheck as jest.Mock).mockResolvedValue({
      status: 'price_changed',
      previousPriceMinor: 10000,
      newPriceMinor: 9000
    });

    await checkProductNow(outOfStockProduct, 'manual_single');

    expect(recordActivityEvent).toHaveBeenCalledWith(expect.objectContaining({ priceDirection: 'down' }));
    expect(recordActivityEvent).not.toHaveBeenCalledWith(expect.objectContaining({ availability: 'in_stock' }));
  });

  it('checks the exact saved variant instead of the page-level product', async () => {
    const variantProduct: TrackedProduct = {
      ...outOfStockProduct,
      lastAvailability: 'in_stock',
      variant: {
        id: 'SHOE-43',
        label: 'Size: EU 43',
        attributes: [{ name: 'Size', value: 'EU 43' }]
      }
    };
    (fetchAndParseProduct as jest.Mock).mockResolvedValue({
      ok: false,
      code: 'variant_not_found',
      message: 'The selected product option is no longer available on this page.'
    });

    await checkProductNow(variantProduct, 'manual_single');

    expect(fetchAndParseProduct).toHaveBeenCalledWith(variantProduct.canonicalUrl, variantProduct.variant);
  });

  it('preserves The Deal page title when an exact variation check returns a catalog name', async () => {
    const variantProduct: TrackedProduct = {
      ...outOfStockProduct,
      url: 'https://www.thedealoutlet.com/ae-en/serve-slide-1.0-fabric/0188147CMA0025.html',
      canonicalUrl: 'https://www.thedealoutlet.com/ae-en/serve-slide-1.0-fabric/0188147CMA0025.html',
      siteKey: 'the_deal',
      title: 'Serve Slide 1.0 Fabric',
      currentPriceMinor: 9200,
      lastAvailability: 'in_stock',
      variant: {
        id: '0188147CMA0025|color=blue|size=42sEU',
        label: 'Color: Blue · Size: 42 EU',
        attributes: [
          { name: 'Color', value: 'Blue' },
          { name: 'Size', value: '42 EU' }
        ],
        url: 'https://www.thedealoutlet.com/on/demandware.store/Sites-TheDealOutlet_AE-Site/en_AE/Product-Variation?dwvar_0188147CMA0025_color=blue&dwvar_0188147CMA0025_size=42sEU&pid=0188147CMA0025&quantity=1'
      }
    };
    (fetchAndParseProduct as jest.Mock).mockResolvedValue({
      ok: true,
      product: {
        siteKey: 'the_deal',
        canonicalUrl: variantProduct.canonicalUrl,
        title: 'SERVE SLIDE 10 124 2 CMA',
        priceMinor: 9200,
        currency: 'AED',
        availability: 'in_stock',
        selectedVariant: variantProduct.variant
      }
    });
    (recordSuccessfulCheck as jest.Mock).mockResolvedValue({
      status: 'ok',
      previousPriceMinor: 9200,
      newPriceMinor: 9200
    });

    await checkProductNow(variantProduct, 'manual_single');

    expect(recordSuccessfulCheck).toHaveBeenCalledWith(
      variantProduct,
      expect.objectContaining({ title: 'Serve Slide 1.0 Fabric' }),
      'manual_single'
    );
  });
});
