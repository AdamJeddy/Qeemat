import { NativeModules, Platform } from 'react-native';

type BackgroundCheckModule = {
  schedule?: (preferredHour: number) => Promise<boolean>;
  runOnce?: () => Promise<boolean>;
  cancel?: () => Promise<boolean>;
};

const backgroundCheck = NativeModules.QeematBackgroundCheck as BackgroundCheckModule | undefined;

export async function scheduleBackgroundChecks(preferredHour = 9): Promise<boolean> {
  if (Platform.OS !== 'android' || !backgroundCheck?.schedule) {
    return false;
  }

  return backgroundCheck.schedule(preferredHour);
}

export async function runBackgroundCheckOnce(): Promise<boolean> {
  if (Platform.OS !== 'android' || !backgroundCheck?.runOnce) {
    return false;
  }

  return backgroundCheck.runOnce();
}

export async function cancelBackgroundChecks(): Promise<boolean> {
  if (Platform.OS !== 'android' || !backgroundCheck?.cancel) {
    return false;
  }

  return backgroundCheck.cancel();
}
