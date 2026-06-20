import { Linking, NativeModules, PermissionsAndroid, Platform } from 'react-native';

import { formatPrice } from './price';
import { ParsedProduct, TrackedProduct } from './types';

type NotificationModule = {
  areEnabled?: () => Promise<boolean>;
  notifyPriceAlert?: (title: string, message: string, notificationId: number) => Promise<boolean>;
  openNotificationSettings?: () => Promise<boolean>;
};

const notificationModule = NativeModules.QeematNotifications as NotificationModule | undefined;

export async function ensureNotificationPermission(promptIfNeeded = true): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const nativeEnabled = await notificationModule?.areEnabled?.().catch(() => false);

  if (Platform.Version < 33) {
    return nativeEnabled ?? true;
  }

  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  const alreadyGranted = await PermissionsAndroid.check(permission);
  if (alreadyGranted) {
    return nativeEnabled ?? true;
  }

  if (!promptIfNeeded) {
    return false;
  }

  const result = await PermissionsAndroid.request(permission);
  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    return false;
  }

  return (await notificationModule?.areEnabled?.().catch(() => true)) ?? true;
}

export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS === 'android' && notificationModule?.openNotificationSettings) {
    await notificationModule.openNotificationSettings();
    return;
  }

  await Linking.openSettings();
}

export async function maybeNotifyForCheck(
  product: TrackedProduct,
  parsed: ParsedProduct,
  previousPriceMinor?: number,
  newPriceMinor?: number
): Promise<void> {
  if (Platform.OS !== 'android' || !notificationModule?.notifyPriceAlert) {
    return;
  }

  if (!(await ensureNotificationPermission(false))) {
    return;
  }

  const notification = buildNotification(product, parsed, previousPriceMinor, newPriceMinor);
  if (!notification) {
    return;
  }

  await notificationModule.notifyPriceAlert(notification.title, notification.message, product.id).catch(() => false);
}

function buildNotification(
  product: TrackedProduct,
  parsed: ParsedProduct,
  previousPriceMinor?: number,
  newPriceMinor?: number
): { title: string; message: string } | undefined {
  if (newPriceMinor === undefined) {
    return undefined;
  }

  const currency = parsed.currency ?? product.currency;
  const currentPrice = formatPrice(newPriceMinor, currency);
  const previousPrice = previousPriceMinor !== undefined ? formatPrice(previousPriceMinor, currency) : undefined;
  const productLabel = product.title || parsed.title;

  if (product.alertMode === 'target_price') {
    if (product.targetPriceMinor === undefined || newPriceMinor > product.targetPriceMinor) {
      return undefined;
    }

    return {
      title: 'Target price reached',
      message: `${productLabel} is now ${currentPrice}.`
    };
  }

  if (previousPriceMinor === undefined || previousPriceMinor === newPriceMinor) {
    return undefined;
  }

  if (product.alertMode === 'price_drop' && newPriceMinor >= previousPriceMinor) {
    return undefined;
  }

  return {
    title: newPriceMinor < previousPriceMinor ? 'Price dropped' : 'Price changed',
    message: previousPrice ? `${productLabel} changed from ${previousPrice} to ${currentPrice}.` : `${productLabel} is now ${currentPrice}.`
  };
}
