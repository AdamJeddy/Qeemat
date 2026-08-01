const mockRemove = jest.fn();
let mockSharedTextListener: ((text: string) => void) | undefined;

jest.mock('react-native', () => ({
  NativeModules: {
    QeematShare: {
      getInitialSharedText: jest.fn().mockResolvedValue('Shared https://www.noon.com/initial')
    }
  },
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn((_eventName: string, listener: (text: string) => void) => {
      mockSharedTextListener = listener;
      return { remove: mockRemove };
    })
  }))
}));

import { subscribeToSharedProductUrls } from '../sharedProductIntake';

describe('shared product intake', () => {
  it('normalizes initial and warm share events behind one platform interface', async () => {
    const onUrl = jest.fn();
    const unsubscribe = subscribeToSharedProductUrls(onUrl);

    await Promise.resolve();
    expect(onUrl).toHaveBeenCalledWith('https://www.noon.com/initial');

    mockSharedTextListener?.('Try https://www.noon.com/warm');
    expect(onUrl).toHaveBeenCalledWith('https://www.noon.com/warm');

    unsubscribe();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('ignores shared text without a web URL', async () => {
    const onUrl = jest.fn();
    subscribeToSharedProductUrls(onUrl);
    await Promise.resolve();
    onUrl.mockClear();

    mockSharedTextListener?.('No link here');
    expect(onUrl).not.toHaveBeenCalled();
  });
});
