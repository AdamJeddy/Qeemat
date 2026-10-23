jest.mock('react-native', () => ({
  Linking: { openSettings: jest.fn() },
  NativeModules: {
    QeematNotifications: {
      areEnabled: jest.fn().mockResolvedValue(true),
      notifyPriceAlert: jest.fn().mockResolvedValue(true)
    }
  },
  Platform: { OS: 'android', Version: 34 },
  PermissionsAndroid: {
    PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
    RESULTS: { GRANTED: 'granted' },
    check: jest.fn().mockResolvedValue(true),
    request: jest.fn()
  }
}));

import { NativeModules } from 'react-native';

import { maybeNotifyForCheck } from '../notifications';
import { ParsedProduct, TrackedProduct } from '../types';

const product: TrackedProduct = {
  id: 7,
  url: 'https://www.levelshoes.com/example.html',
  canonicalUrl: 'https://www.levelshoes.com/example.html',
  siteKey: 'level_shoes',
  title: 'Example sneaker',
  currency: 'AED',
  currentPriceMinor: 50000,
  alertMode: 'price_drop',
  checkPreference: 'daily',
  isActive: true,
  variant: {
    id: 'SHOE-43',
    label: 'Size: EU 43',
    attributes: [{ name: 'Size', value: 'EU 43' }]
  },
  createdAt: '2026-07-31T00:00:00.000Z',
  updatedAt: '2026-07-31T00:00:00.000Z'
};

const outOfStock: ParsedProduct = {
  siteKey: 'level_shoes',
  canonicalUrl: product.canonicalUrl,
  title: product.title,
  currency: 'AED',
  availability: 'out_of_stock'
};

describe('variant notifications', () => {
  beforeEach(() => {
    jest.mocked(NativeModules.QeematNotifications.notifyPriceAlert).mockClear();
  });

  it('includes the saved option in an out-of-stock notification', async () => {
    await maybeNotifyForCheck(product, outOfStock, product.currentPriceMinor, undefined, 'in_stock');

    expect(NativeModules.QeematNotifications.notifyPriceAlert).toHaveBeenCalledWith(
      'Out of stock',
      'Example sneaker (Size: EU 43) is currently out of stock.',
      7
    );
  });

  it('notifies when an out-of-stock product returns to stock', async () => {
    const restocked: ParsedProduct = {
      ...outOfStock,
      availability: 'in_stock',
      priceMinor: 45000
    };

    await maybeNotifyForCheck(product, restocked, product.currentPriceMinor, restocked.priceMinor, 'out_of_stock');

    expect(NativeModules.QeematNotifications.notifyPriceAlert).toHaveBeenCalledWith(
      'Back in stock',
      'Example sneaker (Size: EU 43) is available again.',
      7
    );
  });

  it('only sends a price-drop alert when the configured minimum is met', async () => {
    const configuredProduct = { ...product, minimumPriceDropMinor: 1000 };
    const dropped: ParsedProduct = { ...outOfStock, availability: 'in_stock', priceMinor: 49500 };

    await maybeNotifyForCheck(configuredProduct, dropped, 50000, 49500, 'in_stock');

    expect(NativeModules.QeematNotifications.notifyPriceAlert).not.toHaveBeenCalled();

    await maybeNotifyForCheck(configuredProduct, dropped, 50000, 49000, 'in_stock');

    expect(NativeModules.QeematNotifications.notifyPriceAlert).toHaveBeenCalledWith(
      'Price dropped',
      'Example sneaker (Size: EU 43) changed from AED 500 to AED 490.',
      7
    );
  });
});
