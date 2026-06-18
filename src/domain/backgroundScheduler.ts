import { NativeModules, Platform } from 'react-native';

type BackgroundCheckModule = {
  schedule?: () => Promise<boolean>;
  runOnce?: () => Promise<boolean>;
  cancel?: () => Promise<boolean>;
};

const backgroundCheck = NativeModules.QeematBackgroundCheck as BackgroundCheckModule | undefined;

export async function scheduleBackgroundChecks(): Promise<boolean> {
  if (Platform.OS !== 'android' || !backgroundCheck?.schedule) {
    return false;
  }

  return backgroundCheck.schedule();
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
