import { NativeModules, Platform } from 'react-native';
import type { UpdateApk } from './updates';

export type UpdateDownloadPhase = 'idle' | 'downloading' | 'verifying' | 'ready' | 'failed' | 'cancelled';

export type UpdateDownloadState = {
  state: UpdateDownloadPhase;
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
};

export type UpdateInstallResult = { started: boolean; permissionRequired?: boolean; reason?: string };

type AppUpdaterModule = {
  startDownload?: (url: string, fileName: string, expectedBytes: number, sha256: string) => Promise<boolean>;
  getDownloadState?: () => Promise<UpdateDownloadState>;
  installDownloaded?: () => Promise<UpdateInstallResult>;
  openInstallPermissionSettings?: () => Promise<boolean>;
  cancelDownload?: () => Promise<boolean>;
};

const PHASES: UpdateDownloadPhase[] = ['idle', 'downloading', 'verifying', 'ready', 'failed', 'cancelled'];

function getAppUpdater(): AppUpdaterModule | undefined {
  return NativeModules.QeematAppUpdater as AppUpdaterModule | undefined;
}

export function supportsInAppUpdate(): boolean {
  const appUpdater = getAppUpdater();
  return Platform.OS === 'android' &&
    typeof appUpdater?.startDownload === 'function' &&
    typeof appUpdater.getDownloadState === 'function' &&
    typeof appUpdater.installDownloaded === 'function' &&
    typeof appUpdater.openInstallPermissionSettings === 'function' &&
    typeof appUpdater.cancelDownload === 'function';
}

function downloadUrl(apk: UpdateApk): string {
  if (!/^https:\/\/[a-z0-9.-]+\./i.test(apk.url)) {
    throw new Error('The update download link is not secure.');
  }
  return apk.url;
}

export async function startInAppUpdateDownload(apk: UpdateApk): Promise<void> {
  const appUpdater = getAppUpdater();
  if (!supportsInAppUpdate() || !appUpdater?.startDownload) {
    throw new Error('This build cannot download updates inside the app.');
  }
  const url = downloadUrl(apk);
  const started = await appUpdater.startDownload(url, apk.name, apk.size, apk.sha256 ?? '');
  if (!started) {
    throw new Error('An update download is already running.');
  }
}

export async function readInAppUpdateDownloadState(): Promise<UpdateDownloadState | undefined> {
  const appUpdater = getAppUpdater();
  if (!supportsInAppUpdate() || !appUpdater?.getDownloadState) { return undefined; }
  const state = await appUpdater.getDownloadState();
  if (!state || !PHASES.includes(state.state)) { return undefined; }
  return {
    state: state.state,
    downloadedBytes: Number(state.downloadedBytes) || 0,
    totalBytes: Number(state.totalBytes) || 0,
    error: typeof state.error === 'string' && state.error ? state.error : undefined
  };
}

export async function installInAppUpdate(): Promise<UpdateInstallResult> {
  const appUpdater = getAppUpdater();
  if (!supportsInAppUpdate() || !appUpdater?.installDownloaded) {
    return { started: false, reason: 'unsupported' };
  }
  return appUpdater.installDownloaded();
}

export async function openInAppInstallSettings(): Promise<boolean> {
  const appUpdater = getAppUpdater();
  if (!supportsInAppUpdate() || !appUpdater?.openInstallPermissionSettings) { return false; }
  return appUpdater.openInstallPermissionSettings();
}

export async function cancelInAppUpdateDownload(): Promise<void> {
  const appUpdater = getAppUpdater();
  if (!supportsInAppUpdate() || !appUpdater?.cancelDownload) { return; }
  await appUpdater.cancelDownload();
}
