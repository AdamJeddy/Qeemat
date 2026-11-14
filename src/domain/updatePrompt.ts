import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AvailableUpdate } from './updates';

const DISMISSED_VERSION_KEY = 'qeemat.update-dismissed-version.v1';

export async function getDismissedUpdateVersion(): Promise<string | undefined> {
  try {
    const version = await AsyncStorage.getItem(DISMISSED_VERSION_KEY);
    return version ?? undefined;
  } catch {
    return undefined;
  }
}

export async function dismissUpdateVersion(version: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_VERSION_KEY, version);
  } catch {
    // The notice can still be dismissed for this launch if storage is unavailable.
  }
}

export async function clearDismissedUpdateVersion(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DISMISSED_VERSION_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

export function shouldBadgeUpdate(update: AvailableUpdate | undefined, dismissedVersion: string | undefined): boolean {
  return Boolean(update) && update?.version === dismissedVersion;
}
