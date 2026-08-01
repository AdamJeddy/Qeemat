jest.mock('react-native', () => ({
  NativeModules: {
    QeematBackgroundCheck: {
      schedule: jest.fn().mockResolvedValue(true),
      runOnce: jest.fn().mockResolvedValue(true),
      isBatteryOptimizationExempt: jest.fn().mockResolvedValue(true)
    }
  },
  Platform: { OS: 'ios' }
}));

import { NativeModules } from 'react-native';

import {
  checkBatteryOptimizationExempt,
  runBackgroundCheckOnce,
  scheduleBackgroundChecks
} from '../backgroundScheduler';

describe('background scheduler platform adapter', () => {
  it('uses an available native scheduler on iOS', async () => {
    await expect(scheduleBackgroundChecks(14)).resolves.toBe(true);
    await expect(runBackgroundCheckOnce()).resolves.toBe(true);

    expect(NativeModules.QeematBackgroundCheck.schedule).toHaveBeenCalledWith(14);
    expect(NativeModules.QeematBackgroundCheck.runOnce).toHaveBeenCalled();
  });

  it('keeps Android battery optimization controls unavailable on iOS', async () => {
    await expect(checkBatteryOptimizationExempt()).resolves.toBe(false);
    expect(NativeModules.QeematBackgroundCheck.isBatteryOptimizationExempt).not.toHaveBeenCalled();
  });
});
