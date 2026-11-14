import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearDismissedUpdateVersion,
  dismissUpdateVersion,
  getDismissedUpdateVersion,
  shouldBadgeUpdate
} from '../updatePrompt';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
  storage.getItem.mockResolvedValue(null);
  storage.setItem.mockResolvedValue(undefined);
  storage.removeItem.mockResolvedValue(undefined);
});

const update = { version: '0.6.1-alpha', url: 'https://github.com/AdamJeddy/Qeemat/releases/tag/v0.6.1-alpha' };

describe('update prompt state', () => {
  it('remembers which release the user dismissed', async () => {
    expect(await getDismissedUpdateVersion()).toBeUndefined();
    storage.getItem.mockResolvedValue('0.6.1-alpha');
    expect(await getDismissedUpdateVersion()).toBe('0.6.1-alpha');
    await dismissUpdateVersion('0.6.1-alpha');
    expect(storage.setItem).toHaveBeenCalledWith('qeemat.update-dismissed-version.v1', '0.6.1-alpha');
    await clearDismissedUpdateVersion();
    expect(storage.removeItem).toHaveBeenCalledWith('qeemat.update-dismissed-version.v1');
  });

  it('falls back safely when storage fails', async () => {
    storage.getItem.mockRejectedValue(new Error('unavailable'));
    storage.setItem.mockRejectedValue(new Error('unavailable'));
    storage.removeItem.mockRejectedValue(new Error('unavailable'));
    await expect(getDismissedUpdateVersion()).resolves.toBeUndefined();
    await expect(dismissUpdateVersion('0.6.1-alpha')).resolves.toBeUndefined();
    await expect(clearDismissedUpdateVersion()).resolves.toBeUndefined();
  });

  it('badges only a dismissed update that still exists', () => {
    expect(shouldBadgeUpdate(update, '0.6.1-alpha')).toBe(true);
    expect(shouldBadgeUpdate(update, '0.6.0-alpha')).toBe(false);
    expect(shouldBadgeUpdate(update, undefined)).toBe(false);
    expect(shouldBadgeUpdate(undefined, '0.6.1-alpha')).toBe(false);
  });
});
