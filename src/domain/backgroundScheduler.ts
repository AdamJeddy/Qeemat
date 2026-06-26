import { NativeModules, Platform } from 'react-native';

type BackgroundCheckModule = {
  schedule?: (preferredHour: number) => Promise<boolean>;
  runOnce?: () => Promise<boolean>;
  runTestOnce?: (delayMinutes: number) => Promise<boolean>;
  cancel?: () => Promise<boolean>;
  isBatteryOptimizationExempt?: () => Promise<boolean>;
  requestBatteryOptimizationExemption?: () => Promise<boolean>;
  openAppSystemSettings?: () => Promise<boolean>;
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

export async function runBackgroundTestOnce(delayMinutes = 2): Promise<boolean> {
  if (Platform.OS !== 'android' || !backgroundCheck?.runTestOnce) {
    return false;
  }

  return backgroundCheck.runTestOnce(delayMinutes);
}

export async function cancelBackgroundChecks(): Promise<boolean> {
  if (Platform.OS !== 'android' || !backgroundCheck?.cancel) {
    return false;
  }

  return backgroundCheck.cancel();
}

export async function checkBatteryOptimizationExempt(): Promise<boolean> {
  if (Platform.OS !== 'android' || !backgroundCheck?.isBatteryOptimizationExempt) {
    return false;
  }

  return backgroundCheck.isBatteryOptimizationExempt();
}

export async function requestBatteryOptimizationExemption(): Promise<boolean> {
  if (Platform.OS !== 'android' || !backgroundCheck?.requestBatteryOptimizationExemption) {
    return false;
  }

  return backgroundCheck.requestBatteryOptimizationExemption();
}

export async function openAppSystemSettings(): Promise<boolean> {
  if (Platform.OS !== 'android' || !backgroundCheck?.openAppSystemSettings) {
    return false;
  }

  return backgroundCheck.openAppSystemSettings();
}
