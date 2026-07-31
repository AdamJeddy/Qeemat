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
  it('includes the saved option in an out-of-stock notification', async () => {
    await maybeNotifyForCheck(product, outOfStock, product.currentPriceMinor, undefined, 'in_stock');

    expect(NativeModules.QeematNotifications.notifyPriceAlert).toHaveBeenCalledWith(
      'Out of stock',
      'Example sneaker (Size: EU 43) is currently out of stock.',
      7
    );
  });
});
