export type PlatformCapabilities = {
  displayName: string;
  backgroundSchedulerName: string;
  supportsBatteryOptimizationControls: boolean;
};

export function getPlatformCapabilities(platform: string): PlatformCapabilities {
  if (platform === 'android') {
    return {
      displayName: 'Android',
      backgroundSchedulerName: 'Android WorkManager',
      supportsBatteryOptimizationControls: true
    };
  }

  if (platform === 'ios') {
    return {
      displayName: 'iOS',
      backgroundSchedulerName: 'iOS background tasks',
      supportsBatteryOptimizationControls: false
    };
  }

  return {
    displayName: 'This platform',
    backgroundSchedulerName: 'the system background scheduler',
    supportsBatteryOptimizationControls: false
  };
}
