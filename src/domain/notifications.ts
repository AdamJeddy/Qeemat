import { ParsedProduct, TrackedProduct } from './types';

export async function ensureNotificationPermission(): Promise<boolean> {
  return true;
}

export async function maybeNotifyForCheck(
  _product: TrackedProduct,
  _parsed: ParsedProduct,
  _previousPriceMinor?: number,
  _newPriceMinor?: number
): Promise<void> {
  // Native Android notifications will be wired after the bare Android build is stable.
}
