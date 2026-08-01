import { getPlatformCapabilities } from '../capabilities';

describe('platform capabilities', () => {
  it('describes Android-specific battery and scheduling behavior', () => {
    expect(getPlatformCapabilities('android')).toEqual({
      displayName: 'Android',
      backgroundSchedulerName: 'Android WorkManager',
      supportsBatteryOptimizationControls: true
    });
  });

  it('describes iOS without exposing Android battery controls', () => {
    expect(getPlatformCapabilities('ios')).toEqual({
      displayName: 'iOS',
      backgroundSchedulerName: 'iOS background tasks',
      supportsBatteryOptimizationControls: false
    });
  });

  it('uses neutral copy on unrecognized platforms', () => {
    expect(getPlatformCapabilities('windows')).toEqual({
      displayName: 'This platform',
      backgroundSchedulerName: 'the system background scheduler',
      supportsBatteryOptimizationControls: false
    });
  });
});
