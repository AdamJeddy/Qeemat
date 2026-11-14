import { NativeModules, Platform } from 'react-native';
import {
  cancelInAppUpdateDownload,
  installInAppUpdate,
  openInAppInstallSettings,
  readInAppUpdateDownloadState,
  startInAppUpdateDownload,
  supportsInAppUpdate
} from '../appUpdate';

const nativeModule = {
  startDownload: jest.fn(),
  getDownloadState: jest.fn(),
  installDownloaded: jest.fn(),
  openInstallPermissionSettings: jest.fn(),
  cancelDownload: jest.fn()
};

const originalPlatform = Platform.OS;

beforeEach(() => {
  (Platform as { OS: string }).OS = 'android';
  (NativeModules as Record<string, unknown>).QeematAppUpdater = nativeModule;
  nativeModule.startDownload.mockReset().mockResolvedValue(true);
  nativeModule.getDownloadState.mockReset();
  nativeModule.installDownloaded.mockReset().mockResolvedValue({ started: true });
  nativeModule.openInstallPermissionSettings.mockReset().mockResolvedValue(true);
  nativeModule.cancelDownload.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  delete (NativeModules as Record<string, unknown>).QeematAppUpdater;
});

afterAll(() => {
  (Platform as { OS: string }).OS = originalPlatform;
});

const apk = {
  url: 'https://github.com/AdamJeddy/Qeemat/releases/download/v0.6.1-alpha/qeemat.apk',
  name: 'qeemat.apk',
  size: 25621040,
  sha256: 'ff8f90dbc8e9d343549ef901912abc482671039e5311732bdf81adec768ea3e7'
};

describe('in-app update bridge', () => {
  it('reports support only on Android when the native module is present', () => {
    expect(supportsInAppUpdate()).toBe(true);
    (Platform as { OS: string }).OS = 'ios';
    expect(supportsInAppUpdate()).toBe(false);
    (Platform as { OS: string }).OS = 'android';
    delete (NativeModules as Record<string, unknown>).QeematAppUpdater;
    expect(supportsInAppUpdate()).toBe(false);
  });

  it('starts a download with the asset URL, name, size and digest', async () => {
    await startInAppUpdateDownload(apk);
    expect(nativeModule.startDownload).toHaveBeenCalledWith(apk.url, apk.name, apk.size, apk.sha256);
    await startInAppUpdateDownload({ ...apk, sha256: undefined });
    expect(nativeModule.startDownload).toHaveBeenLastCalledWith(apk.url, apk.name, apk.size, '');
  });

  it('rejects a download that is not HTTPS before reaching the native module', async () => {
    await expect(startInAppUpdateDownload({ ...apk, url: 'http://github.com/file.apk' })).rejects.toThrow('not secure');
    expect(nativeModule.startDownload).not.toHaveBeenCalled();
  });

  it('reports an unsupported build and refuses a second concurrent download', async () => {
    delete (NativeModules as Record<string, unknown>).QeematAppUpdater;
    await expect(startInAppUpdateDownload(apk)).rejects.toThrow('cannot download updates');
    (NativeModules as Record<string, unknown>).QeematAppUpdater = nativeModule;
    nativeModule.startDownload.mockResolvedValue(false);
    await expect(startInAppUpdateDownload(apk)).rejects.toThrow('already running');
  });

  it('normalizes the native download state and rejects unknown states', async () => {
    nativeModule.getDownloadState.mockResolvedValue({ state: 'downloading', downloadedBytes: 1024, totalBytes: 4096 });
    expect(await readInAppUpdateDownloadState()).toEqual({ state: 'downloading', downloadedBytes: 1024, totalBytes: 4096, error: undefined });
    nativeModule.getDownloadState.mockResolvedValue({ state: 'failed', downloadedBytes: 0, totalBytes: 0, error: 'Could not download the update.' });
    expect(await readInAppUpdateDownloadState()).toEqual({ state: 'failed', downloadedBytes: 0, totalBytes: 0, error: 'Could not download the update.' });
    nativeModule.getDownloadState.mockResolvedValue({ state: 'exploded' });
    expect(await readInAppUpdateDownloadState()).toBeUndefined();
    delete (NativeModules as Record<string, unknown>).QeematAppUpdater;
    expect(await readInAppUpdateDownloadState()).toBeUndefined();
  });

  it('install, settings and cancel delegate to the native module', async () => {
    expect(await installInAppUpdate()).toEqual({ started: true });
    expect(await openInAppInstallSettings()).toBe(true);
    await cancelInAppUpdateDownload();
    expect(nativeModule.installDownloaded).toHaveBeenCalledTimes(1);
    expect(nativeModule.openInstallPermissionSettings).toHaveBeenCalledTimes(1);
    expect(nativeModule.cancelDownload).toHaveBeenCalledTimes(1);
  });

  it('returns safe fallbacks when the native module is unavailable', async () => {
    delete (NativeModules as Record<string, unknown>).QeematAppUpdater;
    expect(await installInAppUpdate()).toEqual({ started: false, reason: 'unsupported' });
    expect(await openInAppInstallSettings()).toBe(false);
    await expect(cancelInAppUpdateDownload()).resolves.toBeUndefined();
  });
});
