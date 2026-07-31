import { checkProductNow } from '../checker';
import { fetchAndParseProduct } from '../parser';
import { TrackedProduct } from '../types';

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
  it('does not fetch a product already confirmed out of stock', async () => {
    await checkProductNow(outOfStockProduct, 'manual_single');

    expect(fetchAndParseProduct).not.toHaveBeenCalled();
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
});
