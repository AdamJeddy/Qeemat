import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { checkForUpdate } from './updates';

const LAST_NOTIFIED_KEY = '@qeemat/update-last-notified';

export async function clearUpdateNotificationHistory(): Promise<void> {
  await AsyncStorage.removeItem(LAST_NOTIFIED_KEY);
}

export async function runBackgroundUpdateCheck(): Promise<void> {
  if (Platform.OS !== 'android') { return; }
  const version = NativeModules.QeematBackgroundCheck?.getConstants?.()?.appVersion;
  const notify = NativeModules.QeematNotifications?.notifyAppUpdate;
  if (typeof version !== 'string' || typeof notify !== 'function') { return; }
  try {
    const update = await checkForUpdate(version);
    if (!update || await AsyncStorage.getItem(LAST_NOTIFIED_KEY) === update.version) { return; }
    if (await notify(update.version)) { await AsyncStorage.setItem(LAST_NOTIFIED_KEY, update.version); }
  } catch {
    // Try again on the next scheduled run if storage or notifications are unavailable.
  }
}
