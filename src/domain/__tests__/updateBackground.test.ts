jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../updates', () => ({ checkForUpdate: jest.fn() }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' }, NativeModules: {
  QeematBackgroundCheck: { getConstants: () => ({ appVersion: '0.5.5-alpha' }) },
  QeematNotifications: { notifyAppUpdate: jest.fn() }
} }));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import { checkForUpdate } from '../updates';
import { clearUpdateNotificationHistory, runBackgroundUpdateCheck } from '../updateBackground';

const check = checkForUpdate as jest.Mock;
const notify = NativeModules.QeematNotifications.notifyAppUpdate as jest.Mock;
const update = { version: '0.6-alpha', url: 'https://github.com/AdamJeddy/Qeemat/releases/tag/v0.6-alpha' };

describe('background update checks', () => {
  beforeEach(async () => { await AsyncStorage.clear(); check.mockReset(); notify.mockReset(); });
  it('notifies once for a newer release and again for a subsequent release', async () => {
    check.mockResolvedValue(update); notify.mockResolvedValue(true);
    await runBackgroundUpdateCheck(); await runBackgroundUpdateCheck();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('0.6-alpha');
    check.mockResolvedValue({ ...update, version: '0.7-alpha' });
    await runBackgroundUpdateCheck();
    expect(notify).toHaveBeenCalledTimes(2);
  });
  it('clears the remembered notification when local data is deleted', async () => {
    check.mockResolvedValue(update); notify.mockResolvedValue(true);
    await runBackgroundUpdateCheck(); await clearUpdateNotificationHistory(); await runBackgroundUpdateCheck();
    expect(notify).toHaveBeenCalledTimes(2);
  });
  it('does not notify when there is no update', async () => {
    check.mockResolvedValue(undefined); await runBackgroundUpdateCheck(); expect(notify).not.toHaveBeenCalled();
  });
  it('retries after notifications are blocked or sending fails', async () => {
    check.mockResolvedValue(update); notify.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('blocked')).mockResolvedValueOnce(true);
    await runBackgroundUpdateCheck(); await runBackgroundUpdateCheck(); await runBackgroundUpdateCheck();
    expect(notify).toHaveBeenCalledTimes(3);
  });
});
